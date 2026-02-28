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
      if (data && data.length > 0 && !activeProject) {
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
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("invite_code", inviteCode.trim())
      .single();

    if (!project) {
      toast.error("Invalid invite code");
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
  };

  return { projects, loading, activeProject, setActiveProject, createProject, joinProject, fetchProjects };
};
