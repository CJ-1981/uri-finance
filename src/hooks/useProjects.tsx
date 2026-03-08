import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const fetchProjects = async () => {
    if (!user) return;
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
      // Update activeProject with fresh data if it exists
      if (data && activeProject) {
        const updated = data.find((p) => p.id === activeProject.id);
        if (updated) setActiveProject(updated as Project);
        else if (data.length > 0) setActiveProject(data[0] as Project);
      } else if (data && data.length > 0 && !activeProject) {
        setActiveProject(data[0] as Project);
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
    setActiveProject(data as Project);
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

      toast.success(`Joined "${project.name}"!`);
      await fetchProjects();
      setActiveProject(project as Project);
      return;
    }

    // New invite system
    const projectId = (invite as any).project_id;

    // Check if banned
    const { data: ban } = await supabase
      .from("project_bans")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ban) {
      toast.error("You have been banned from this project.");
      return;
    }

    // Mark invite as used
    await supabase
      .from("project_invites")
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq("id", (invite as any).id);

    // Join project
    const { error } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: user.id });

    if (error) {
      if (error.code === "23505") {
        toast.info("You're already a member of this project");
      } else {
        toast.error("Failed to join project");
      }
      return;
    }

    // Get project info for toast
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    toast.success(`Joined "${project?.name}"!`);
    await fetchProjects();
    if (project) setActiveProject(project as Project);
  };

  return { projects, loading, activeProject, setActiveProject, createProject, joinProject, fetchProjects };
};
