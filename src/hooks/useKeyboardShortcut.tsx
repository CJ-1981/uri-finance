import { useEffect, useState } from "react";

const STORAGE_KEY = "keyboard_shortcuts";

export interface ShortcutConfig {
  addTransaction: string;
  prevTransaction: string;
  nextTransaction: string;
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  addTransaction: "n",
  prevTransaction: "k",
  nextTransaction: "j",
};

export const SHORTCUT_LABELS: Record<keyof ShortcutConfig, string> = {
  addTransaction: "shortcut.addTransaction",
  prevTransaction: "shortcut.prevTransaction",
  nextTransaction: "shortcut.nextTransaction",
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

/**
 * Hook for arrow-key navigation inside detail sheets.
 * Listens for ArrowLeft/ArrowRight when no input is focused.
 */
export const useArrowNavigation = (
  onPrev: () => void,
  onNext: () => void,
  enabled = true
) => {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPrev, onNext, enabled]);
};
