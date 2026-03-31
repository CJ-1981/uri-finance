import { useMemo, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { isNetworkError } from "@/lib/networkUtils";

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

const PAGE_SIZE = 50;

export const useTransactions = (projectId: string | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { 
    data, 
    isLoading: loading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: ["transactions", projectId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      
      if (error) throw error;
      return (data as Transaction[]).map(t => ({ ...t, _sync_status: "synced" as const }));
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5,
  });

  // Flatten infinite query pages into a single list
  const transactions = useMemo(() => {
    return data?.pages?.flat() || [];
  }, [data]);

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
      const queryKey = ["transactions", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      
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

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return { pages: [[optimistic]], pageParams: [0] };
        const newPages = [...old.pages];
        newPages[0] = [optimistic, ...newPages[0]];
        return { ...old, pages: newPages };
      });

      return { previous };
    },
    onSuccess: (data, variables) => {
      toast.success("Transaction added!", { duration: 2000 });
      queryClient.setQueryData(["transactions", projectId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: Transaction[]) => 
            page.map(t => t.id === variables.id ? { ...t, _sync_status: "synced" as const } : t)
          )
        };
      });
    },
    onError: (err: any, variables, context) => {
      if (isNetworkError(err)) return;
      queryClient.setQueryData(["transactions", projectId], context?.previous);
      toast.error("Failed to add transaction");
    },
    onSettled: () => {
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
      const queryKey = ["transactions", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: Transaction[]) => 
            page.map(t => t.id === id ? { ...t, ...updates, _sync_status: "optimistic" as const } : t)
          )
        };
      });
      return { previous };
    },
    onError: (err: any, variables, context) => {
      if (isNetworkError(err)) return;
      queryClient.setQueryData(["transactions", projectId], context?.previous);
      toast.error("Failed to update transaction");
    },
    onSuccess: (data, variables) => {
      toast.success("Transaction updated!");
      queryClient.setQueryData(["transactions", projectId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: Transaction[]) => 
            page.map(t => t.id === variables.id ? { ...t, _sync_status: "synced" as const } : t)
          )
        };
      });
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
      const queryKey = ["transactions", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: Transaction[]) => 
            page.filter(t => t.id !== id)
          )
        };
      });
      return { previous };
    },
    onError: (err: any, id, context) => {
      if (isNetworkError(err)) return;
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
    },
    onError: (err: any) => {
      if (isNetworkError(err)) return;
      toast.error("Failed to import transactions");
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["transactions", projectId] });
        }, 2000);
      }
    }
  });

  const totalIncome = useMemo(() => transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);

  const totalExpense = useMemo(() => transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);

  const balance = totalIncome - totalExpense;

  const addTransaction = useCallback(async (tx: any) => {
    const id = crypto.randomUUID();
    try {
      await addTransactionMutation.mutateAsync({ ...tx, id });
      return id;
    } catch (err) {
      if (isNetworkError(err)) return id; // Treat as success for offline flow
      throw err;
    }
  }, [addTransactionMutation]);

  return { 
    transactions, 
    loading, 
    addTransaction,
    updateTransaction: (id: string, updates: any) => updateTransactionMutation.mutateAsync({ id, updates }), 
    deleteTransaction: (id: string) => deleteTransactionMutation.mutateAsync(id), 
    bulkAddTransactions: (txs: any[]) => bulkAddTransactionsMutation.mutate(txs), 
    fetchTransactions: () => queryClient.invalidateQueries({ queryKey: ["transactions", projectId] }), 
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    totalIncome, 
    totalExpense, 
    balance 
  };
};
