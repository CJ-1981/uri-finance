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

// @MX:NOTE: Local project preference interface for SPEC-PROJ-001
// Stores user's custom ordering and default project selection in localStorage
// Works for all users regardless of membership level, works offline/standalone
interface LocalProjectPreference {
  project_id: string;
  display_order: number;
  is_default: boolean;
}

// Constants for local storage keys
const LOCAL_PROJECTS_KEY = "local_projects";
const ACTIVE_PROJECT_ID_KEY = "active_project_id";
const ACTIVE_PROJECT_CACHE_KEY = "active_project_cache";
const LOCAL_PROJECT_PREFERENCES_KEY = "project_preferences"; // SPEC-PROJ-001

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
            display_order: 0,
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
        .in("id", ids);

      if (projError) throw projError;

      // SPEC-PROJ-001: Fetch user preferences from localStorage for custom ordering
      const preferences = fetchProjectPreferences();

      // Build order map from preferences
      const orderMap = new Map(preferences.map(p => [p.project_id, p.display_order]));

      // Sort projects by display_order, fallback to created_at DESC
      const sortedProjects = (data || []).sort((a, b) => {
        const orderA = orderMap.get(a.id) ?? Infinity;
        const orderB = orderMap.get(b.id) ?? Infinity;

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        // Fallback to created_at DESC
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return sortedProjects as Project[];
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
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
      localStorage.removeItem(ACTIVE_PROJECT_CACHE_KEY);
    }
    setActiveProject(project);
  }, []);

  // Restore logic
  // SPEC-PROJ-001: Enhanced to prioritize user's default project
  useEffect(() => {
    (async () => {
      if (loading) return;

      // 1. If no projects exist, ensure active project is cleared
      if (projects.length === 0) {
        if (activeProject) handleSetActiveProject(null, 'server');
        return;
      }

      // 2. If we have projects but none active, try to restore from cache or default
      if (!activeProject) {
        // SPEC-PROJ-001: Priority 1 - User's default project from localStorage preferences
        try {
          const preferences = fetchProjectPreferences();
          const defaultPref = preferences.find(p => p.is_default);
          if (defaultPref) {
            const defaultProject = projects.find((p: Project) => p.id === defaultPref.project_id);
            if (defaultProject) {
              handleSetActiveProject(defaultProject, 'cache');
              return;
            }
          }
        } catch (err) {
          console.warn('[useProjects] Failed to fetch default project preference:', err);
        }

        // SPEC-PROJ-001: Priority 2 - Cached project from localStorage
        const cachedId = localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
        const found = projects.find((p: Project) => p.id === cachedId);

        if (found) {
          // Cached project is still valid, use it
          handleSetActiveProject(found, 'cache');
        } else {
          // Cached ID not found in projects (might be deleted or access revoked)
          // Only fall back to first project if no cached ID exists
          if (!cachedId) {
            handleSetActiveProject(projects[0], 'cache');
          } else {
            // Cached ID exists but project not found - clear invalid cache and fall back
            console.warn('[useProjects] Cached project ID not found in current project list, clearing cache');
            localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
            localStorage.removeItem(ACTIVE_PROJECT_CACHE_KEY);
            handleSetActiveProject(projects[0], 'cache');
          }
        }
        return;
      }

      // 3. If we have an active project, update it with fresh data from server
      // This ensures the active project always has the latest server data
      const freshProject = projects.find((p: Project) => p.id === activeProject.id);
      if (freshProject) {
        // Update active project with fresh server data (silent update, no source change)
        // Only update if data actually changed to avoid unnecessary re-renders
        if (JSON.stringify(freshProject) !== JSON.stringify(activeProject)) {
          console.log('[useProjects] Updating active project with fresh server data');
          localStorage.setItem(ACTIVE_PROJECT_CACHE_KEY, JSON.stringify(freshProject));
          setActiveProject(freshProject);
        }
      } else if (lastSource === 'user-selection') {
        // Only fall back if we're not currently fetching
        // This prevents overwriting a recent user selection during background refetches
        if (!isFetching) {
          console.warn('[useProjects] User-selected project became invalid, falling back to first project');
          handleSetActiveProject(projects[0], 'cache');
        }
      } else {
        // Cached project became invalid, clear cache and fall back to first project
        console.warn('[useProjects] Cached project no longer available, clearing cache and falling back');
        localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
        localStorage.removeItem(ACTIVE_PROJECT_CACHE_KEY);
        handleSetActiveProject(projects[0], 'cache');
      }
    })();
  }, [loading, isFetching, projects, activeProject, handleSetActiveProject, lastSource, user, isStandalone, isOnline, fetchProjectPreferences]);

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
