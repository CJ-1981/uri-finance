import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

/**
 * Component that handles iOS status bar color updates.
 *
 * iOS Safari has a fundamental limitation where status bar meta tags are cached
 * when the app launches and don't respond to dynamic changes. The only reliable
 * solution is to reload the page when the theme changes.
 *
 * This component:
 * 1. Detects theme changes
 * 2. Updates meta tags (for non-iOS browsers)
 * 3. Shows loading spinner during transition
 * 4. Reloads the page on iOS to force status bar update
 * 5. Preserves theme preference via localStorage (handled by next-themes)
 */
export const ThemeMetaUpdater = () => {
  const { theme, systemTheme } = useTheme();
  const { t } = useI18n();
  const previousThemeRef = useRef<string | undefined>();
  const isInitialMountRef = useRef(true);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    // Skip on initial mount - don't reload when app first loads
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      previousThemeRef.current = theme === "system" ? systemTheme : theme;
      return;
    }

    // Determine the actual theme being used
    const currentTheme = theme === "system" ? systemTheme : theme;

    // Skip if theme hasn't actually changed
    if (currentTheme === previousThemeRef.current) {
      return;
    }

    previousThemeRef.current = currentTheme;

    // Check if this is an iOS device
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes("Mac") && "ontouchend" in document);

    // Map theme to background color (matching CSS --background values)
    // Light: 210 20% 98% -> #f8fafc
    // Dark: 220 20% 7% -> #121212
    const themeColor = currentTheme === "dark" ? "#121212" : "#f8fafc";

    // Update theme-color meta tag (works on non-iOS browsers)
    const existingThemeColorTags = document.querySelectorAll('meta[name="theme-color"]');
    existingThemeColorTags.forEach(tag => tag.remove());

    const metaTag = document.createElement("meta");
    metaTag.setAttribute("name", "theme-color");
    metaTag.setAttribute("content", themeColor);
    document.head.appendChild(metaTag);

    // On iOS, we need to reload the page to update the status bar
    if (isIOS) {
      // Show loading spinner
      setIsReloading(true);

      // Update apple-mobile-web-app-status-bar-style meta tag
      const statusMetaTag = document.querySelector(
        'meta[name="apple-mobile-web-app-status-bar-style"]'
      );

      if (statusMetaTag) {
        const statusBarStyle = currentTheme === "dark" ? "black-translucent" : "default";
        statusMetaTag.setAttribute("content", statusBarStyle);
      }

      // Reload the page after a short delay to allow UI to update
      // next-themes automatically saves theme to localStorage, so it will be preserved
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }, [theme, systemTheme]);

  if (!isReloading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("auth.updatingTheme")}</p>
      </div>
    </div>
  );
};
