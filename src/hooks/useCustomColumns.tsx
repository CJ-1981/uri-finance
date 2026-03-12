import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ColumnType = "numeric" | "text" | "list";

export interface CustomColumn {
  id: string;
  project_id: string;
  name: string;
  column_type: ColumnType;
  masked: boolean;
  required: boolean;
  sort_order: number;
  suggestions: string[];
  suggestion_colors: Record<string, string>;
  created_at: string;
}

export const useCustomColumns = (projectId: string | undefined) => {
  const [columns, setColumns] = useState<CustomColumn[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchColumns = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data } = await supabase
      .from("custom_columns")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setColumns((data as CustomColumn[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  const addColumn = async (name: string, columnType: ColumnType = "numeric") => {
    if (!projectId || !name.trim()) return;
    const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.sort_order)) : -1;
    const { error } = await supabase
      .from("custom_columns")
      .insert({ project_id: projectId, name: name.trim(), column_type: columnType, sort_order: maxOrder + 1 } as any);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Column already exists" : "Failed to add column");
      return;
    }
    toast.success("Column added");
    await fetchColumns();
  };

  const deleteColumn = async (id: string) => {
    const col = columns.find(c => c.id === id);
    const { error } = await supabase.from("custom_columns").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete column");
      return;
    }
    // Clean up existing transaction data
    if (col && projectId) {
      await supabase.rpc("remove_custom_column_key", {
        _project_id: projectId,
        _column_name: col.name,
      });
    }
    toast.success("Column removed");
    await fetchColumns();
  };

  const toggleMasked = async (id: string, masked: boolean) => {
    const { error } = await supabase
      .from("custom_columns")
      .update({ masked })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update column");
      return;
    }
    await fetchColumns();
  };

  const toggleRequired = async (id: string, required: boolean) => {
    const { error } = await supabase
      .from("custom_columns")
      .update({ required } as any)
      .eq("id", id);
    if (error) {
      toast.error("Failed to update column");
      return;
    }
    await fetchColumns();
  };

  const updateSuggestions = async (id: string, suggestions: string[]) => {
    const { error } = await supabase
      .from("custom_columns")
      .update({ suggestions } as any)
      .eq("id", id);
    if (error) {
      toast.error("Failed to update suggestions");
      return;
    }
    toast.success("Suggestions updated");
    await fetchColumns();
  };

  const reorderColumn = async (id: string, direction: "up" | "down") => {
    const idx = columns.findIndex(c => c.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= columns.length) return;

    const current = columns[idx];
    const swap = columns[swapIdx];

    const currentOrder = current.sort_order !== swap.sort_order ? current.sort_order : idx;
    const swapOrder = current.sort_order !== swap.sort_order ? swap.sort_order : swapIdx;

    await Promise.all([
      supabase.from("custom_columns").update({ sort_order: swapOrder } as any).eq("id", current.id),
      supabase.from("custom_columns").update({ sort_order: currentOrder } as any).eq("id", swap.id),
    ]);
    await fetchColumns();
  };

  const renameColumn = async (id: string, newName: string) => {
    if (!newName.trim() || !projectId) return;
    const oldCol = columns.find(c => c.id === id);
    if (!oldCol) return;
    const trimmed = newName.trim();
    if (trimmed === oldCol.name) return;

    const { error } = await supabase
      .from("custom_columns")
      .update({ name: trimmed } as any)
      .eq("id", id);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Column name already exists" : "Failed to rename column");
      return;
    }

    // Migrate existing transaction data keys
    await supabase.rpc("rename_custom_column_key", {
      _project_id: projectId,
      _old_name: oldCol.name,
      _new_name: trimmed,
    });

    toast.success("Column renamed");
    await fetchColumns();
  };

  const reorderColumns = async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, index) =>
      supabase.from("custom_columns").update({ sort_order: index } as any).eq("id", id)
    );
    await Promise.all(updates);
    await fetchColumns();
  };

  return { columns, loading, addColumn, deleteColumn, toggleMasked, toggleRequired, updateSuggestions, reorderColumn, reorderColumns, renameColumn, fetchColumns };
};
