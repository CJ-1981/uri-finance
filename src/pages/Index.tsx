import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import { useI18n } from "@/hooks/useI18n";

import { PWAInstructions } from "@/components/PWAInstructions";

/**
 * Helper to detect authentication-related markers in the URL hash or search parameters.
 * These markers indicate that a session is being established (e.g., email confirmation or recovery).
 */
export const hasAuthMarkers = () => {
  return window.location.hash.includes("access_token=") || 
         window.location.search.includes("type=recovery") ||
         window.location.search.includes("code=");
};

const Index = () => {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    console.log('Index: Component rendered', { user, loading });
  }, [user, loading]);

  // @MX:NOTE: Fallback timeout for when URL auth markers are present but session fails to establish
  useEffect(() => {
    if (!user && !loading && hasAuthMarkers() && !timedOut) {
      const timer = setTimeout(() => {
        console.log('Index: Auth session establishment timed out, redirecting to auth page');
        setTimedOut(true);
      }, 20000); // 20 second timeout

      return () => clearTimeout(timer);
    }
  }, [user, loading, timedOut]);

  if (timedOut) {
    return <Navigate to="/auth" replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("auth.loading")}</div>
      </div>
    );
  }

  if (!user) {
    // @MX:ANCHOR: If the URL contains recovery info or an access token, 
    // DON'T redirect yet. Let the AuthProvider/Supabase client process it.
    if (hasAuthMarkers()) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="animate-pulse text-muted-foreground">{t("auth.loading")}</div>
        </div>
      );
    }

    return <Navigate to="/auth" replace />;
  }

  return (
    <>
      <Dashboard />
      <PWAInstructions />
    </>
  );
};

export default Index;
