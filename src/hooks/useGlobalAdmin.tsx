import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Typed RPC function names for better type safety
type RpcFunctionName = "get_all_users" | "get_all_projects" | "admin_delete_user" | "admin_delete_project";

/**
 * Type-safe wrapper for Supabase RPC calls.
 * Provides centralized type safety and error handling for RPC functions.
 */
const callRpc = <T,>(fnName: RpcFunctionName, args?: Record<string, unknown>) => {
  return supabase.rpc(fnName, args);
};

export interface UserInfo {
  id: string;
  email: string;
  created_at: string;
  project_count: number;
  projects: Array<{ id: string; name: string }>;
}

export interface ProjectInfo {
  id: string;
  name: string;
  owner_email: string;
  member_count: number;
  transaction_count: number;
  created_at: string;
}

export const useGlobalAdmin = () => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllData = async () => {
    setLoading(true);
    const [usersResult, projectsResult] = await Promise.all([
      callRpc("get_all_users"),
      callRpc("get_all_projects")
    ]);
    setUsers((usersResult.data as UserInfo[]) || []);
    setProjects((projectsResult.data as ProjectInfo[]) || []);
    setLoading(false);
  };

  const removeUserFromAllProjects = async (userId: string) => {
    const { error } = await callRpc("admin_delete_user", { _user_id: userId });
    if (error) {
      toast.error("Failed to remove user");
      return false;
    }
    toast.success("User removed from all projects");
    await fetchAllData();
    return true;
  };

  const deleteProject = async (projectId: string, projectName: string) => {
    const { error } = await callRpc("admin_delete_project", { _project_id: projectId });
    if (error) {
      toast.error(`Failed to delete project: ${error.message}`);
      return false;
    }
    toast.success(`Project "${projectName}" deleted`);
    await fetchAllData();
    return true;
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  return { users, projects, loading, removeUserFromAllProjects, deleteProject, fetchAllData };
};
