import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ColumnType = "numeric" | "text";

export interface CustomColumn {
  id: string;
  project_id: string;
  name: string;
  column_type: ColumnType;
  masked: boolean;
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
      .order("created_at", { ascending: true });
    setColumns((data as CustomColumn[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  const addColumn = async (name: string, columnType: ColumnType = "numeric") => {
    if (!projectId || !name.trim()) return;
    const { error } = await supabase
      .from("custom_columns")
      .insert({ project_id: projectId, name: name.trim(), column_type: columnType });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Column already exists" : "Failed to add column");
      return;
    }
    toast.success("Column added");
    await fetchColumns();
  };

  const deleteColumn = async (id: string) => {
    const { error } = await supabase.from("custom_columns").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete column");
      return;
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

  return { columns, loading, addColumn, deleteColumn, toggleMasked, fetchColumns };
};
