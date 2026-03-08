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
  const [draft, setDraft] = useState<ColumnHeaders>(DEFAULT_HEADERS);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadedProjectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setHeaders(DEFAULT_HEADERS);
      setDraft(DEFAULT_HEADERS);
      setDirty(false);
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
      const loaded = data?.column_headers && typeof data.column_headers === "object"
        ? { ...DEFAULT_HEADERS, ...(data.column_headers as Partial<ColumnHeaders>) }
        : DEFAULT_HEADERS;
      setHeaders(loaded);
      setDraft(loaded);
      setDirty(false);
      loadedProjectRef.current = projectId;
    })();
  }, [projectId]);

  const updateDraft = useCallback((key: keyof ColumnHeaders, value: string) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
    setDirty(true);
  }, []);

  const saveHeaders = useCallback(async () => {
    if (!projectId) return;
    setSaving(true);
    // Replace empty strings with defaults before saving
    const toSave: ColumnHeaders = { ...draft };
    for (const key of Object.keys(DEFAULT_HEADERS) as (keyof ColumnHeaders)[]) {
      if (!toSave[key].trim()) toSave[key] = DEFAULT_HEADERS[key];
    }
    await supabase
      .from("projects")
      .update({ column_headers: toSave } as any)
      .eq("id", projectId);
    setHeaders(toSave);
    setDraft(toSave);
    setDirty(false);
    setSaving(false);
  }, [projectId, draft]);

  const resetHeaders = useCallback(async () => {
    setDraft(DEFAULT_HEADERS);
    setHeaders(DEFAULT_HEADERS);
    setDirty(false);
    if (projectId) {
      await supabase
        .from("projects")
        .update({ column_headers: {} } as any)
        .eq("id", projectId);
    }
  }, [projectId]);

  return { headers, draft, dirty, saving, updateDraft, saveHeaders, resetHeaders, DEFAULT_HEADERS };
};
