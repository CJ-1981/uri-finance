import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export const useColumnHeaders = (projectId: string | undefined) => {
  const [headers, setHeaders] = useState<ColumnHeaders>(DEFAULT_HEADERS);
  const loadedProjectRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from DB only when projectId changes
  useEffect(() => {
    if (!projectId) {
      setHeaders(DEFAULT_HEADERS);
      loadedProjectRef.current = null;
      return;
    }
    if (loadedProjectRef.current === projectId) return;

    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("column_headers")
        .eq("id", projectId)
        .single();
      if (data?.column_headers && typeof data.column_headers === "object") {
        setHeaders({ ...DEFAULT_HEADERS, ...(data.column_headers as Partial<ColumnHeaders>) });
      } else {
        setHeaders(DEFAULT_HEADERS);
      }
      loadedProjectRef.current = projectId;
    })();
  }, [projectId]);

  const persistToDb = useCallback(
    (next: ColumnHeaders) => {
      if (!projectId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        supabase
          .from("projects")
          .update({ column_headers: next } as any)
          .eq("id", projectId)
          .then();
      }, 500);
    },
    [projectId]
  );

  const updateHeader = useCallback(
    (key: keyof ColumnHeaders, value: string) => {
      setHeaders((prev) => {
        const next = { ...prev, [key]: value || DEFAULT_HEADERS[key] };
        persistToDb(next);
        return next;
      });
    },
    [persistToDb]
  );

  const resetHeaders = useCallback(() => {
    setHeaders(DEFAULT_HEADERS);
    if (projectId) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      supabase
        .from("projects")
        .update({ column_headers: {} } as any)
        .eq("id", projectId)
        .then();
    }
  }, [projectId]);

  return { headers, updateHeader, resetHeaders, DEFAULT_HEADERS };
};
