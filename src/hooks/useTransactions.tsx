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
  custom_values: Record<string, number | string> | null;
  deleted_at: string | null;
  currency: string;
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
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
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
    custom_values?: Record<string, number | string>;
    currency?: string;
  }) => {
    if (!user || !projectId) return;
    const { data, error } = await supabase.from("transactions").insert({
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

    if (error) {
      toast.error("Failed to add transaction");
      return;
    }
    toast.success("Transaction added!", { duration: 2000 });
    await fetchTransactions();
    // Return transaction ID for file association
    return data?.id;
  };

  const updateTransaction = async (id: string, updates: Partial<Pick<Transaction, "type" | "amount" | "category" | "description" | "transaction_date" | "custom_values" | "currency">>) => {
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
    // Soft delete transaction
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete transaction");
      return;
    }

    // Unlink all files associated with this transaction (set transaction_id to NULL)
    const { error: unlinkError } = await supabase
      .from("project_files")
      .update({ transaction_id: null })
      .eq("transaction_id", id);

    if (unlinkError) {
      console.error("Failed to unlink files from transaction:", unlinkError);
      // Don't fail the delete if unlink fails, just log it
    }

    toast.success("Transaction deleted");
    await fetchTransactions();
  };

  const bulkAddTransactions = async (txs: Array<{
    type: "income" | "expense";
    amount: number;
    category: string;
    description?: string;
    transaction_date?: string;
    currency?: string;
    custom_values?: Record<string, number | string>;
  }>) => {
    if (!user || !projectId) return;
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
    if (error) {
      toast.error("Failed to import transactions");
      return;
    }
    await fetchTransactions();
  };

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = totalIncome - totalExpense;

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction, bulkAddTransactions, fetchTransactions, totalIncome, totalExpense, balance };
};
