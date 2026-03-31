import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ColumnHeaders {
  date: string;
  type: string;
  category: string;
  description: string;
  amount: string;
}

const DEFAULT_HEADERS: ColumnHeaders = {
  date: "Date",
  type: "Type",
  category: "Category",
  description: "Description",
  amount: "Amount",
};

const isNetError = (err: any) => {
  return !navigator.onLine || 
         err?.message?.includes("Failed to fetch") || 
         err?.message?.includes("Load failed") ||
         err?.message?.includes("TypeError") ||
         err?.status === 0;
};

export const useColumnHeaders = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: headers = DEFAULT_HEADERS, isLoading } = useQuery({
    queryKey: ["project_column_headers", projectId],
    queryFn: async () => {
      if (!projectId) return DEFAULT_HEADERS;
      const { data, error } = await supabase
        .from("projects")
        .select("column_headers")
        .eq("id", projectId)
        .single();
      
      if (error) throw error;

      return data?.column_headers && typeof data.column_headers === "object"
        ? { ...DEFAULT_HEADERS, ...(data.column_headers as Partial<ColumnHeaders>) }
        : DEFAULT_HEADERS;
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const [draft, setDraft] = useState<ColumnHeaders>(headers);
  const [dirty, setDirty] = useState(false);

  // Sync draft with headers when they load or change
  useEffect(() => {
    setDraft(headers);
    setDirty(false);
  }, [headers]);

  const updateDraft = useCallback((key: keyof ColumnHeaders, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (newHeaders: ColumnHeaders) => {
      if (!projectId) return;
      const { error } = await supabase
        .from("projects")
        .update({ column_headers: newHeaders } as { column_headers: ColumnHeaders })
        .eq("id", projectId);
      if (error) throw error;
    },
    onMutate: async (newHeaders) => {
      await queryClient.cancelQueries({ queryKey: ["project_column_headers", projectId] });
      const previous = queryClient.getQueryData(["project_column_headers", projectId]);
      queryClient.setQueryData(["project_column_headers", projectId], newHeaders);
      return { previous };
    },
    onSuccess: () => {
      toast.success("Headers updated!");
    },
    onError: (err, variables, context) => {
      if (isNetError(err)) return;
      queryClient.setQueryData(["project_column_headers", projectId], context?.previous);
      toast.error("Failed to save headers");
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ["project_column_headers", projectId] });
      }
    }
  });

  const saveHeaders = useCallback(async () => {
    const toSave: ColumnHeaders = { ...draft };
    for (const key of Object.keys(DEFAULT_HEADERS) as (keyof ColumnHeaders)[]) {
      if (!toSave[key].trim()) toSave[key] = DEFAULT_HEADERS[key];
    }
    saveMutation.mutate(toSave);
  }, [draft, saveMutation]);

  const resetHeaders = useCallback(async () => {
    saveMutation.mutate(DEFAULT_HEADERS);
  }, [saveMutation]);

  return { 
    headers, 
    draft, 
    dirty, 
    saving: saveMutation.isPending, 
    updateDraft, 
    saveHeaders, 
    resetHeaders, 
    DEFAULT_HEADERS 
  };
};
