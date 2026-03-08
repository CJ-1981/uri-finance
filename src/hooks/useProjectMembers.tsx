import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProjectMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  email?: string;
}

export interface ProjectInvite {
  id: string;
  code: string;
  label: string | null;
  email: string | null;
  role: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

export const useProjectMembers = (projectId?: string) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("project_members")
      .select("*")
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true });
    setMembers((data as ProjectMember[]) || []);
    setLoading(false);
  }, [projectId]);

  const fetchInvites = useCallback(async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("project_invites")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setInvites((data as ProjectInvite[]) || []);
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
    fetchInvites();
  }, [fetchMembers, fetchInvites]);

  const removeMember = async (memberId: string) => {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("id", memberId);
    if (error) return false;
    await fetchMembers();
    return true;
  };

  const banMember = async (userId: string, memberId: string) => {
    if (!projectId) return false;
    // First ban, then remove membership
    const { error: banError } = await supabase
      .from("project_bans")
      .insert({ project_id: projectId, user_id: userId });
    if (banError && banError.code !== "23505") return false;

    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("id", memberId);
    if (error) return false;
    await fetchMembers();
    return true;
  };

  const createInvite = async (label?: string, email?: string, role?: string) => {
    if (!projectId) return false;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from("project_invites")
      .insert({ 
        project_id: projectId, 
        created_by: user.id,
        label: label?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        role: role || "member",
      } as any);
    if (error) return false;
    await fetchInvites();
    return true;
  };

  const deleteInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from("project_invites")
      .delete()
      .eq("id", inviteId);
    if (error) return false;
    await fetchInvites();
    return true;
  };

  const updateMemberRole = async (memberId: string, role: string) => {
    const { error } = await supabase
      .from("project_members")
      .update({ role })
      .eq("id", memberId);
    if (error) return false;
    await fetchMembers();
    return true;
  };

  const transferOwnership = async (newOwnerId: string, currentOwnerId: string) => {
    if (!projectId) return false;
    // Update project owner
    const { error: projError } = await supabase
      .from("projects")
      .update({ owner_id: newOwnerId })
      .eq("id", projectId);
    if (projError) return false;

    // Update member roles: new owner gets "owner", old owner gets "admin"
    const { data: newOwnerMember } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", newOwnerId)
      .single();

    const { data: oldOwnerMember } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", currentOwnerId)
      .single();

    if (newOwnerMember) {
      await supabase.from("project_members").update({ role: "owner" }).eq("id", newOwnerMember.id);
    }
    if (oldOwnerMember) {
      await supabase.from("project_members").update({ role: "admin" }).eq("id", oldOwnerMember.id);
    }

    await fetchMembers();
    return true;
  };

  return { members, invites, loading, removeMember, banMember, createInvite, deleteInvite, fetchMembers, fetchInvites, updateMemberRole, transferOwnership };
};
