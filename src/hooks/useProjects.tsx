import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";
import { useSystemAdmin } from "@/hooks/useSystemAdmin";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { get, del, keys } from "idb-keyval";

import { LOCAL_PROJECT_PREFERENCES_KEY, LocalProjectPreference } from "@/types/projectPreferences";

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

// SPEC-PROJ-001: Shared sorting helper
export const sortProjectsByPreferences = (projects: Project[], preferences: LocalProjectPreference[]) => {
  const orderMap = new Map(preferences.map(p => [p.project_id, p.display_order]));

  return [...projects].sort((a, b) => {
    const orderA = orderMap.get(a.id) ?? Infinity;
    const orderB = orderMap.get(b.id) ?? Infinity;
    
    if (orderA !== orderB) {
      return (orderA as number) - (orderB as number);
    }

    // Fallback to created_at DESC
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

export const useProjects = () => {
  const { user, isStandalone } = useAuth();
  const { t } = useI18n();
  const { isSystemAdmin: isRealSystemAdmin } = useSystemAdmin();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  // SPEC-PROJ-001: Fetch user project preferences from localStorage
  // Works for all users, works offline/standalone, no database dependency
  const fetchProjectPreferences = useCallback((): LocalProjectPreference[] => {
    try {
      const localPrefs = localStorage.getItem(LOCAL_PROJECT_PREFERENCES_KEY);
      return localPrefs ? JSON.parse(localPrefs) : [];
    } catch {
      return [];
    }
  }, []);

  // SPEC-PROJ-001: Update display order for multiple projects (localStorage only)
  const updateProjectOrder = useCallback(async (updates: Array<{project_id: string, display_order: number}>): Promise<void> => {
    try {
      const existingPrefs = JSON.parse(localStorage.getItem(LOCAL_PROJECT_PREFERENCES_KEY) || "[]");
      const prefsMap = new Map(existingPrefs.map((p: LocalProjectPreference) => [p.project_id, p]));

      updates.forEach(update => {
        const existing = prefsMap.get(update.project_id) as LocalProjectPreference | undefined;
        if (existing) {
          existing.display_order = update.display_order;
        } else {
          prefsMap.set(update.project_id, {
            project_id: update.project_id,
            display_order: update.display_order,
            is_default: false,
          });
        }
      });

      localStorage.setItem(LOCAL_PROJECT_PREFERENCES_KEY, JSON.stringify(Array.from(prefsMap.values())));

      // Invalidate query to trigger re-sort with new order
      queryClient.invalidateQueries({ queryKey: ["user_projects", isStandalone ? "standalone" : (user?.id || "anonymous")] });
    } catch (err) {
      console.error('Failed to save project order to localStorage:', err);
      throw err;
    }
  }, [queryClient, isStandalone, user?.id]);

  // SPEC-PROJ-001: Set default project (localStorage only, works for all users)
  const setDefaultProject = useCallback(async (projectId: string): Promise<void> => {
    try {
      const existingPrefs = JSON.parse(localStorage.getItem(LOCAL_PROJECT_PREFERENCES_KEY) || "[]");
      const prefsMap = new Map(existingPrefs.map((p: LocalProjectPreference) => [p.project_id, p]));

      // Remove default from all projects
      prefsMap.forEach((pref: LocalProjectPreference) => {
        pref.is_default = false;
      });

      // Set new default
      if (projectId) {
        const target = prefsMap.get(projectId) as LocalProjectPreference | undefined;
        if (target) {
          target.is_default = true;
        } else {
          prefsMap.set(projectId, {
            project_id: projectId,
            // SPEC-PROJ-001: display_order is now optional in LocalProjectPreference
            is_default: true,
          });
        }
      }

      localStorage.setItem(LOCAL_PROJECT_PREFERENCES_KEY, JSON.stringify(Array.from(prefsMap.values())));

      // Note: No need to invalidate query here since default status is read from localStorage in ProjectSwitcher
      // The preferenceUpdateCounter in ProjectSwitcher will trigger re-render
    } catch (err) {
      console.error('Failed to save default project to localStorage:', err);
      throw err;
    }
  }, []);

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
  // SPEC-PROJ-001: Enhanced to fetch user preferences for custom ordering
  const { data: projects = [], isLoading: loading, isFetching } = useQuery({
    queryKey: ["user_projects", isStandalone ? "standalone" : (user?.id || "anonymous")],
    queryFn: async () => {
      // Guard: If standalone, no user, or using the mock standalone user ID, use local storage
      if (isStandalone || !user || user.id === "standalone-user") {
        const local = localStorage.getItem(LOCAL_PROJECTS_KEY);
        const data = local ? JSON.parse(local) : [];

        // SPEC-PROJ-001: Use shared sorting helper
        return sortProjectsByPreferences(data as Project[], fetchProjectPreferences());
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
        .in("id", ids);

      if (projError) throw projError;

      // SPEC-PROJ-001: Use shared sorting helper
      return sortProjectsByPreferences(data as Project[] || [], fetchProjectPreferences());
    },
    enabled: true,
    staleTime: 1000 * 60 * 10,
    networkMode: "always",
  });

  // Persist selected project to localStorage
  const handleSetActiveProject = useCallback((project: Project | null, source: ProjectSource = 'user-selection'): void => {
    setLastSource(source);

    if (project) {
      localStorage.setItem(ACTIVE_PROJECT_ID_KEY, project.id);
      localStorage.setItem(ACTIVE_PROJECT_CACHE_KEY, JSON.stringify(project));

      // Sync with server if online and not standalone - important for multi-device sync
      if (!isStandalone && isOnline && user && source === 'user-selection') {
        supabase.from('user_preferences').upsert({
          user_id: user.id,
          default_project_id: project.id
        }, { onConflict: 'user_id' }).then(({ error }) => {
          if (error) console.debug('[useProjects] Failed to save preference to server:', error);
        });
      }
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
      localStorage.removeItem(ACTIVE_PROJECT_CACHE_KEY);
      if (!isStandalone && isOnline && user) {
        supabase.from('user_preferences').update({ default_project_id: null }).eq('user_id', user.id).then(({ error }) => {
          if (error) console.debug('[useProjects] Failed to clear preference on server:', error);
        });
      }
    }
    setActiveProject(project);
  }, [isStandalone, isOnline, user]);

  // Restore logic
  // SPEC-PROJ-001: Enhanced to prioritize user's default project
  useEffect(() => {
    const restoreProject = async () => {
      if (loading) return;

      // 1. If no projects exist, ensure active project is cleared
      if (projects.length === 0) {
        if (activeProject) {
          localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
          localStorage.removeItem(ACTIVE_PROJECT_CACHE_KEY);
          setActiveProject(null);
        }
        return;
      }

      // 2. If we have projects but none active, try to restore from default preference or cache
      if (!activeProject) {
        // SPEC-PROJ-001: Priority 1 - Server-synced default project from user_preferences (if online)
        let serverDefaultId: string | null = null;
        if (!isStandalone && isOnline && user) {
          try {
            const { data, error } = await supabase
              .from('user_preferences')
              .select('default_project_id')
              .eq('user_id', user.id)
              .maybeSingle();
            
            if (!error && data?.default_project_id) {
              serverDefaultId = data.default_project_id;
              const serverProject = projects.find((p: Project) => p.id === serverDefaultId);
              if (serverProject) {
                handleSetActiveProject(serverProject, 'server');
                return;
              }
            }
          } catch (err) {
            console.debug('[useProjects] Failed to fetch server preference:', err);
          }
        }

        // SPEC-PROJ-001: Priority 2 - Local default from localStorage preferences
        const preferences = fetchProjectPreferences();
        const defaultPref = preferences.find(p => p.is_default);
        
        if (defaultPref) {
          const defaultProject = projects.find((p: Project) => p.id === defaultPref.project_id);
          if (defaultProject) {
            handleSetActiveProject(defaultProject, 'cache');
            return;
          }
        }

        // SPEC-PROJ-001: Priority 3 - Cached project from localStorage (last selected)
        const cachedId = localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
        const found = projects.find((p: Project) => p.id === cachedId);

        if (found) {
          handleSetActiveProject(found, 'cache');
        } else {
          // Fallback to first project
          handleSetActiveProject(projects[0], 'cache');
        }
        return;
      }

      // 3. If we have an active project, update it with fresh data from server
      const freshProject = projects.find((p: Project) => p.id === activeProject.id);
      if (freshProject) {
        // Update active project with fresh data if it changed (e.g. name, currency)
        if (JSON.stringify(freshProject) !== JSON.stringify(activeProject)) {
          console.log('[useProjects] Updating active project with fresh data');
          localStorage.setItem(ACTIVE_PROJECT_CACHE_KEY, JSON.stringify(freshProject));
          setActiveProject(freshProject);
        }
      } else if (lastSource === 'user-selection') {
        // User's selected project became invalid (deleted or access revoked), fall back to first project
        // but only if we are not currently refetching to avoid premature fallback
        if (!isFetching) {
          console.warn('[useProjects] User-selected project no longer available, falling back');
          handleSetActiveProject(projects[0], 'cache');
        }
      } else {
        // Cached project became invalid, fall back
        console.warn('[useProjects] Cached project no longer available, falling back');
        handleSetActiveProject(projects[0], 'cache');
      }
    };

    restoreProject();
  }, [loading, isFetching, projects, activeProject, handleSetActiveProject, lastSource, fetchProjectPreferences, isStandalone, isOnline, user]);

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
        const allLocalStorageKeys = Object.keys(localStorage);
        console.log(`[useProjects] Total LocalStorage keys found: ${allLocalStorageKeys.length}`);
        
        const keysToRemove: string[] = allLocalStorageKeys.filter(key => key.includes(projectId));
        
        if (keysToRemove.length > 0) {
          console.log(`[useProjects] Found ${keysToRemove.length} LocalStorage keys to remove for project ${projectId}:`, keysToRemove);
          keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`[useProjects] Removed LocalStorage key: ${key}`);
          });
        } else {
          console.log(`[useProjects] No LocalStorage keys found containing project ID: ${projectId}`);
        }

        // 3. Clear file content and other project-specific data from IndexedDB
        console.log(`[useProjects] Scanning IndexedDB for project-related keys...`);
        const fileMetadataKey = `files-metadata-${projectId}`;
        const localFiles: any[] = await get(fileMetadataKey) || [];
        
        console.log(`[useProjects] Project metadata found in IDB: ${localFiles.length} files`);
        
        // Delete individual file content
        for (const file of localFiles) {
          if (file.id) {
            const contentKey = `file-content-${file.id}`;
            await del(contentKey);
            console.log(`[useProjects] Cleared IndexedDB file content: ${contentKey}`);
          }
        }
        
        // Now scan all IDB keys for anything else containing the projectId
        const allIdbKeys = await keys();
        console.log(`[useProjects] Total IndexedDB keys found: ${allIdbKeys.length}`);
        
        for (const key of allIdbKeys) {
          if (typeof key === 'string' && key.includes(projectId)) {
            await del(key);
            console.log(`[useProjects] Removed IndexedDB key: ${key}`);
          }
        }
        
        // Final metadata list deletion (redundant if already found by scan, but safe)
        await del(fileMetadataKey);

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
    isSystemAdmin,
    // SPEC-PROJ-001: Export new preference management functions
    updateProjectOrder,
    setDefaultProject,
    fetchProjectPreferences,
  };
};
