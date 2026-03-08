import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Category {
  id: string;
  project_id: string;
  name: string;
  code: string;
  icon: string;
  sort_order: number;
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
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    setCategories((data as Category[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, [projectId]);

  const addCategory = async (name: string, code?: string) => {
    if (!projectId) return;
    const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) : -1;
    const { error } = await supabase
      .from("project_categories")
      .insert({ project_id: projectId, name: name.trim(), code: code?.trim() || "", sort_order: maxOrder + 1 });
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

  const updateCategoryCode = async (id: string, code: string) => {
    const { error } = await supabase
      .from("project_categories")
      .update({ code: code.trim() })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update code");
      return;
    }
    await fetchCategories();
  };

  const updateCategoryIcon = async (id: string, icon: string) => {
    const { error } = await supabase
      .from("project_categories")
      .update({ icon } as any)
      .eq("id", id);
    if (error) {
      toast.error("Failed to update icon");
      return;
    }
    await fetchCategories();
  };

  const reorderCategory = async (id: string, direction: "up" | "down") => {
    const idx = categories.findIndex(c => c.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const current = categories[idx];
    const swap = categories[swapIdx];

    await Promise.all([
      supabase.from("project_categories").update({ sort_order: swap.sort_order } as any).eq("id", current.id),
      supabase.from("project_categories").update({ sort_order: current.sort_order } as any).eq("id", swap.id),
    ]);
    await fetchCategories();
  };

  return { categories, loading, addCategory, deleteCategory, renameCategory, updateCategoryCode, reorderCategory, fetchCategories };
};
