import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import { useI18n } from "@/hooks/useI18n";

import { PWAInstructions } from "@/components/PWAInstructions";

const Index = () => {
  const { user, loading } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    console.log('Index: Component rendered', { user, loading });
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("auth.loading")}</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <>
      <Dashboard />
      <PWAInstructions />
    </>
  );
};

export default Index;
