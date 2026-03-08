import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Category {
  id: string;
  project_id: string;
  name: string;
  code: string;
  created_at: string;
}

export const useCategories = (projectId: string | undefined) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    if (!projectId) return;
    setLoading(true);
    const { data } = await supabase
      .from("project_categories")
      .select("*")
      .eq("project_id", projectId)
      .order("name");
    setCategories((data as Category[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, [projectId]);

  const addCategory = async (name: string, code?: string) => {
    if (!projectId) return;
    const { error } = await supabase
      .from("project_categories")
      .insert({ project_id: projectId, name: name.trim(), code: code?.trim() || "" });
    if (error) {
      if (error.code === "23505") {
        toast.error("Category already exists");
      } else {
        toast.error("Failed to add category");
      }
      return;
    }
    toast.success("Category added!");
    await fetchCategories();
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase
      .from("project_categories")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete category");
      return;
    }
    toast.success("Category removed");
    await fetchCategories();
  };

  const renameCategory = async (id: string, newName: string) => {
    const { error } = await supabase
      .from("project_categories")
      .update({ name: newName.trim() })
      .eq("id", id);
    if (error) {
      toast.error("Failed to rename category");
      return;
    }
    await fetchCategories();
  };

  return { categories, loading, addCategory, deleteCategory, renameCategory, fetchCategories };
};
