import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";
import { useSystemAdmin } from "@/hooks/useSystemAdmin";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { get, del, keys } from "idb-keyval";

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

// Constants for local storage keys
const LOCAL_PROJECTS_KEY = "local_projects";
const ACTIVE_PROJECT_ID_KEY = "active_project_id";
const ACTIVE_PROJECT_CACHE_KEY = "active_project_cache";

export const useProjects = () => {
  const { user, isStandalone } = useAuth();
  const { t } = useI18n();
  const { isSystemAdmin: isRealSystemAdmin } = useSystemAdmin();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  // In standalone mode, everyone is an admin of their local projects
  const isSystemAdmin = isStandalone || isRealSystemAdmin;

  // Initialize activeProject from localStorage cache
  const [activeProject, setActiveProject] = useState<Project | null>(() => {
    try {
      const cached = localStorage.getItem(ACTIVE_PROJECT_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // Selection source tracker to avoid overriding user-driven changes
  const [lastSource, setLastSource] = useState<ProjectSource | null>(null);

  // Query: Fetch projects (either from Supabase or local storage)
  const { data: projects = [], isLoading: loading } = useQuery({
    queryKey: ["user_projects", isStandalone ? "standalone" : (user?.id || "anonymous")],
    queryFn: async () => {
      // Guard: If standalone, no user, or using the mock standalone user ID, use local storage
      if (isStandalone || !user || user.id === "standalone-user") {
        // Load projects from local storage when standalone or offline/unauthenticated
        const local = localStorage.getItem(LOCAL_PROJECTS_KEY);
        return local ? JSON.parse(local) : [];
      }
      
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
    enabled: true,
    staleTime: 1000 * 60 * 10,
    networkMode: "always",
  });

  // Revalidate cached project against current list
  const validateProject = useCallback((project: Project | null): Project | null => {
    if (!project) return null;
    if (projects.length === 0) return null; // If no projects, nothing is valid
    const found = projects.find(p => p.id === project.id);
    if (!found) {
      console.warn("[useProjects] Active project is invalid. Clearing cache.");
      localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
      localStorage.removeItem(ACTIVE_PROJECT_CACHE_KEY);
      return null;
    }
    return found;
  }, [projects]);

  // Persist selected project
  const handleSetActiveProject = useCallback((project: Project | null, source: ProjectSource = 'user-selection'): void => {
    setLastSource(source);
    
    if (project) {
      localStorage.setItem(ACTIVE_PROJECT_ID_KEY, project.id);
      localStorage.setItem(ACTIVE_PROJECT_CACHE_KEY, JSON.stringify(project));
      
      if (!isStandalone && isOnline && user && source === 'user-selection') {
        supabase.from('user_preferences').upsert({
          user_id: user.id,
          default_project_id: project.id
        }, { onConflict: 'user_id' }).then(({ error }) => {
          if (error) console.debug('Failed to save preference:', error);
        });
      }
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
      localStorage.removeItem(ACTIVE_PROJECT_CACHE_KEY);
      if (!isStandalone && isOnline && user) {
        supabase.from('user_preferences').update({ default_project_id: null }).eq('user_id', user.id).then(({ error }) => {
          if (error) console.debug('Failed to clear preference:', error);
        });
      }
    }
    setActiveProject(project);
  }, [isOnline, user, isStandalone]);

  // Restore logic
  useEffect(() => {
    if (loading) return;
    
    // 1. If no projects exist, ensure active project is cleared
    if (projects.length === 0) {
      if (activeProject) handleSetActiveProject(null, 'server');
      return;
    }

    // 2. If we have projects but none active, try to restore
    if (!activeProject) {
      const cachedId = localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
      const found = projects.find(p => p.id === cachedId) || projects[0];
      handleSetActiveProject(found, 'cache');
      return;
    }

    // 3. If we have an active project, revalidate it (unless recently set by user)
    if (lastSource !== 'user-selection') {
      const validated = validateProject(activeProject);
      if (!validated) {
        // Fallback to first project if current became invalid
        handleSetActiveProject(projects[0], 'cache');
      }
    }
  }, [loading, projects, activeProject, handleSetActiveProject, validateProject, lastSource]);

  const createProject = async (name: string, description?: string) => {
    if (isStandalone || !user) {
      // Local-only creation
      const newProject: Project = {
        id: crypto.randomUUID(),
        name,
        description: description || null,
        owner_id: isStandalone ? "standalone-user" : "anonymous",
        invite_code: "LOCAL",
        currency: "EUR",
        created_at: new Date().toISOString()
      };
      const existing = JSON.parse(localStorage.getItem(LOCAL_PROJECTS_KEY) || "[]");
      localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify([newProject, ...existing]));
      queryClient.invalidateQueries({ queryKey: ["user_projects", isStandalone ? "standalone" : "anonymous"] });
      handleSetActiveProject(newProject, 'user-selection');
      toast.success("Project created locally!");
      return;
    }

    if (!isSystemAdmin) {
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

    const { error: memberError } = await supabase
      .from("project_members")
      .insert({ project_id: data.id, user_id: user.id, role: "owner" });

    if (memberError) {
      console.error("Failed to create owner membership, rolling back project:", memberError);
      // ATOMIC ROLLBACK
      await supabase.from("projects").delete().eq("id", data.id);
      toast.error("Failed to setup project ownership. Project creation rolled back.");
      return;
    }

    toast.success("Project created!");
    queryClient.invalidateQueries({ queryKey: ["user_projects", user.id] });
    handleSetActiveProject(data as Project, 'user-selection');
  };

  const joinProject = async (inviteCode: string) => {
    if (!user) {
      toast.error("Please login to join a project");
      return;
    }

    // Check for unique invite first
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
          .is("used_by", null)
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
          // ROLLBACK
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
    if (isStandalone || !user) {
      console.log(`[useProjects] Starting thorough cleanup for local project: ${projectId}`);
      // Local delete - perform thorough cleanup
      try {
        // 1. Clear basic project lists
        const existing = JSON.parse(localStorage.getItem(LOCAL_PROJECTS_KEY) || "[]");
        const updated = existing.filter((p: any) => p.id !== projectId);
        localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(updated));
        console.log(`[useProjects] Removed project ${projectId} from local_projects list`);

        // 2. Aggressively clear ALL project-specific data from LocalStorage by searching keys
        console.log(`[useProjects] Scanning LocalStorage for project-related keys...`);
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes(projectId)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log(`[useProjects] Removed LocalStorage key: ${key}`);
        });

        // 3. Clear file content and other project-specific data from IndexedDB
        console.log(`[useProjects] Scanning IndexedDB for project-related keys...`);
        const fileMetadataKey = `files-metadata-${projectId}`;
        const localFiles: any[] = await get(fileMetadataKey) || [];
        
        // Delete individual file content (their keys usually don't contain projectId, but fileId)
        for (const file of localFiles) {
          if (file.id) {
            const contentKey = `file-content-${file.id}`;
            await del(contentKey);
            console.log(`[useProjects] Cleared IndexedDB file content: ${contentKey}`);
          }
        }
        
        // Now scan all IDB keys for anything else containing the projectId
        const allIdbKeys = await keys();
        for (const key of allIdbKeys) {
          if (typeof key === 'string' && key.includes(projectId)) {
            await del(key);
            console.log(`[useProjects] Removed IndexedDB key: ${key}`);
          }
        }

        // 4. Clear related query cache to prevent ghost data
        queryClient.removeQueries({ queryKey: ["project_categories", projectId] });
        queryClient.removeQueries({ queryKey: ["project_custom_columns", projectId] });
        queryClient.removeQueries({ queryKey: ["project_column_headers", projectId] });
        queryClient.removeQueries({ queryKey: ["infinite_transactions", projectId] });
        queryClient.removeQueries({ queryKey: ["project-files", projectId] });
        console.log(`[useProjects] Invalidated React Query cache for project: ${projectId}`);

        // 5. Update UI state
        queryClient.invalidateQueries({ queryKey: ["user_projects", isStandalone ? "standalone" : "anonymous"] });
        if (activeProject?.id === projectId) handleSetActiveProject(null, 'user-selection');
        
        toast.success("Local project and all associated data deleted");
        return true;
      } catch (err) {
        console.error("Failed to thoroughly delete local project:", err);
        toast.error("Failed to fully clear project data");
        return false;
      }
    }

    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) {
      toast.error("Failed to delete project");
      return false;
    }
    if (activeProject?.id === projectId) {
      handleSetActiveProject(null, 'user-selection');
    }
    toast.success("Project deleted successfully");
    queryClient.invalidateQueries({ queryKey: ["user_projects", user.id] });
    return true;
  };

  const updateProject = async (projectId: string, updates: { name?: string; description?: string | null; currency?: string }): Promise<boolean> => {
    if (isStandalone || !user) {
      // Local update
      const existing = JSON.parse(localStorage.getItem(LOCAL_PROJECTS_KEY) || "[]");
      const updated = existing.map((p: any) => p.id === projectId ? { ...p, ...updates } : p);
      localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(updated));
      queryClient.invalidateQueries({ queryKey: ["user_projects", isStandalone ? "standalone" : "anonymous"] });
      if (activeProject?.id === projectId) {
        const newActive = updated.find((p: any) => p.id === projectId);
        handleSetActiveProject(newActive, 'cache');
      }
      toast.success(t("proj.renameSuccess") || "Project updated");
      return true;
    }

    const { error } = await supabase.from("projects").update(updates).eq("id", projectId);
    if (error) {
      toast.error("Failed to update project");
      return false;
    }
    
    // Refresh active project if it was the one updated
    if (activeProject?.id === projectId) {
      const { data: updatedProj } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (updatedProj) handleSetActiveProject(updatedProj as Project, 'cache');
    }

    toast.success(t("proj.renameSuccess") || "Project updated");
    queryClient.invalidateQueries({ queryKey: ["user_projects", user.id] });
    return true;
  };

  const fetchProjects = async () => {
    const key = ["user_projects", isStandalone ? "standalone" : (user?.id || "anonymous")];
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
      localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
      localStorage.removeItem(ACTIVE_PROJECT_CACHE_KEY);
    },
    deleteProject,
    updateProject,
    isSystemAdmin
  };
};
