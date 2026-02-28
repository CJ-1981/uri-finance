import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return <Dashboard />;
};

export default Index;
