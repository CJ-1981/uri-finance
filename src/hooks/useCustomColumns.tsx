import { useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isNetworkError } from "@/lib/networkUtils";
import { useAuth } from "@/hooks/useAuth";

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
  const { isStandalone } = useAuth();
  const queryClient = useQueryClient();

  const COLUMNS_KEY = ["project_custom_columns", projectId];
  const LOCAL_COLUMNS_KEY = `local_custom_columns_${projectId}`;

  const { data: columns = [], isLoading: loading } = useQuery({
    queryKey: COLUMNS_KEY,
    queryFn: async () => {
      if (!projectId) return [];

      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_COLUMNS_KEY);
        return local ? JSON.parse(local) : [];
      }

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
    mutationKey: ["addColumn", projectId],
    mutationFn: async ({ id, name, columnType }: { id: string, name: string, columnType: ColumnType }) => {
      const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.sort_order)) : -1;

      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_COLUMNS_KEY);
        const existing: CustomColumn[] = local ? JSON.parse(local) : [];
        const newCol: CustomColumn = {
          id,
          project_id: projectId!,
          name: name.trim(),
          column_type: columnType,
          masked: false,
          required: false,
          sort_order: maxOrder + 1,
          suggestions: [],
          suggestion_colors: {},
          created_at: new Date().toISOString(),
        };
        localStorage.setItem(LOCAL_COLUMNS_KEY, JSON.stringify([...existing, newCol]));
        return;
      }

      const { error } = await supabase
        .from("custom_columns")
        .insert({ 
          id,
          project_id: projectId, 
          name: name.trim(), 
          column_type: columnType, 
          sort_order: maxOrder + 1 
        } as Partial<CustomColumn>);
      if (error) throw error;
    },
    onMutate: async ({ id, name, columnType }) => {
      await queryClient.cancelQueries({ queryKey: COLUMNS_KEY });
      const previous = queryClient.getQueryData(COLUMNS_KEY);
      const optimistic: CustomColumn = {
        id,
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
      queryClient.setQueryData(COLUMNS_KEY, (old: any) => [...(old || []), optimistic]);
      return { previous };
    },
    onSuccess: () => {
      toast.success("Column added");
    },
    onError: (err: any, variables, context) => {
      if (isNetworkError(err)) {
        toast.info("Column saved offline");
        return;
      }
      queryClient.setQueryData(COLUMNS_KEY, context?.previous);
      toast.error(err.message?.includes("duplicate") ? "Column already exists" : "Failed to add column");
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        queryClient.invalidateQueries({ queryKey: COLUMNS_KEY });
      }
    }
  });

  const deleteColumnMutation = useMutation({
    mutationKey: ["deleteColumn", projectId],
    mutationFn: async (id: string) => {
      const col = columns.find(c => c.id === id);
      if (!col || !projectId) return;

      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_COLUMNS_KEY);
        const existing: CustomColumn[] = local ? JSON.parse(local) : [];
        const updated = existing.filter(c => c.id !== id);
        localStorage.setItem(LOCAL_COLUMNS_KEY, JSON.stringify(updated));
        return;
      }

      const { error: deleteError } = await supabase.from("custom_columns").delete().eq("id", id);
      if (deleteError) throw deleteError;

      const { error: rpcError } = await supabase.rpc("remove_custom_column_key", {
        _project_id: projectId,
        _column_name: col.name,
      });
      if (rpcError) throw rpcError;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: COLUMNS_KEY });
      const previous = queryClient.getQueryData(COLUMNS_KEY);
      queryClient.setQueryData(COLUMNS_KEY, (old: any) => (old as CustomColumn[])?.filter(c => c.id !== id));
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
      queryClient.setQueryData(COLUMNS_KEY, context?.previous);
      toast.error("Failed to delete column");
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        queryClient.invalidateQueries({ queryKey: COLUMNS_KEY });
      }
    }
  });

  const updateColumnMutation = useMutation({
    mutationKey: ["updateColumn", projectId],
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<CustomColumn> }) => {
      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_COLUMNS_KEY);
        const existing: CustomColumn[] = local ? JSON.parse(local) : [];
        const updated = existing.map(c => c.id === id ? { ...c, ...updates } : c);
        localStorage.setItem(LOCAL_COLUMNS_KEY, JSON.stringify(updated));
        return;
      }

      const { error } = await supabase
        .from("custom_columns")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: COLUMNS_KEY });
      const previous = queryClient.getQueryData(COLUMNS_KEY);
      queryClient.setQueryData(COLUMNS_KEY, (old: any) => (old as CustomColumn[])?.map(c => c.id === id ? { ...c, ...updates } : c));
      return { previous };
    },
    onError: (err, variables, context) => {
      if (isNetworkError(err)) {
        toast.info("Update saved offline");
        return;
      }
      queryClient.setQueryData(COLUMNS_KEY, context?.previous);
      toast.error("Failed to update column");
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        queryClient.invalidateQueries({ queryKey: COLUMNS_KEY });
      }
    }
  });

  const renameColumnMutation = useMutation({
    mutationKey: ["renameColumn", projectId],
    mutationFn: async ({ id, newName }: { id: string, newName: string }) => {
      const oldCol = columns.find(c => c.id === id);
      if (!oldCol || !projectId) return;
      const trimmed = newName.trim();

      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_COLUMNS_KEY);
        const existing: CustomColumn[] = local ? JSON.parse(local) : [];
        const updated = existing.map(c => c.id === id ? { ...c, name: trimmed } : c);
        localStorage.setItem(LOCAL_COLUMNS_KEY, JSON.stringify(updated));
        return;
      }

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
      await queryClient.cancelQueries({ queryKey: COLUMNS_KEY });
      const previous = queryClient.getQueryData(COLUMNS_KEY);
      queryClient.setQueryData(COLUMNS_KEY, (old: any) => (old as CustomColumn[])?.map(c => c.id === id ? { ...c, name: newName } : c));
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
      queryClient.setQueryData(COLUMNS_KEY, context?.previous);
      toast.error(err.message?.includes("duplicate") ? "Column name already exists" : "Failed to rename column");
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        queryClient.invalidateQueries({ queryKey: COLUMNS_KEY });
      }
    }
  });

  const reorderColumnsMutation = useMutation({
    mutationKey: ["reorderColumns", projectId],
    mutationFn: async (orderedIds: string[]) => {
      if (!projectId) return;

      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_COLUMNS_KEY);
        const existing: CustomColumn[] = local ? JSON.parse(local) : [];
        const updated = existing.map(c => {
          const newIdx = orderedIds.indexOf(c.id);
          if (newIdx !== -1) return { ...c, sort_order: newIdx };
          return c;
        });
        localStorage.setItem(LOCAL_COLUMNS_KEY, JSON.stringify(updated));
        return;
      }

      const updates = orderedIds.map((id, index) =>
        supabase.from("custom_columns").update({ sort_order: index } as { sort_order: number }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw firstError;
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: COLUMNS_KEY });
      const previous = queryClient.getQueryData(COLUMNS_KEY);
      
      const newOrder = orderedIds.map((id, index) => {
        const col = (previous as CustomColumn[]).find(c => c.id === id);
        return { ...col, sort_order: index } as CustomColumn;
      });
      
      queryClient.setQueryData(COLUMNS_KEY, newOrder);
      return { previous };
    },
    onError: (err, variables, context) => {
      if (isNetworkError(err)) return;
      queryClient.setQueryData(COLUMNS_KEY, context?.previous);
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        queryClient.invalidateQueries({ queryKey: COLUMNS_KEY });
      }
    }
  });

  const addColumn = useCallback((name: string, columnType: ColumnType = "numeric") => {
    if (!projectId || !name.trim()) return;
    // Client-side validation: avoid duplicates
    if (columns.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
      toast.error("Column name already exists");
      return;
    }
    const id = crypto.randomUUID();
    addColumnMutation.mutate({ id, name, columnType });
  }, [projectId, addColumnMutation, columns]);

  const renameColumn = useCallback((id: string, newName: string) => {
    if (!id || !newName.trim() || !projectId) return;
    const oldCol = columns.find(c => c.id === id);
    if (!oldCol) return;
    const trimmed = newName.trim();
    if (trimmed === oldCol.name) return;
    
    // Client-side validation: avoid duplicates
    if (columns.some(c => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Column name already exists");
      return;
    }
    
    renameColumnMutation.mutate({ id, newName: trimmed });
  }, [projectId, renameColumnMutation, columns]);

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
      
      const newIds = [...columns.map(c => c.id)];
      const temp = newIds[idx];
      newIds[idx] = newIds[swapIdx];
      newIds[swapIdx] = temp;
      reorderColumnsMutation.mutate(newIds);
    },
    reorderColumns: (orderedIds: string[]) => reorderColumnsMutation.mutate(orderedIds),
    renameColumn,
    fetchColumns: () => queryClient.invalidateQueries({ queryKey: COLUMNS_KEY }), 
  };
};
