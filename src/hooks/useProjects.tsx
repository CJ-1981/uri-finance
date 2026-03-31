import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";
import { useSystemAdmin } from "@/hooks/useSystemAdmin";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  invite_code: string;
  currency: string;
  created_at: string;
}

type ProjectSource = 'user-selection' | 'cache' | 'server';

export const useProjects = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const { isSystemAdmin } = useSystemAdmin();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  // Initialize activeProject from localStorage cache
  const [activeProject, setActiveProject] = useState<Project | null>(() => {
    try {
      const cached = localStorage.getItem("active_project_cache");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // Query: Fetch all projects user is member of
  const { data: projects = [], isLoading: loading } = useQuery({
    queryKey: ["user_projects", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: memberships, error: memError } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", user.id);

      if (memError) throw memError;
      if (!memberships || memberships.length === 0) return [];

      const ids = memberships.map((m) => m.project_id);
      const { data, error: projError } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false })
        .in("id", ids);

      if (projError) throw projError;
      return data as Project[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  // Revalidate cached project against current user and fetched projects
  const validateProject = useCallback((project: Project | null): Project | null => {
    if (!project || projects.length === 0) return project;
    const found = projects.find(p => p.id === project.id);
    if (!found) {
      console.warn("[useProjects] Active project is invalid or belongs to another user. Clearing cache.");
      localStorage.removeItem("active_project_id");
      localStorage.removeItem("active_project_cache");
      return null;
    }
    return found;
  }, [projects]);

  // Persist selected project to localStorage and server
  const handleSetActiveProject = useCallback((project: Project | null, source: ProjectSource = 'user-selection'): void => {
    const validated = source === 'cache' ? validateProject(project) : project;
    
    if (validated) {
      localStorage.setItem("active_project_id", validated.id);
      localStorage.setItem("active_project_cache", JSON.stringify(validated));
      
      // Save preference to server if online and explicitly selected by user
      if (isOnline && user && source === 'user-selection') {
        supabase.from('user_preferences').upsert({
          user_id: user.id,
          default_project_id: validated.id
        }, { onConflict: 'user_id' }).then(({ error }) => {
          if (error) console.debug('Failed to save preference:', error);
        });
      }
    } else if (project === null || validated === null) {
      localStorage.removeItem("active_project_id");
      localStorage.removeItem("active_project_cache");
      if (isOnline && user) {
        supabase.from('user_preferences').update({ default_project_id: null }).eq('user_id', user.id).then(({ error }) => {
          if (error) console.debug('Failed to clear preference:', error);
        });
      }
    }
    setActiveProject(validated);
  }, [isOnline, user, validateProject]);

  // Restore logic: Ensure activeProject is set and valid
  useEffect(() => {
    if (!loading && projects.length > 0) {
      if (!activeProject) {
        const cachedId = localStorage.getItem("active_project_id");
        const found = projects.find(p => p.id === cachedId) || projects[0];
        handleSetActiveProject(found, 'cache');
      } else {
        // Revalidate existing active project
        const validated = validateProject(activeProject);
        if (!validated) {
          handleSetActiveProject(projects[0], 'cache');
        }
      }
    }
  }, [loading, projects, activeProject, handleSetActiveProject, validateProject]);

  const createProject = async (name: string, description?: string) => {
    if (!user || !isSystemAdmin) {
      toast.error("Only system administrators can create projects");
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({ name, description, owner_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create project");
      return;
    }

    await supabase
      .from("project_members")
      .insert({ project_id: data.id, user_id: user.id, role: "owner" });

    toast.success("Project created!");
    queryClient.invalidateQueries({ queryKey: ["user_projects", user.id] });
    handleSetActiveProject(data as Project, 'user-selection');
  };

  const joinProject = async (inviteCode: string) => {
    if (!user) return;

    // Check for unique invite
    const { data: invite, error: inviteError } = await supabase
      .from("project_invites")
      .select("*")
      .eq("code", inviteCode.trim())
      .is("used_by", null)
      .single();

    if (inviteError && inviteError.code !== "PGRST116") {
      toast.error("Error checking invite code");
      return;
    }

    if (invite) {
      // ATOMIC CONSUME: Guarded update
      try {
        const { data: consumedInvites, error: consumeError } = await supabase
          .from("project_invites")
          .update({ used_by: user.id, used_at: new Date().toISOString() })
          .eq("id", invite.id)
          .is("used_by", null) // Ensure it wasn't claimed between check and update
          .select();
        
        if (consumeError) throw consumeError;
        if (!consumedInvites || consumedInvites.length === 0) {
          throw new Error("INVITE_ALREADY_USED");
        }

        // Create membership
        const { error: memberError } = await supabase
          .from("project_members")
          .insert({ project_id: invite.project_id, user_id: user.id, role: invite.role || "member" });

        if (memberError) {
          // ROLLBACK: Revert invite consumption if membership creation fails
          await supabase
            .from("project_invites")
            .update({ used_by: null, used_at: null })
            .eq("id", invite.id);
          
          if (memberError.code === "23505") {
            toast.info("You're already a member");
          } else {
            throw memberError;
          }
        }

        const { data: project, error: projError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", invite.project_id)
          .single();

        if (projError) throw projError;

        toast.success(t("proj.joined").replace("{project}", project.name));
        queryClient.invalidateQueries({ queryKey: ["user_projects", user.id] });
        handleSetActiveProject(project as Project, 'user-selection');
      } catch (err: any) {
        console.error("Failed to join via invite:", err);
        if (err.message === "INVITE_ALREADY_USED") {
          toast.error("This invite has already been used");
        } else {
          toast.error("Failed to join project");
        }
      }
      return;
    }

    // Fallback to public/reusable invite code check
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("*")
      .eq("invite_code", inviteCode.trim())
      .single();

    if (projError) {
      localStorage.removeItem("pending_invite_code");
      toast.error("Invalid or already used invite code");
      return;
    }

    const { error: memberError } = await supabase
      .from("project_members")
      .insert({ project_id: project.id, user_id: user.id });

    if (memberError) {
      if (memberError.code === "23505") toast.info("You're already a member");
      else toast.error("Failed to join");
      return;
    }

    toast.success(t("proj.joined").replace("{project}", project.name));
    queryClient.invalidateQueries({ queryKey: ["user_projects", user.id] });
    handleSetActiveProject(project as Project, 'user-selection');
  };

  const deleteProject = async (projectId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) {
      toast.error("Failed to delete project");
      return false;
    }
    if (activeProject?.id === projectId) {
      localStorage.removeItem("active_project_id");
      localStorage.removeItem("active_project_cache");
      setActiveProject(null);
    }
    toast.success("Project deleted successfully");
    queryClient.invalidateQueries({ queryKey: ["user_projects", user.id] });
    return true;
  };

  const fetchProjects = async () => {
    const key = ["user_projects", user?.id];
    await queryClient.invalidateQueries({ queryKey: key });
    return await queryClient.refetchQueries({ queryKey: key });
  };

  return {
    projects,
    loading,
    activeProject,
    setActiveProject: handleSetActiveProject,
    createProject,
    joinProject,
    fetchProjects,
    clearProjectCache: () => {
      localStorage.removeItem("active_project_id");
      localStorage.removeItem("active_project_cache");
    },
    deleteProject,
    isSystemAdmin
  };
};
