import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserRole = "owner" | "admin" | "member" | "viewer";

export const useUserRole = (projectId?: string) => {
  const { user, isStandalone } = useAuth();
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);

  const { data: role = "member" as UserRole } = useQuery({
    queryKey: ["user_role", projectId, user?.id, isStandalone],
    queryFn: async () => {
      if (!projectId || !user || isStandalone || user.id === "standalone-user") {
        return "member" as UserRole;
      }
      const { data, error } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return (data.role as UserRole) || "member";
    },
    enabled: !!projectId && !!user,
    staleTime: 1000 * 60 * 30, // 30 minutes
    networkMode: "always",
  });

  // Reset simulation when project changes
  useEffect(() => {
    setSimulatedRole(null);
  }, [projectId]);

  const effectiveRole = simulatedRole ?? role;
  const isViewer = effectiveRole === "viewer";
  const isSimulating = simulatedRole !== null;

  return { role, effectiveRole, isViewer, isSimulating, simulatedRole, setSimulatedRole };
};
