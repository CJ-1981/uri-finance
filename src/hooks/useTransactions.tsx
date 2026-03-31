import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient, useMutationState } from "@tanstack/react-query";
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

  // Track pending "add" mutations to keep them in the UI during re-sync
  const pendingAdds = useMutationState({
    filters: { status: "pending", mutationKey: ["addTransaction", projectId] },
    select: (mutation) => mutation.state.variables as any,
  });

  // Track pending "delete" IDs to hide them from UI during re-sync
  const pendingDeletes = useMutationState({
    filters: { status: "pending", mutationKey: ["deleteTransaction", projectId] },
    select: (mutation) => mutation.state.variables as string,
  });

  const { data: serverTransactions = [], isLoading: loading } = useQuery({
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
      return data as Transaction[];
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5,
  });

  // Merge server data with pending offline changes to prevent data loss during sync
  const transactions = useMemo(() => {
    // 1. Start with server data
    let list = [...serverTransactions];

    // 2. Filter out items that are pending deletion
    if (pendingDeletes.length > 0) {
      const deleteSet = new Set(pendingDeletes);
      list = list.filter(t => !deleteSet.has(t.id));
    }

    // 3. Add items that are pending creation (avoiding duplicates)
    if (pendingAdds.length > 0) {
      const existingIds = new Set(list.map(t => t.id));
      pendingAdds.forEach(pending => {
        if (!existingIds.has(pending.id)) {
          // Format as a full Transaction object
          list.unshift({
            project_id: projectId!,
            user_id: user?.id || "",
            created_at: new Date().toISOString(),
            deleted_at: null,
            ...pending,
            description: pending.description || null,
            transaction_date: pending.transaction_date || new Date().toISOString().split("T")[0],
            custom_values: pending.custom_values || {},
            currency: pending.currency || "USD",
          });
        }
      });
    }

    // 4. Re-sort if we added items
    return list.sort((a, b) => {
      const dateA = new Date(a.transaction_date).getTime();
      const dateB = new Date(b.transaction_date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [serverTransactions, pendingAdds, pendingDeletes, projectId, user]);

  const addTransactionMutation = useMutation({
    mutationKey: ["addTransaction", projectId],
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
      await queryClient.cancelQueries({ queryKey: ["transactions", projectId] });
      const previousTransactions = queryClient.getQueryData(["transactions", projectId]);
      
      const optimisticTx: Transaction = {
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
      };

      queryClient.setQueryData(["transactions", projectId], (old: Transaction[] | undefined) => [optimisticTx, ...(old || [])]);
      return { previousTransactions };
    },
    onError: (err: any, newTx, context) => {
      if (isNetError(err)) return;
      queryClient.setQueryData(["transactions", projectId], context?.previousTransactions);
      toast.error("Failed to add transaction");
    },
    onSuccess: () => {
      toast.success("Transaction added!", { duration: 2000 });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", projectId] });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationKey: ["updateTransaction", projectId],
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<Pick<Transaction, "type" | "amount" | "category" | "description" | "transaction_date" | "custom_values" | "currency">> }) => {
      const { error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["transactions", projectId] });
      const previousTransactions = queryClient.getQueryData(["transactions", projectId]);
      queryClient.setQueryData(["transactions", projectId], (old: Transaction[] | undefined) => 
        old?.map(t => t.id === id ? { ...t, ...updates } : t)
      );
      return { previousTransactions };
    },
    onError: (err: any, variables, context) => {
      if (isNetError(err)) return;
      queryClient.setQueryData(["transactions", projectId], context?.previousTransactions);
      toast.error("Failed to update transaction");
    },
    onSuccess: () => {
      toast.success("Transaction updated!");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", projectId] });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationKey: ["deleteTransaction", projectId],
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
      await queryClient.cancelQueries({ queryKey: ["transactions", projectId] });
      const previousTransactions = queryClient.getQueryData(["transactions", projectId]);
      queryClient.setQueryData(["transactions", projectId], (old: Transaction[] | undefined) => 
        old?.filter(t => t.id !== id)
      );
      return { previousTransactions };
    },
    onError: (err: any, id, context) => {
      if (isNetError(err)) return;
      queryClient.setQueryData(["transactions", projectId], context?.previousTransactions);
      toast.error("Failed to delete transaction");
    },
    onSuccess: () => {
      toast.success("Transaction deleted");
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-files", projectId] });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", projectId] });
    },
  });

  const bulkAddTransactionsMutation = useMutation({
    mutationKey: ["bulkAddTransactions", projectId],
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
