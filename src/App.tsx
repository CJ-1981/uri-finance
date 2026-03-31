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

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryPersister } from "@/lib/offlineStorage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry if it's a 401/403 or if we are offline
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      networkMode: "offlineFirst",
      retry: 3,
    },
  },
});

// Configure persistence options
const persistOptions = {
  persister: queryPersister,
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
  buster: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : "1.0.0",
};

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
    const basename = import.meta.env.DEV ? "/" : "/uri-finance";
    let finalPath = savedPath;
    if (!import.meta.env.DEV && finalPath.startsWith(basename)) {
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
    const handleLock = () => {
      // Eagerly lock when the app is hidden or being backgrounded
      if (isPinSet()) {
        setLocked(true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        handleLock();
      }
    };

    // 'visibilitychange' is the standard for PWAs
    document.addEventListener("visibilitychange", handleVisibility);
    // 'pagehide' can be more reliable on some mobile browsers for capture prevention
    window.addEventListener("pagehide", handleLock);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handleLock);
    };
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
          <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
            <AuthProvider>
              <TooltipProvider>
                <ThemeMetaUpdater />
                <Toaster />
                <Sonner />
                <AppLockGate>
                  <BrowserRouter basename={import.meta.env.DEV ? "/" : "/uri-finance"} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
          </PersistQueryClientProvider>
        </ErrorBoundary>
      </I18nProvider>
    </ThemeProvider>
  );
};

export default App;
