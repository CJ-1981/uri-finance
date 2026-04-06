import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";

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
  const location = useLocation();
  const isAuthPage = location.pathname.endsWith('/auth') || location.pathname.endsWith('/auth/');

  const [fontSize, setFontSizeState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? parseFloat(stored) : 1.0;
      // Ensure we have a valid, finite number within range
      if (isNaN(parsed) || !isFinite(parsed)) return 1.0;
      return Math.max(MIN_SCALE, Math.min(MAX_SCALE, parsed));
    } catch {
      return 1.0;
    }
  });

  const setFontSize = useCallback((size: number) => {
    // @MX:NOTE: Disable font size changes on the auth page to maintain design consistency
    if (isAuthPage) return;

    const roundedSize = Math.round(size * 10) / 10;
    const clampedSize = Math.max(MIN_SCALE, Math.min(MAX_SCALE, roundedSize));
    
    setFontSizeState(clampedSize);
    
    try {
      localStorage.setItem(STORAGE_KEY, clampedSize.toString());
    } catch (err) {
      console.warn('[useFontSize] Failed to persist font size:', err);
    }
    
    // @MX:NOTE: Apply font scale to document root. 
    // This scales all rem units throughout the app.
    document.documentElement.style.setProperty("--app-font-scale", clampedSize.toString());
    
    // @MX:WARN: Direct root font-size modification
    // @MX:REASON: Required to scale all 'rem' units globally without changing every component.
    document.documentElement.style.fontSize = `${clampedSize * 100}%`;
  }, [isAuthPage]);

  useEffect(() => {
    // @MX:NOTE: Force 1.0 on auth page, otherwise use stored size
    // This is reactive to location changes thanks to useLocation()
    const scale = isAuthPage ? 1.0 : fontSize;

    document.documentElement.style.setProperty("--app-font-scale", scale.toString());
    document.documentElement.style.fontSize = `${scale * 100}%`;
  }, [fontSize, isAuthPage]);

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
