import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserRole = "owner" | "admin" | "member" | "viewer";

export const useUserRole = (projectId?: string) => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>("member");

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

  const isViewer = role === "viewer";

  return { role, isViewer };
};
