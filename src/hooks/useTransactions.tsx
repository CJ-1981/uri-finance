import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Transaction {
  id: string;
  project_id: string;
  user_id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  transaction_date: string;
  created_at: string;
  custom_values: Record<string, number | string> | null;
  deleted_at: string | null;
  currency: string;
  _sync_status?: "optimistic" | "synced" | "deleted";
}

const isNetError = (err: any) => {
  return !navigator.onLine || 
         err?.message?.includes("Failed to fetch") || 
         err?.message?.includes("Load failed") ||
         err?.message?.includes("TypeError") ||
         err?.code === "PGRST100" ||
         err?.status === 0;
};

export const useTransactions = (projectId: string | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading: loading } = useQuery({
    queryKey: ["transactions", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      
      return (data as Transaction[]).map(t => ({ ...t, _sync_status: "synced" as const }));
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5,
  });

  const addTransactionMutation = useMutation({
    mutationFn: async (tx: {
      id: string;
      type: "income" | "expense";
      amount: number;
      category: string;
      description?: string;
      transaction_date?: string;
      custom_values?: Record<string, number | string>;
      currency?: string;
    }) => {
      if (!user || !projectId) throw new Error("Missing auth or project");
      const { data, error } = await supabase.from("transactions").insert({
        id: tx.id,
        project_id: projectId,
        user_id: user.id,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        description: tx.description || null,
        transaction_date: tx.transaction_date || new Date().toISOString().split("T")[0],
        custom_values: tx.custom_values || {},
        currency: tx.currency || "USD",
      }).select("id").single();

      if (error) throw error;
      return data?.id;
    },
    onMutate: async (newTx) => {
      // Direct cache update for immediate UI feedback
      const previous = queryClient.getQueryData(["transactions", projectId]);
      
      const optimistic: Transaction = {
        project_id: projectId!,
        user_id: user?.id || "",
        created_at: new Date().toISOString(),
        deleted_at: null,
        ...newTx,
        id: newTx.id,
        description: newTx.description || null,
        transaction_date: newTx.transaction_date || new Date().toISOString().split("T")[0],
        custom_values: newTx.custom_values || {},
        currency: newTx.currency || "USD",
        _sync_status: "optimistic",
      };

      queryClient.setQueryData(["transactions", projectId], (old: Transaction[] | undefined) => {
        const list = [optimistic, ...(old || [])];
        return list.sort((a, b) => {
          const dateA = new Date(a.transaction_date).getTime();
          const dateB = new Date(b.transaction_date).getTime();
          if (dateB !== dateA) return dateB - dateA;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      });

      return { previous };
    },
    onSuccess: (data, variables) => {
      toast.success("Transaction added!", { duration: 2000 });
      // Update the optimistic item to "synced" status
      queryClient.setQueryData(["transactions", projectId], (old: Transaction[] | undefined) => 
        old?.map(t => t.id === variables.id ? { ...t, _sync_status: "synced" as const } : t)
      );
    },
    onError: (err: any, variables, context) => {
      if (isNetError(err)) return;
      queryClient.setQueryData(["transactions", projectId], context?.previous);
      toast.error("Failed to add transaction");
    },
    onSettled: () => {
      // Only invalidate if we are online to avoid flickering
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["transactions", projectId] });
        }, 2000);
      }
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<Pick<Transaction, "type" | "amount" | "category" | "description" | "transaction_date" | "custom_values" | "currency">> }) => {
      const { error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      const previous = queryClient.getQueryData(["transactions", projectId]);
      queryClient.setQueryData(["transactions", projectId], (old: Transaction[] | undefined) => 
        old?.map(t => t.id === id ? { ...t, ...updates, _sync_status: "optimistic" as const } : t)
      );
      return { previous };
    },
    onError: (err: any, variables, context) => {
      if (isNetError(err)) return;
      queryClient.setQueryData(["transactions", projectId], context?.previous);
      toast.error("Failed to update transaction");
    },
    onSuccess: (data, variables) => {
      toast.success("Transaction updated!");
      queryClient.setQueryData(["transactions", projectId], (old: Transaction[] | undefined) => 
        old?.map(t => t.id === variables.id ? { ...t, _sync_status: "synced" as const } : t)
      );
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["transactions", projectId] });
        }, 2000);
      }
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transactions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      const { error: unlinkError } = await supabase
        .from("project_files")
        .update({ transaction_id: null })
        .eq("transaction_id", id);
      if (unlinkError) console.error("Unlink files error:", unlinkError);
    },
    onMutate: async (id) => {
      const previous = queryClient.getQueryData(["transactions", projectId]);
      queryClient.setQueryData(["transactions", projectId], (old: Transaction[] | undefined) => 
        old?.filter(t => t.id !== id)
      );
      return { previous };
    },
    onError: (err: any, id, context) => {
      if (isNetError(err)) return;
      queryClient.setQueryData(["transactions", projectId], context?.previous);
      toast.error("Failed to delete transaction");
    },
    onSuccess: () => {
      toast.success("Transaction deleted");
      if (projectId && navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["project-files", projectId] });
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["transactions", projectId] });
        }, 2000);
      }
    },
  });

  const bulkAddTransactionsMutation = useMutation({
    mutationFn: async (txs: Array<any>) => {
      if (!user || !projectId) throw new Error("Missing auth or project");
      const rows = txs.map((tx) => ({
        project_id: projectId,
        user_id: user.id,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        description: tx.description || null,
        transaction_date: tx.transaction_date || new Date().toISOString().split("T")[0],
        custom_values: tx.custom_values || {},
        currency: tx.currency || "USD",
      }));
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transactions imported!");
      queryClient.invalidateQueries({ queryKey: ["transactions", projectId] });
    },
    onError: (err: any) => {
      if (isNetError(err)) return;
      toast.error("Failed to import transactions");
    }
  });

  const totalIncome = useMemo(() => transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);

  const totalExpense = useMemo(() => transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);

  const balance = totalIncome - totalExpense;

  return { 
    transactions, 
    loading, 
    addTransaction: (tx: any) => {
      const id = crypto.randomUUID();
      addTransactionMutation.mutate({ ...tx, id });
      return Promise.resolve(id);
    },
    updateTransaction: (id: string, updates: any) => updateTransactionMutation.mutate({ id, updates }), 
    deleteTransaction: (id: string) => deleteTransactionMutation.mutate(id), 
    bulkAddTransactions: (txs: any[]) => bulkAddTransactionsMutation.mutate(txs), 
    fetchTransactions: () => queryClient.invalidateQueries({ queryKey: ["transactions", projectId] }), 
    totalIncome, 
    totalExpense, 
    balance 
  };
};
