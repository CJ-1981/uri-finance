import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  default_value?: string;
  created_at: string;
}

const isNetError = (err: any) => {
  return !navigator.onLine || 
         err?.message?.includes("Failed to fetch") || 
         err?.message?.includes("Load failed") ||
         err?.message?.includes("TypeError") ||
         err?.code === "PGRST100" || 
         err?.status === 0;
};

export const useCustomColumns = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: columns = [], isLoading: loading } = useQuery({
    queryKey: ["project_custom_columns", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("custom_columns")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CustomColumn[];
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const addColumnMutation = useMutation({
    mutationFn: async ({ name, columnType }: { name: string, columnType: ColumnType }) => {
      if (!projectId || !name.trim()) return;
      const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.sort_order)) : -1;
      const { error } = await supabase
        .from("custom_columns")
        .insert({ project_id: projectId, name: name.trim(), column_type: columnType, sort_order: maxOrder + 1 } as Partial<CustomColumn>);
      if (error) throw error;
    },
    onMutate: async ({ name, columnType }) => {
      await queryClient.cancelQueries({ queryKey: ["project_custom_columns", projectId] });
      const previous = queryClient.getQueryData(["project_custom_columns", projectId]);
      const optimistic: CustomColumn = {
        id: crypto.randomUUID(),
        project_id: projectId!,
        name: name.trim(),
        column_type: columnType,
        masked: false,
        required: false,
        sort_order: columns.length,
        suggestions: [],
        suggestion_colors: {},
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData(["project_custom_columns", projectId], (old: any) => [...(old || []), optimistic]);
      return { previous };
    },
    onSuccess: () => {
      toast.success("Column added");
    },
    onError: (err: any, variables, context) => {
      if (isNetError(err)) return;
      queryClient.setQueryData(["project_custom_columns", projectId], context?.previous);
      toast.error(err.message.includes("duplicate") ? "Column already exists" : "Failed to add column");
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["project_custom_columns", projectId] });
      }
    }
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (id: string) => {
      const col = columns.find(c => c.id === id);
      const { error } = await supabase.from("custom_columns").delete().eq("id", id);
      if (error) throw error;
      if (col && projectId) {
        await supabase.rpc("remove_custom_column_key", {
          _project_id: projectId,
          _column_name: col.name,
        });
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["project_custom_columns", projectId] });
      const previous = queryClient.getQueryData(["project_custom_columns", projectId]);
      queryClient.setQueryData(["project_custom_columns", projectId], (old: any) => (old as CustomColumn[])?.filter(c => c.id !== id));
      return { previous };
    },
    onSuccess: () => {
      toast.success("Column removed");
    },
    onError: (err, variables, context) => {
      if (isNetError(err)) return;
      queryClient.setQueryData(["project_custom_columns", projectId], context?.previous);
      toast.error("Failed to delete column");
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["project_custom_columns", projectId] });
      }
    }
  });

  const updateColumnMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<CustomColumn> }) => {
      const { error } = await supabase
        .from("custom_columns")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["project_custom_columns", projectId] });
      const previous = queryClient.getQueryData(["project_custom_columns", projectId]);
      queryClient.setQueryData(["project_custom_columns", projectId], (old: any) => (old as CustomColumn[])?.map(c => c.id === id ? { ...c, ...updates } : c));
      return { previous };
    },
    onError: (err, variables, context) => {
      if (isNetError(err)) return;
      queryClient.setQueryData(["project_custom_columns", projectId], context?.previous);
      toast.error("Failed to update column");
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["project_custom_columns", projectId] });
      }
    }
  });

  const renameColumnMutation = useMutation({
    mutationFn: async ({ id, newName }: { id: string, newName: string }) => {
      if (!newName.trim() || !projectId) return;
      const oldCol = columns.find(c => c.id === id);
      if (!oldCol) return;
      const trimmed = newName.trim();
      if (trimmed === oldCol.name) return;

      const { error } = await supabase
        .from("custom_columns")
        .update({ name: trimmed } as { name: string })
        .eq("id", id);
      if (error) throw error;

      await supabase.rpc("rename_custom_column_key", {
        _project_id: projectId,
        _old_name: oldCol.name,
        _new_name: trimmed,
      });
    },
    onMutate: async ({ id, newName }) => {
      await queryClient.cancelQueries({ queryKey: ["project_custom_columns", projectId] });
      const previous = queryClient.getQueryData(["project_custom_columns", projectId]);
      queryClient.setQueryData(["project_custom_columns", projectId], (old: any) => (old as CustomColumn[])?.map(c => c.id === id ? { ...c, name: newName } : c));
      return { previous };
    },
    onSuccess: () => {
      toast.success("Column renamed");
    },
    onError: (err: any, variables, context) => {
      if (isNetError(err)) return;
      queryClient.setQueryData(["project_custom_columns", projectId], context?.previous);
      toast.error(err.message.includes("duplicate") ? "Column name already exists" : "Failed to rename column");
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["project_custom_columns", projectId] });
      }
    }
  });

  return { 
    columns, 
    loading, 
    addColumn: (name: string, columnType: ColumnType = "numeric") => addColumnMutation.mutate({ name, columnType }),
    deleteColumn: (id: string) => deleteColumnMutation.mutate(id),
    toggleMasked: (id: string, masked: boolean) => updateColumnMutation.mutate({ id, updates: { masked } }),
    toggleRequired: (id: string, required: boolean) => updateColumnMutation.mutate({ id, updates: { required } }),
    updateSuggestions: (id: string, suggestions: string[], suggestionColors?: Record<string, string>, defaultValue?: string) => 
      updateColumnMutation.mutate({ id, updates: { suggestions, suggestion_colors: suggestionColors, default_value: defaultValue || undefined } }),
    reorderColumn: (id: string, direction: "up" | "down") => {
      const idx = columns.findIndex(c => c.id === id);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= columns.length) return;
      const current = columns[idx];
      const swap = columns[swapIdx];
      updateColumnMutation.mutate({ id: current.id, updates: { sort_order: swap.sort_order } });
      updateColumnMutation.mutate({ id: swap.id, updates: { sort_order: current.sort_order } });
    },
    reorderColumns: (orderedIds: string[]) => {
      orderedIds.forEach((id, index) => updateColumnMutation.mutate({ id, updates: { sort_order: index } }));
    },
    renameColumn: (id: string, newName: string) => renameColumnMutation.mutate({ id, newName }),
    fetchColumns: () => queryClient.invalidateQueries({ queryKey: ["project_custom_columns", projectId] }),
  };
};
