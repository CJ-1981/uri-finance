import { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/hooks/useI18n";
import { usePreventZoom } from "@/hooks/usePreventZoom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";
import AdminPage from "./pages/AdminPage";
import GlobalAdminPage from "./pages/GlobalAdminPage";
import LockScreen from "@/components/LockScreen";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeMetaUpdater } from "@/components/ThemeMetaUpdater";
import { isPinSet } from "@/lib/securePinStorage";

const queryClient = new QueryClient();

// GitHub Pages SPA routing: Restore route from 404.html redirect
const RouteRestoration = () => {
  const navigate = useNavigate();
  const isRestoring = useRef(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Guard against duplicate execution (e.g., React Strict Mode)
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    const sessionKey = "redirect-path";
    const savedPath = sessionStorage.getItem(sessionKey);

    // Prevent infinite navigation loops
    if (isRestoring.current || !savedPath || savedPath === "/") {
      return;
    }

    isRestoring.current = true;

    // Clear saved path and navigate
    sessionStorage.removeItem(sessionKey);

    // Ensure we strip the basename from the path before navigating internally
    const basename = "/uri-finance";
    let finalPath = savedPath;
    if (finalPath.startsWith(basename)) {
      finalPath = finalPath.slice(basename.length);
    }
    // Ensure it starts with /
    if (!finalPath.startsWith("/")) {
      finalPath = "/" + finalPath;
    }

    console.log('App: Restoring route to', finalPath);
    navigate(finalPath, { replace: true });

    // Mark restoration as complete after a delay
    setTimeout(() => {
      isRestoring.current = false;
    }, 100);
  }, []); // Empty deps - run once on mount

  return null;
};

const AppLockGate = ({ children }: { children: React.ReactNode }) => {
  const hasPin = isPinSet();
  const [locked, setLocked] = useState(hasPin);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") return;
      // Re-lock when coming back if PIN is set
      if (isPinSet()) {
        setLocked(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  if (locked && hasPin) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }
  return <>{children}</>;
};

const App = () => {
  usePreventZoom();

  useEffect(() => {
    console.log('App: Component mounted');
    // Add global error handler
    const handleError = (event: ErrorEvent) => {
      console.error('App: Global error caught', event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <I18nProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <TooltipProvider>
                <ThemeMetaUpdater />
                <Toaster />
                <Sonner />
                <AppLockGate>
                  <BrowserRouter basename="/uri-finance" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <RouteRestoration />
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />
                      <Route path="/admin" element={<AdminPage />} />
                      <Route path="/global-admin" element={<GlobalAdminPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </BrowserRouter>
                </AppLockGate>
              </TooltipProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </I18nProvider>
    </ThemeProvider>
  );
};

export default App;
