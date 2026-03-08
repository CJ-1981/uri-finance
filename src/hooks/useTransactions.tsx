import { useState, useEffect } from "react";
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
  custom_values: Record<string, number> | null;
}

export const useTransactions = (projectId: string | undefined) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    if (!projectId) return;
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("project_id", projectId)
      .order("transaction_date", { ascending: false })
      .limit(100);
    setTransactions((data as Transaction[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, [projectId]);

  const addTransaction = async (tx: {
    type: "income" | "expense";
    amount: number;
    category: string;
    description?: string;
    transaction_date?: string;
  }) => {
    if (!user || !projectId) return;
    const { error } = await supabase.from("transactions").insert({
      project_id: projectId,
      user_id: user.id,
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      description: tx.description || null,
      transaction_date: tx.transaction_date || new Date().toISOString().split("T")[0],
    });

    if (error) {
      toast.error("Failed to add transaction");
      return;
    }
    toast.success("Transaction added!");
    await fetchTransactions();
  };

  const updateTransaction = async (id: string, updates: Partial<Pick<Transaction, "type" | "amount" | "category" | "description" | "transaction_date">>) => {
    const { error } = await supabase
      .from("transactions")
      .update(updates)
      .eq("id", id);
    if (error) {
      toast.error("Failed to update transaction");
      return;
    }
    toast.success("Transaction updated!");
    await fetchTransactions();
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete transaction");
      return;
    }
    toast.success("Transaction deleted");
    await fetchTransactions();
  };

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = totalIncome - totalExpense;

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction, fetchTransactions, totalIncome, totalExpense, balance };
};
