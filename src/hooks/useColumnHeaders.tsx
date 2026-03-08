import { useState, useCallback, useEffect } from "react";
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

  // Load from DB
  useEffect(() => {
    if (!projectId) {
      setHeaders(DEFAULT_HEADERS);
      return;
    }
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
    })();
  }, [projectId]);

  const updateHeader = useCallback(
    (key: keyof ColumnHeaders, value: string) => {
      setHeaders((prev) => {
        const next = { ...prev, [key]: value || DEFAULT_HEADERS[key] };
        if (projectId) {
          supabase
            .from("projects")
            .update({ column_headers: next } as any)
            .eq("id", projectId)
            .then();
        }
        return next;
      });
    },
    [projectId]
  );

  const resetHeaders = useCallback(() => {
    setHeaders(DEFAULT_HEADERS);
    if (projectId) {
      supabase
        .from("projects")
        .update({ column_headers: {} } as any)
        .eq("id", projectId)
        .then();
    }
  }, [projectId]);

  return { headers, updateHeader, resetHeaders, DEFAULT_HEADERS };
};
