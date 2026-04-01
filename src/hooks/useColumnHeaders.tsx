import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

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
  const { isStandalone } = useAuth();
  const queryClient = useQueryClient();

  const HEADERS_KEY = ["project_column_headers", projectId];
  const LOCAL_HEADERS_KEY = `local_column_headers_${projectId}`;

  const { data: headers = DEFAULT_HEADERS, isLoading } = useQuery({
    queryKey: HEADERS_KEY,
    queryFn: async () => {
      if (!projectId) return DEFAULT_HEADERS;

      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_HEADERS_KEY);
        return local ? JSON.parse(local) : DEFAULT_HEADERS;
      }

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
    networkMode: "always",
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

      if (isStandalone) {
        localStorage.setItem(LOCAL_HEADERS_KEY, JSON.stringify(newHeaders));
        return;
      }

      const { error } = await supabase
        .from("projects")
        .update({ column_headers: newHeaders } as { column_headers: ColumnHeaders })
        .eq("id", projectId);
      if (error) throw error;
    },
    onMutate: async (newHeaders) => {
      await queryClient.cancelQueries({ queryKey: HEADERS_KEY });
      const previous = queryClient.getQueryData(HEADERS_KEY);
      queryClient.setQueryData(HEADERS_KEY, newHeaders);
      return { previous };
    },
    onSuccess: () => {
      toast.success("Headers updated!");
    },
    onError: (err, variables, context) => {
      if (isNetError(err)) return;
      queryClient.setQueryData(HEADERS_KEY, context?.previous);
      toast.error("Failed to save headers");
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        queryClient.invalidateQueries({ queryKey: HEADERS_KEY });
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
