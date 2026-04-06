import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface FontSizeContextType {
  fontSize: number;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

const STORAGE_KEY = "app-font-size-scale";
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.5;
const STEP = 0.1;

export const FontSizeProvider = ({ children }: { children: ReactNode }) => {
  const [fontSize, setFontSizeState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? parseFloat(stored) : 1.0;
    } catch {
      return 1.0;
    }
  });

  const setFontSize = useCallback((size: number) => {
    const roundedSize = Math.round(size * 10) / 10;
    const clampedSize = Math.max(MIN_SCALE, Math.min(MAX_SCALE, roundedSize));
    setFontSizeState(clampedSize);
    localStorage.setItem(STORAGE_KEY, clampedSize.toString());
    
    // Apply to document root
    document.documentElement.style.setProperty("--app-font-scale", clampedSize.toString());
    // Also adjust root font size to scale rem units
    document.documentElement.style.fontSize = `${clampedSize * 100}%`;
  }, []);

  useEffect(() => {
    // Initial apply
    document.documentElement.style.setProperty("--app-font-scale", fontSize.toString());
    document.documentElement.style.fontSize = `${fontSize * 100}%`;
  }, [fontSize]);

  const increaseFontSize = useCallback(() => {
    setFontSize(fontSize + STEP);
  }, [fontSize, setFontSize]);

  const decreaseFontSize = useCallback(() => {
    setFontSize(fontSize - STEP);
  }, [fontSize, setFontSize]);

  const resetFontSize = useCallback(() => {
    setFontSize(1.0);
  }, [setFontSize]);

  return (
    <FontSizeContext.Provider value={{ fontSize, increaseFontSize, decreaseFontSize, resetFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
};

export const useFontSize = () => {
  const ctx = useContext(FontSizeContext);
  if (!ctx) throw new Error("useFontSize must be used within FontSizeProvider");
  return ctx;
};
