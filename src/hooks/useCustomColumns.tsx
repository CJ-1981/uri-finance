import { useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isNetworkError } from "@/lib/networkUtils";

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
      const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.sort_order)) : -1;
      const { error } = await supabase
        .from("custom_columns")
        .insert({ project_id: projectId, name: name.trim(), column_type: columnType, sort_order: maxOrder + 1 } as Partial<CustomColumn>);
      if (error) throw error;
    },
    onMutate: async ({ name, columnType }) => {
      const queryKey = ["project_custom_columns", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
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
      queryClient.setQueryData(queryKey, (old: any) => [...(old || []), optimistic]);
      return { previous };
    },
    onSuccess: () => {
      toast.success("Column added");
    },
    onError: (err: any, variables, context) => {
      if (isNetworkError(err)) {
        toast.info("Column saved offline — will sync when online");
        return;
      }
      queryClient.setQueryData(["project_custom_columns", projectId], context?.previous);
      toast.error(err.message.includes("duplicate") ? "Column already exists" : "Failed to add column");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project_custom_columns", projectId] });
    }
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (id: string) => {
      const col = columns.find(c => c.id === id);
      if (!col || !projectId) return;

      const { error: deleteError } = await supabase.from("custom_columns").delete().eq("id", id);
      if (deleteError) throw deleteError;

      const { error: rpcError } = await supabase.rpc("remove_custom_column_key", {
        _project_id: projectId,
        _column_name: col.name,
      });
      if (rpcError) throw rpcError;
    },
    onMutate: async (id) => {
      const queryKey = ["project_custom_columns", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => (old as CustomColumn[])?.filter(c => c.id !== id));
      return { previous };
    },
    onSuccess: () => {
      toast.success("Column removed");
    },
    onError: (err, variables, context) => {
      if (isNetworkError(err)) {
        toast.info("Delete pending offline");
        return;
      }
      queryClient.setQueryData(["project_custom_columns", projectId], context?.previous);
      toast.error("Failed to delete column");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project_custom_columns", projectId] });
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
      const queryKey = ["project_custom_columns", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => (old as CustomColumn[])?.map(c => c.id === id ? { ...c, ...updates } : c));
      return { previous };
    },
    onError: (err, variables, context) => {
      if (isNetworkError(err)) return;
      queryClient.setQueryData(["project_custom_columns", projectId], context?.previous);
      toast.error("Failed to update column");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project_custom_columns", projectId] });
    }
  });

  const renameColumnMutation = useMutation({
    mutationFn: async ({ id, newName }: { id: string, newName: string }) => {
      if (!newName.trim() || !projectId) return;
      const oldCol = columns.find(c => c.id === id);
      if (!oldCol) return;
      const trimmed = newName.trim();
      if (trimmed === oldCol.name) return;

      const { error: updateError } = await supabase
        .from("custom_columns")
        .update({ name: trimmed } as { name: string })
        .eq("id", id);
      if (updateError) throw updateError;

      const { error: rpcError } = await supabase.rpc("rename_custom_column_key", {
        _project_id: projectId,
        _old_name: oldCol.name,
        _new_name: trimmed,
      });
      if (rpcError) throw rpcError;
    },
    onMutate: async ({ id, newName }) => {
      const queryKey = ["project_custom_columns", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => (old as CustomColumn[])?.map(c => c.id === id ? { ...c, name: newName } : c));
      return { previous };
    },
    onSuccess: () => {
      toast.success("Column renamed");
    },
    onError: (err: any, variables, context) => {
      if (isNetworkError(err)) {
        toast.info("Rename pending offline");
        return;
      }
      queryClient.setQueryData(["project_custom_columns", projectId], context?.previous);
      toast.error(err.message.includes("duplicate") ? "Column name already exists" : "Failed to rename column");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project_custom_columns", projectId] });
    }
  });

  const reorderColumnsMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!projectId) return;
      const updates = orderedIds.map((id, index) =>
        supabase.from("custom_columns").update({ sort_order: index } as { sort_order: number }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw firstError;
    },
    onMutate: async (orderedIds) => {
      const queryKey = ["project_custom_columns", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      
      const newOrder = orderedIds.map((id, index) => {
        const col = (previous as CustomColumn[]).find(c => c.id === id);
        return { ...col, sort_order: index } as CustomColumn;
      });
      
      queryClient.setQueryData(queryKey, newOrder);
      return { previous };
    },
    onError: (err, variables, context) => {
      if (isNetworkError(err)) return;
      queryClient.setQueryData(["project_custom_columns", projectId], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project_custom_columns", projectId] });
    }
  });

  const addColumn = useCallback((name: string, columnType: ColumnType = "numeric") => {
    if (!projectId || !name.trim()) return;
    addColumnMutation.mutate({ name, columnType });
  }, [projectId, addColumnMutation]);

  return { 
    columns, 
    loading, 
    addColumn,
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
      
      const newOrder = [...columns];
      const temp = newOrder[idx];
      newOrder[idx] = newOrder[swapIdx];
      newOrder[swapIdx] = temp;
      reorderColumnsMutation.mutate(newOrder.map(c => c.id));
    },
    reorderColumns: (orderedIds: string[]) => reorderColumnsMutation.mutate(orderedIds),
    renameColumn: (id: string, newName: string) => renameColumnMutation.mutate({ id, newName }),
    fetchColumns: () => queryClient.invalidateQueries({ queryKey: ["project_custom_columns", projectId] }),
  };
};
