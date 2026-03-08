import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserRole = "owner" | "admin" | "member" | "viewer";

export const useUserRole = (projectId?: string) => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>("member");
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (!projectId || !user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .single();
      if (data) setRole((data.role as UserRole) || "member");
    };
    fetch();
  }, [projectId, user]);

  // Reset simulation when project changes
  useEffect(() => {
    setSimulatedRole(null);
  }, [projectId]);

  const effectiveRole = simulatedRole ?? role;
  const isViewer = effectiveRole === "viewer";
  const isSimulating = simulatedRole !== null;

  return { role, effectiveRole, isViewer, isSimulating, simulatedRole, setSimulatedRole };
};
