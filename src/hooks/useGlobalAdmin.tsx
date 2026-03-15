import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      supabase.rpc("get_all_users" as any),
      supabase.rpc("get_all_projects" as any)
    ]);
    setUsers((usersResult.data as UserInfo[]) || []);
    setProjects((projectsResult.data as ProjectInfo[]) || []);
    setLoading(false);
  };

  const removeUserFromAllProjects = async (userId: string) => {
    const { error } = await supabase.rpc("admin_delete_user" as any, { _user_id: userId });
    if (error) {
      toast.error("Failed to remove user");
      return false;
    }
    toast.success("User removed from all projects");
    await fetchAllData();
    return true;
  };

  const deleteProject = async (projectId: string, projectName: string) => {
    const { error } = await supabase.rpc("admin_delete_project" as any, { _project_id: projectId });
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
