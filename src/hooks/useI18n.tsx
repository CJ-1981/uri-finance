import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Locale, translations } from "@/lib/i18n";

interface I18nContextType {
  locale: Locale;
  language: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = "app-locale";

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return (stored === "en" ? "en" : "ko") as Locale;
    } catch {
      return "ko";
    }
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let template = translations[locale][key] || translations.en[key] || key;
      if (params) {
        Object.entries(params).forEach(([paramKey, value]) => {
          template = template.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
          // Also support ICU message format for plurals
          template = template.replace(
            new RegExp(`\\{${paramKey},\\s*plural,\\s*one\\s+\\{([^}]+)\\}\\s+other\\s+\\{([^}]+)\\}`, 'g'),
            value === 1 ? `$1` : `$2`
          );
        });
      }
      return template;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, language: locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
};
