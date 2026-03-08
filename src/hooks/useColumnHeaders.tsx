import { useState, useCallback } from "react";

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

const STORAGE_KEY_PREFIX = "tx-col-headers-";

export const useColumnHeaders = (projectId: string | undefined) => {
  const storageKey = projectId ? `${STORAGE_KEY_PREFIX}${projectId}` : null;

  const [headers, setHeaders] = useState<ColumnHeaders>(() => {
    if (!storageKey) return DEFAULT_HEADERS;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? { ...DEFAULT_HEADERS, ...JSON.parse(stored) } : DEFAULT_HEADERS;
    } catch {
      return DEFAULT_HEADERS;
    }
  });

  const updateHeader = useCallback(
    (key: keyof ColumnHeaders, value: string) => {
      setHeaders((prev) => {
        const next = { ...prev, [key]: value || DEFAULT_HEADERS[key] };
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const resetHeaders = useCallback(() => {
    setHeaders(DEFAULT_HEADERS);
    if (storageKey) localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { headers, updateHeader, resetHeaders, DEFAULT_HEADERS };
};
