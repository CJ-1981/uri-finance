import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  invite_code: string;
  currency: string;
  created_at: string;
}

export const useProjects = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  // Initialize activeProject from localStorage cache to prevent flicker
  const [activeProject, setActiveProject] = useState<Project | null>(() => {
    try {
      const cached = localStorage.getItem("active_project_cache");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // Persist selected project to localStorage (cache full object for instant restoration)
  const handleSetActiveProject = (project: Project | null) => {
    if (project) {
      localStorage.setItem("active_project_id", project.id);
      localStorage.setItem("active_project_cache", JSON.stringify(project));
    } else {
      localStorage.removeItem("active_project_id");
      localStorage.removeItem("active_project_cache");
    }
    setActiveProject(project);
  };

  const fetchProjects = async (skipDelay = false) => {
    if (!user) return;
    // Add delay to allow RLS to see newly created memberships
    if (!skipDelay) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.id);

    if (memberships && memberships.length > 0) {
      const ids = memberships.map((m) => m.project_id);
      const { data } = await supabase
        .from("projects")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
      setProjects((data as Project[]) || []);

      // Restore active project from localStorage, or fall back to first project
      if (data && data.length > 0) {
        const savedProjectId = localStorage.getItem("active_project_id");
        if (savedProjectId) {
          const savedProject = data.find((p) => p.id === savedProjectId);
          if (savedProject) {
            handleSetActiveProject(savedProject as Project);
          } else {
            // Saved project no longer exists, fall back to first project
            handleSetActiveProject(data[0] as Project);
          }
        } else {
          // No saved project, use first project
          handleSetActiveProject(data[0] as Project);
        }
      }
    } else {
      setProjects([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const createProject = async (name: string, description?: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("projects")
      .insert({ name, description, owner_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create project");
      return;
    }

    // Add owner as member
    await supabase
      .from("project_members")
      .insert({ project_id: data.id, user_id: user.id, role: "owner" });

    toast.success("Project created!");
    await fetchProjects();
    handleSetActiveProject(data as Project);
  };

  const joinProject = async (inviteCode: string) => {
    if (!user) return;

    // Look up invite code in project_invites table
    const { data: invite } = await supabase
      .from("project_invites")
      .select("*")
      .eq("code", inviteCode.trim())
      .is("used_by", null)
      .single();

    if (!invite) {
      // Fallback: try legacy invite_code on projects table
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("invite_code", inviteCode.trim())
        .single();

      if (!project) {
        // Clear invalid pending invite code from localStorage
        localStorage.removeItem("pending_invite_code");
        toast.error("Invalid or already used invite code");
        return;
      }

      // Check if banned
      const { data: ban } = await supabase
        .from("project_bans")
        .select("id")
        .eq("project_id", project.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (ban) {
        // Clear invalid pending invite code from localStorage
        localStorage.removeItem("pending_invite_code");
        toast.error("You have been banned from this project.");
        return;
      }

      const { error } = await supabase
        .from("project_members")
        .insert({ project_id: project.id, user_id: user.id });

      if (error) {
        if (error.code === "23505") {
          toast.info("You're already a member of this project");
        } else {
          toast.error("Failed to join project");
        }
        return;
      }

      // Wait for RLS to see the new membership
      await new Promise(resolve => setTimeout(resolve, 200));

      toast.success(t("proj.joined").replace("{project}", project.name));
      await fetchProjects(true); // skip delay since we already waited
      handleSetActiveProject(project as Project);
      return;
    }

    // New invite system
    const projectId = (invite as any).project_id;
    const inviteEmail = (invite as any).email;
    const inviteRole = (invite as any).role || "member";

    // Validate email if invite is email-locked
    if (inviteEmail) {
      const { data: sessionData } = await supabase.auth.getSession();
      const userEmail = sessionData.session?.user?.email?.toLowerCase();
      if (userEmail !== inviteEmail.toLowerCase()) {
        // Clear invalid pending invite code from localStorage
        localStorage.removeItem("pending_invite_code");
        toast.error("This invite code is assigned to a different email address.");
        return;
      }
    }

    // Check if banned
    const { data: ban } = await supabase
      .from("project_bans")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ban) {
      // Clear invalid pending invite code from localStorage
      localStorage.removeItem("pending_invite_code");
      toast.error("You have been banned from this project.");
      return;
    }

    // Mark invite as used
    await supabase
      .from("project_invites")
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq("id", (invite as any).id);

    // Join project with the assigned role
    const { error } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: user.id, role: inviteRole });

    if (error) {
      if (error.code === "23505") {
        toast.info("You're already a member of this project");
      } else {
        toast.error("Failed to join project");
      }
      return;
    }

    // Wait for RLS to see the new membership
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get project info for toast (query project_id from invites which bypasses RLS)
    const { data: project } = await supabase
      .from("project_invites")
      .select("projects!inner(*)")
      .eq("id", (invite as any).id)
      .single();

    const projectName = (project as any)?.projects?.name;
    if (projectName) {
      toast.success(t("proj.joined").replace("{project}", projectName));
    }
    await fetchProjects(true); // skip delay since we already waited
    if (project) {
      handleSetActiveProject((project as any).projects as Project);
    }
  };

  // Clear project cache helper function
  const clearProjectCache = () => {
    localStorage.removeItem("active_project_id");
    localStorage.removeItem("active_project_cache");
  };

  // Validate cached project membership on mount to prevent security leak
  useEffect(() => {
    const validateCache = async () => {
      if (!user || !activeProject) return;

      // Verify user is still a member of cached project
      const { data: membership } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", activeProject.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership) {
        // Clear invalid cache and set activeProject to null
        clearProjectCache();
        setActiveProject(null);
      }
    };

    validateCache();
  }, [user]);

  const deleteProject = async (projectId: string): Promise<boolean> => {
    if (!user) return false;

    // Verify ownership before deletion
    const { data: project } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();

    if (!project || project.owner_id !== user.id) {
      toast.error("Only project owner can delete the project");
      return false;
    }

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      toast.error("Failed to delete project");
      return false;
    }

    // Clear cache if deleting active project
    if (activeProject?.id === projectId) {
      clearProjectCache();
      setActiveProject(null);
    }

    toast.success("Project deleted successfully");
    await fetchProjects(true);
    return true;
  };

  return {
    projects,
    loading,
    activeProject,
    setActiveProject: handleSetActiveProject,
    createProject,
    joinProject,
    fetchProjects,
    clearProjectCache,
    deleteProject
  };
};
