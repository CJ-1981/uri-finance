import { useState, useEffect } from "react";

const STORAGE_KEY = "simulation_buttons_visible";

export function useSimulationVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setIsVisible(stored === "true");
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleVisibility = () => {
    setIsVisible((prev) => {
      const newValue = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(newValue));
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
  };

  return { isVisible, toggleVisibility };
}
