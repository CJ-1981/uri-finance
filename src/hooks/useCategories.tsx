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
  parent_id: string | null;
  created_at: string;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
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

  const buildCategoryTree = (categories: Category[]): CategoryTreeNode[] => {
    const categoryMap = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    // First pass: create nodes
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree
    categories.forEach(cat => {
      const node = categoryMap.get(cat.id)!;
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        categoryMap.get(cat.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const flattenCategoryTree = (nodes: CategoryTreeNode[]): Category[] => {
    const result: Category[] = [];
    const traverse = (node: CategoryTreeNode) => {
      result.push(node);
      node.children.forEach(traverse);
    };
    nodes.forEach(traverse);
    return result;
  };

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
    // Find the category name before deleting
    const category = categories.find(c => c.id === id);
    const categoryName = category?.name;

    // Delete the category from project_categories table
    const { error } = await supabase
      .from("project_categories")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete category");
      return;
    }

    // Update all transactions with this category to "General"
    if (categoryName) {
      await supabase
        .from("transactions")
        .update({ category: "General" })
        .eq("category", categoryName);
    }

    toast.success("Category removed");
    await fetchCategories();
  };

  const renameCategory = async (id: string, newName: string) => {
    // Find the current category name
    const category = categories.find(c => c.id === id);
    if (!category) {
      toast.error("Category not found");
      return;
    }
    const oldName = category.name;
    const trimmedNewName = newName.trim();

    // Update the category in project_categories table
    const { error } = await supabase
      .from("project_categories")
      .update({ name: trimmedNewName })
      .eq("id", id);
    if (error) {
      toast.error("Failed to rename category");
      return;
    }

    // Update all transactions that have the old category name
    const { error: txError } = await supabase
      .from("transactions")
      .update({ category: trimmedNewName })
      .eq("category", oldName);

    if (txError) {
      toast.error("Failed to update transactions");
      return;
    }

    toast.success("Category renamed!");
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

    // Use index-based values to handle cases where sort_order values are identical
    const currentOrder = current.sort_order !== swap.sort_order ? current.sort_order : idx;
    const swapOrder = current.sort_order !== swap.sort_order ? swap.sort_order : swapIdx;

    await Promise.all([
      supabase.from("project_categories").update({ sort_order: swapOrder } as any).eq("id", current.id),
      supabase.from("project_categories").update({ sort_order: currentOrder } as any).eq("id", swap.id),
    ]);
    await fetchCategories();
  };

  const reorderCategories = async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, index) =>
      supabase.from("project_categories").update({ sort_order: index } as any).eq("id", id)
    );
    await Promise.all(updates);
    await fetchCategories();
  };

  const addSubCategory = async (parentId: string, name: string, code?: string) => {
    if (!projectId) return;
    const { error } = await supabase
      .from("project_categories")
      .insert({ project_id: projectId, name: name.trim(), code: code?.trim() || "", parent_id: parentId });
    if (error) {
      if (error.code === "23505") {
        toast.error("Sub-category already exists");
      } else {
        toast.error("Failed to add sub-category");
      }
      return;
    }
    toast.success("Sub-category added!");
    await fetchCategories();
  };

  const updateCategoryParent = async (id: string, newParentId: string | null) => {
    // Prevent creating cycles
    if (newParentId) {
      let currentId = newParentId;
      const visited = new Set<string>();
      while (currentId) {
        if (visited.has(currentId)) {
          toast.error("Cannot create cycle in category hierarchy");
          return;
        }
        visited.add(currentId);
        const parent = categories.find(c => c.id === currentId);
        if (!parent) break;
        currentId = parent.parent_id || "";
      }
    }

    const { error } = await supabase
      .from("project_categories")
      .update({ parent_id: newParentId })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update category parent");
      return;
    }
    await fetchCategories();
  };

  return {
    categories,
    loading,
    addCategory,
    addSubCategory,
    deleteCategory,
    renameCategory,
    updateCategoryCode,
    updateCategoryIcon,
    reorderCategory,
    reorderCategories,
    updateCategoryParent,
    buildCategoryTree,
    flattenCategoryTree,
    fetchCategories,
  };
}
