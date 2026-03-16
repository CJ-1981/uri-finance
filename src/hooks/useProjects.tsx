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

type ProjectSource = 'user-selection' | 'cache' | 'server';

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

  // Fetch user preference from server
  const fetchUserPreference = async (): Promise<string | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_preferences')
      .select('default_project_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      // Fallback to localStorage cache
      const cached = localStorage.getItem("active_project_id");
      return cached;
    }

    return data?.default_project_id || null;
  };

  // Save user preference to server (with membership validation per REQ-001)
  const saveUserPreference = async (projectId: string): Promise<void> => {
    if (!user) return;

    // Validate membership before setting preference (REQ-001: Server-Side Preference Persistence)
    const { data: membership } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      console.warn("Attempted to set preference for non-member project:", projectId);
      return; // Don't save preference for non-member projects
    }

    await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        default_project_id: projectId
      });
  };

  // Persist selected project to localStorage (cache full object for instant restoration) and server
  // Only saves to localStorage and server when source is 'user-selection' to prevent overwriting manual changes
  const handleSetActiveProject = (project: Project | null, source: ProjectSource = 'user-selection'): void => {
    if (project) {
      // Only save to localStorage and server for user selections
      // Automatic restorations (cache/server) should not overwrite user's current choice or burden the database
      if (source === 'user-selection') {
        localStorage.setItem("active_project_id", project.id);
        localStorage.setItem("active_project_cache", JSON.stringify(project));
        // Save preference to server (fire and forget - don't block UI)
        saveUserPreference(project.id).catch((err: unknown) => console.debug(err));
      }
    } else {
      localStorage.removeItem("active_project_id");
      localStorage.removeItem("active_project_cache");
      // Clear preference from server when project is deselected
      if (user) {
        (async () => {
          const { error } = await supabase
            .from('user_preferences')
            .update({ default_project_id: null })
            .eq('user_id', user.id);
          if (error) console.debug('Failed to clear preference:', error);
        })().catch((err: unknown) => console.debug(err));
      }
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

      // Restore active project from server preference or localStorage, or fall back to first project
      if (data && data.length > 0) {
        // Priority 1: Preserve current selection if valid (user hasn't manually changed it)
        if (activeProject) {
          const currentProjectInList = data.find((p) => p.id === activeProject.id);
          if (currentProjectInList) {
            // Verify user is still a member of the current project
            const { data: membership } = await supabase
              .from("project_members")
              .select("id")
              .eq("project_id", activeProject.id)
              .eq("user_id", user.id)
              .maybeSingle();

            if (membership) {
              // Current selection is still valid, preserve it
              return; // Don't change activeProject
            }
          }
          // Current selection is invalid, fall through to restore from cache/server
        }

        // Priority 2: Use localStorage cache (user's recent manual selection)
        const cachedProjectId = localStorage.getItem("active_project_id");
        if (cachedProjectId) {
          const cachedProject = data.find((p) => p.id === cachedProjectId);
          if (cachedProject) {
            // Verify user is still a member of the cached project
            const { data: membership } = await supabase
              .from("project_members")
              .select("id")
              .eq("project_id", cachedProject.id)
              .eq("user_id", user.id)
              .maybeSingle();

            if (membership) {
              handleSetActiveProject(cachedProject as Project, 'cache');
              return;
            }
          }
          // Cached project is invalid, fall through to server preference
        }

        // Priority 3: Use server preference (fallback for sync across devices)
        const preferenceId = await fetchUserPreference();
        if (preferenceId) {
          const preferenceProject = data.find((p) => p.id === preferenceId);
          if (preferenceProject) {
            // Verify user is still a member of the preference project
            const { data: membership } = await supabase
              .from("project_members")
              .select("id")
              .eq("project_id", preferenceProject.id)
              .eq("user_id", user.id)
              .maybeSingle();

            if (membership) {
              handleSetActiveProject(preferenceProject as Project, 'server');
              return;
            }
          }
        }

        // Priority 4: Use first project as default
        handleSetActiveProject(data[0] as Project, 'cache');
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
    handleSetActiveProject(data as Project, 'user-selection');
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
      handleSetActiveProject(project as Project, 'user-selection');
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
      handleSetActiveProject((project as any).projects as Project, 'user-selection');
    }
  };

  // Clear project cache helper function
  const clearProjectCache = () => {
    localStorage.removeItem("active_project_id");
    localStorage.removeItem("active_project_cache");
  };

  // Validate cached project membership on mount to prevent security leak
  // This is now handled in fetchProjects() when server preference is loaded
  // Keeping this as a secondary validation for localStorage cache
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
  }, [user, activeProject]);

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
