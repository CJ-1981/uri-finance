import { useEffect, useCallback, useState } from "react";

const STORAGE_KEY = "keyboard_shortcuts";

interface ShortcutConfig {
  addTransaction: string;
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  addTransaction: "n",
};

export const getShortcuts = (): ShortcutConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_SHORTCUTS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_SHORTCUTS;
};

export const saveShortcuts = (shortcuts: ShortcutConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
};

export const useKeyboardShortcut = (
  action: keyof ShortcutConfig,
  callback: () => void,
  enabled = true
) => {
  const [key, setKey] = useState(() => getShortcuts()[action]);

  // Refresh key from storage periodically (for settings changes)
  useEffect(() => {
    const refresh = () => setKey(getShortcuts()[action]);
    window.addEventListener("storage", refresh);
    window.addEventListener("shortcut-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("shortcut-updated", refresh);
    };
  }, [action]);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (e.key.toLowerCase() === key.toLowerCase() && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        callback();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback, enabled]);

  return key;
};
