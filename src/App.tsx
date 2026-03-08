import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/hooks/useI18n";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminPage from "./pages/AdminPage";
import LockScreen from "@/components/LockScreen";

const queryClient = new QueryClient();

const AppLockGate = ({ children }: { children: React.ReactNode }) => {
  const hasPin = !!localStorage.getItem("app_lock_pin");
  const [locked, setLocked] = useState(hasPin);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") return;
      // Re-lock when coming back if PIN is set
      if (localStorage.getItem("app_lock_pin")) {
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

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppLockGate>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </AppLockGate>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </I18nProvider>
  </ThemeProvider>
);

export default App;
