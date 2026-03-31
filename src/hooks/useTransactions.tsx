import { useMemo, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { isNetworkError } from "@/lib/networkUtils";
import { format } from "date-fns";

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

  const TRANSACTIONS_KEY = ["infinite_transactions", projectId];

  const { 
    data, 
    isLoading: loading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: TRANSACTIONS_KEY,
    queryFn: async ({ pageParam }) => {
      if (!projectId) return [];
      
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (pageParam) {
        const { date, createdAt } = pageParam as { date: string; createdAt: string };
        query = query.or(`transaction_date.lt.${date},and(transaction_date.eq.${date},created_at.lt.${createdAt})`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data as Transaction[]).map(t => ({ ...t, _sync_status: "synced" as const }));
    },
    initialPageParam: null as { date: string; createdAt: string } | null,
    getNextPageParam: (lastPage) => {
      if (!lastPage || !Array.isArray(lastPage) || lastPage.length < PAGE_SIZE) return undefined;
      const lastItem = lastPage[lastPage.length - 1];
      return { date: lastItem.transaction_date, createdAt: lastItem.created_at };
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5,
  });

  const transactions = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flat() || [];
  }, [data]);

  const addTransactionMutation = useMutation({
    mutationKey: ["addTransaction", projectId],
    mutationFn: async (tx: {
      id: string;
      project_id: string; // Added for persistence
      user_id: string;    // Added for persistence
      type: "income" | "expense";
      amount: number;
      category: string;
      description?: string;
      transaction_date?: string;
      custom_values?: Record<string, number | string>;
      currency?: string;
    }) => {
      const { data, error } = await supabase.from("transactions").insert({
        id: tx.id,
        project_id: tx.project_id,
        user_id: tx.user_id,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        description: tx.description || null,
        transaction_date: tx.transaction_date || format(new Date(), "yyyy-MM-dd"),
        custom_values: tx.custom_values || {},
        currency: tx.currency || "USD",
      }).select("id").single();

      if (error) throw error;
      return data?.id;
    },
    onMutate: async (newTx) => {
      await queryClient.cancelQueries({ queryKey: TRANSACTIONS_KEY });
      const previous = queryClient.getQueryData(TRANSACTIONS_KEY);
      
      const optimistic: Transaction = {
        created_at: new Date().toISOString(),
        deleted_at: null,
        ...newTx,
        description: newTx.description || null,
        transaction_date: newTx.transaction_date || format(new Date(), "yyyy-MM-dd"),
        custom_values: newTx.custom_values || {},
        currency: newTx.currency || "USD",
        _sync_status: "optimistic",
      };

      queryClient.setQueryData(TRANSACTIONS_KEY, (old: any) => {
        if (!old) return { pages: [[optimistic]], pageParams: [null] };
        const newPages = [...old.pages];
        newPages[0] = [optimistic, ...newPages[0]];
        return { ...old, pages: newPages };
      });

      return { previous };
    },
    onSuccess: (data, variables) => {
      toast.success("Transaction added!", { duration: 2000 });
      queryClient.setQueryData(TRANSACTIONS_KEY, (old: any) => {
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
      if (isNetworkError(err)) {
        toast.info("Saved offline - will sync when online");
        return;
      }
      queryClient.setQueryData(TRANSACTIONS_KEY, context?.previous);
      toast.error("Failed to add transaction");
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
        }, 2000);
      }
    },
  });

  const updateTransactionMutation = useMutation({
    mutationKey: ["updateTransaction", projectId],
    mutationFn: async ({ id, updates, project_id }: { id: string, updates: Partial<Pick<Transaction, "type" | "amount" | "category" | "description" | "transaction_date" | "custom_values" | "currency">>, project_id: string }) => {
      const { error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", id)
        .eq("project_id", project_id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: TRANSACTIONS_KEY });
      const previous = queryClient.getQueryData(TRANSACTIONS_KEY);
      queryClient.setQueryData(TRANSACTIONS_KEY, (old: any) => {
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
      if (isNetworkError(err)) {
        toast.info("Update saved offline");
        return;
      }
      queryClient.setQueryData(TRANSACTIONS_KEY, context?.previous);
      toast.error("Failed to update transaction");
    },
    onSuccess: (data, variables) => {
      toast.success("Transaction updated!");
      queryClient.setQueryData(TRANSACTIONS_KEY, (old: any) => {
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
          queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
        }, 2000);
      }
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationKey: ["deleteTransaction", projectId],
    mutationFn: async ({ id, project_id }: { id: string, project_id: string }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("project_id", project_id);
      if (error) throw error;

      const { error: unlinkError } = await supabase
        .from("project_files")
        .update({ transaction_id: null })
        .eq("transaction_id", id);
      
      if (unlinkError) throw unlinkError;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: TRANSACTIONS_KEY });
      const previous = queryClient.getQueryData(TRANSACTIONS_KEY);
      queryClient.setQueryData(TRANSACTIONS_KEY, (old: any) => {
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
    onError: (err: any, variables, context) => {
      if (isNetworkError(err)) {
        toast.info("Delete pending offline");
        return;
      }
      queryClient.setQueryData(TRANSACTIONS_KEY, context?.previous);
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
    mutationKey: ["bulkAddTransactions", projectId],
    mutationFn: async ({ txs, project_id, user_id }: { txs: Array<any>, project_id: string, user_id: string }) => {
      const rows = txs.map((tx) => ({
        project_id,
        user_id,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        description: tx.description || null,
        transaction_date: tx.transaction_date || format(new Date(), "yyyy-MM-dd"),
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
          queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
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
    if (!projectId || !user) throw new Error("Missing project or user");
    const id = crypto.randomUUID();
    try {
      await addTransactionMutation.mutateAsync({ ...tx, id, project_id: projectId, user_id: user.id });
      return id;
    } catch (err) {
      if (isNetworkError(err)) return id;
      throw err;
    }
  }, [addTransactionMutation, projectId, user]);

  return { 
    transactions, 
    loading, 
    addTransaction,
    updateTransaction: (id: string, updates: any) => {
      if (!projectId) return Promise.reject("No project");
      return updateTransactionMutation.mutateAsync({ id, updates, project_id: projectId });
    },
    deleteTransaction: (id: string) => {
      if (!projectId) return Promise.reject("No project");
      return deleteTransactionMutation.mutateAsync({ id, project_id: projectId });
    },
    bulkAddTransactions: (txs: any[]) => {
      if (!projectId || !user) return Promise.reject("No project or user");
      return bulkAddTransactionsMutation.mutateAsync({ txs, project_id: projectId, user_id: user.id });
    },
    fetchTransactions: () => queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY }), 
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    totalIncome, 
    totalExpense, 
    balance 
  };
};
