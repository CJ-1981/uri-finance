import { useEffect, useState } from "react";

const STORAGE_KEY = "keyboard_shortcuts";

export interface ShortcutConfig {
  addTransaction: string;
  addTransactionAlt: string;
  tabList: string;
  tabCharts: string;
  tabCash: string;
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  addTransaction: "n",
  addTransactionAlt: "ㅜ",
  tabList: "1",
  tabCharts: "2",
  tabCash: "3",
};

export const SHORTCUT_LABELS: Record<keyof ShortcutConfig, string> = {
  addTransaction: "shortcut.addTransaction",
  addTransactionAlt: "shortcut.addTransactionAlt",
  tabList: "shortcut.tabList",
  tabCharts: "shortcut.tabCharts",
  tabCash: "shortcut.tabCash",
};

export const getShortcuts = (): ShortcutConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_SHORTCUTS, ...JSON.parse(stored) };
  } catch { }
  return DEFAULT_SHORTCUTS;
};

export const saveShortcuts = (shortcuts: ShortcutConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
};

export const useKeyboardShortcut = (
  action: keyof ShortcutConfig,
  callback: () => void,
  enabled = true,
  /** Also listen for this alternate action's key */
  altAction?: keyof ShortcutConfig
) => {
  const [keys, setKeys] = useState(() => {
    const s = getShortcuts();
    return { primary: s[action], alt: altAction ? s[altAction] : "" };
  });

  useEffect(() => {
    const refresh = () => {
      const s = getShortcuts();
      setKeys({ primary: s[action], alt: altAction ? s[altAction] : "" });
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("shortcut-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("shortcut-updated", refresh);
    };
  }, [action, altAction]);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const pressed = e.key.toLowerCase();
      const matches =
        (keys.primary && pressed === keys.primary.toLowerCase()) ||
        (keys.alt && pressed === keys.alt.toLowerCase());

      if (matches && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        callback();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keys, callback, enabled]);

  return keys.primary;
};
