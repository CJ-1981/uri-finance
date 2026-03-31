import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient, useMutationState } from "@tanstack/react-query";
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

const isNetworkError = (error: any) => {
  return !navigator.onLine || 
         error?.message?.includes("Failed to fetch") || 
         error?.message?.includes("Load failed") ||
         error?.message?.includes("TypeError") ||
         error?.code === "PGRST100" || 
         error?.status === 0;
};

export const useCategories = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  // Track pending "add" mutations
  const pendingAdds = useMutationState({
    filters: { status: "pending", mutationKey: ["addCategory", projectId] },
    select: (mutation) => mutation.state.variables as any,
  });

  // Track pending "delete" IDs
  const pendingDeletes = useMutationState({
    filters: { status: "pending", mutationKey: ["deleteCategory", projectId] },
    select: (mutation) => mutation.state.variables as string,
  });

  const buildCategoryTree = (categories: Category[]): CategoryTreeNode[] => {
    const categoryMap = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

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

  const { data: serverCategories = [], isLoading: loading } = useQuery({
    queryKey: ["project_categories", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_categories")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5,
  });

  // Merge server data with pending offline changes
  const categories = useMemo(() => {
    let list = [...serverCategories];

    if (pendingDeletes.length > 0) {
      const deleteSet = new Set(pendingDeletes);
      list = list.filter(c => !deleteSet.has(c.id));
    }

    if (pendingAdds.length > 0) {
      const existingIds = new Set(list.map(c => c.id));
      pendingAdds.forEach(pending => {
        const id = pending.id || `temp-${pending.name}`;
        if (!existingIds.has(id)) {
          list.push({
            id,
            project_id: projectId!,
            name: pending.name,
            code: pending.code || "",
            icon: "Folder",
            sort_order: list.length,
            parent_id: pending.parentId || null,
            created_at: new Date().toISOString(),
          });
        }
      });
    }

    return list;
  }, [serverCategories, pendingAdds, pendingDeletes, projectId]);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  const addCategoryMutation = useMutation({
    mutationKey: ["addCategory", projectId],
    mutationFn: async ({ name, code }: { name: string, code?: string }) => {
      if (!projectId) throw new Error("No project ID");
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) : -1;
      const { error } = await supabase
        .from("project_categories")
        .insert({ project_id: projectId, name: name.trim(), code: code?.trim() || "", sort_order: maxOrder + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category added!");
      queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
    },
    onError: (error: any) => {
      if (isNetworkError(error)) return;
      if (error.code === "23505") {
        toast.error("Category already exists");
      } else {
        toast.error("Failed to add category");
      }
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationKey: ["deleteCategory", projectId],
    mutationFn: async (id: string) => {
      const category = serverCategories.find(c => c.id === id);
      const categoryName = category?.name;

      const { error } = await supabase
        .from("project_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;

      if (categoryName) {
        await supabase
          .from("transactions")
          .update({ category: "General" })
          .eq("category", categoryName);
      }
    },
    onSuccess: () => {
      toast.success("Category removed");
      queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", projectId] });
    },
    onError: (error: any) => {
      if (isNetworkError(error)) return;
      toast.error("Failed to delete category");
    }
  });

  const renameCategoryMutation = useMutation({
    mutationKey: ["renameCategory", projectId],
    mutationFn: async ({ id, newName }: { id: string, newName: string }) => {
      const category = serverCategories.find(c => c.id === id);
      if (!category) throw new Error("Category not found");
      const oldName = category.name;
      const trimmedNewName = newName.trim();

      const { error } = await supabase
        .from("project_categories")
        .update({ name: trimmedNewName })
        .eq("id", id);
      if (error) throw error;

      const { error: txError } = await supabase
        .from("transactions")
        .update({ category: trimmedNewName })
        .eq("category", oldName);
      if (txError) throw txError;
    },
    onSuccess: () => {
      toast.success("Category renamed!");
      queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", projectId] });
    },
    onError: (error: any) => {
      if (isNetworkError(error)) return;
      toast.error("Failed to rename category");
    }
  });

  const updateCategoryCodeMutation = useMutation({
    mutationKey: ["updateCategoryCode", projectId],
    mutationFn: async ({ id, code }: { id: string, code: string }) => {
      const { error } = await supabase
        .from("project_categories")
        .update({ code: code.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
    },
    onError: (error: any) => {
      if (isNetworkError(error)) return;
      toast.error("Failed to update code");
    }
  });

  const updateCategoryIconMutation = useMutation({
    mutationKey: ["updateCategoryIcon", projectId],
    mutationFn: async ({ id, icon }: { id: string, icon: string }) => {
      const { error } = await supabase
        .from("project_categories")
        .update({ icon } as { icon: string })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
    },
    onError: (error: any) => {
      if (isNetworkError(error)) return;
      toast.error("Failed to update icon");
    }
  });

  const reorderCategoryMutation = useMutation({
    mutationKey: ["reorderCategory", projectId],
    mutationFn: async ({ id, direction }: { id: string, direction: "up" | "down" }) => {
      const idx = serverCategories.findIndex(c => c.id === id);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= serverCategories.length) return;

      const current = serverCategories[idx];
      const swap = serverCategories[swapIdx];

      const currentOrder = current.sort_order !== swap.sort_order ? current.sort_order : idx;
      const swapOrder = current.sort_order !== swap.sort_order ? swap.sort_order : swapIdx;

      await Promise.all([
        supabase.from("project_categories").update({ sort_order: swapOrder } as { sort_order: number }).eq("id", current.id),
        supabase.from("project_categories").update({ sort_order: currentOrder } as { sort_order: number }).eq("id", swap.id),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
    },
    onError: (error: any) => {
      if (isNetworkError(error)) return;
    }
  });

  const reorderCategoriesMutation = useMutation({
    mutationKey: ["reorderCategories", projectId],
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from("project_categories").update({ sort_order: index } as { sort_order: number }).eq("id", id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
    },
    onError: (error: any) => {
      if (isNetworkError(error)) return;
    }
  });

  const addSubCategoryMutation = useMutation({
    mutationKey: ["addSubCategory", projectId],
    mutationFn: async ({ parentId, name, code }: { parentId: string, name: string, code?: string }) => {
      if (!projectId) throw new Error("No project ID");
      const { error } = await supabase
        .from("project_categories")
        .insert({ project_id: projectId, name: name.trim(), code: code?.trim() || "", parent_id: parentId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sub-category added!");
      queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
    },
    onError: (error: any) => {
      if (isNetworkError(error)) return;
      if (error.code === "23505") {
        toast.error("Sub-category already exists");
      } else {
        toast.error("Failed to add sub-category");
      }
    }
  });

  const updateCategoryParentMutation = useMutation({
    mutationKey: ["updateCategoryParent", projectId],
    mutationFn: async ({ id, newParentId }: { id: string, newParentId: string | null }) => {
      if (newParentId) {
        let currentId = newParentId;
        const visited = new Set<string>();
        while (currentId) {
          if (visited.has(currentId)) throw new Error("CYCLE_DETECTED");
          visited.add(currentId);
          const parent = serverCategories.find(c => c.id === currentId);
          if (!parent) break;
          currentId = parent.parent_id || "";
        }
      }

      const { error } = await supabase
        .from("project_categories")
        .update({ parent_id: newParentId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
    },
    onError: (error: any) => {
      if (isNetworkError(error)) return;
      if (error.message === "CYCLE_DETECTED") {
        toast.error("Cannot create cycle in category hierarchy");
      } else {
        toast.error("Failed to update category parent");
      }
    }
  });

  const bulkUpdateCategoriesMutation = useMutation({
    mutationKey: ["bulkUpdateCategories", projectId],
    mutationFn: async (entries: { code: string; icon: string; name: string; level: number }[]) => {
      if (!projectId) throw new Error("No project ID");
      
      const { data: currentCategories, error: fetchError } = await supabase
        .from("project_categories")
        .select("*")
        .eq("project_id", projectId);

      if (fetchError) throw fetchError;
      const existing = (currentCategories || []) as Category[];
      const existingByCode = new Map<string, Category>();
      const existingByName = new Map<string, Category>();
      existing.forEach(cat => {
        if (cat.code) existingByCode.set(cat.code, cat);
        existingByName.set(cat.name, cat);
      });

      const firstPassMap = new Map<string, any>();
      entries.forEach((entry, index) => {
        const matchedCat = (entry.code && existingByCode.get(entry.code)) || existingByName.get(entry.name);
        const id = matchedCat?.id || crypto.randomUUID();
        const data: any = {
          id,
          project_id: projectId,
          name: entry.name,
          code: entry.code,
          icon: entry.icon,
          sort_order: index,
          parent_id: matchedCat?.parent_id || null 
        };
        if (!firstPassMap.has(id)) {
          firstPassMap.set(id, data);
        }
      });

      const firstPassData = Array.from(firstPassMap.values());
      const { data: upsertedResult, error: upsertError } = await supabase
        .from("project_categories")
        .upsert(firstPassData, { onConflict: 'id' })
        .select();
      
      if (upsertError) throw upsertError;
      const allCatsAfterFirstPass = (upsertedResult || []) as Category[];
      const processedIds = new Set(allCatsAfterFirstPass.map(c => c.id));

      const secondPassMap = new Map<string, any>();
      let parentStack: string[] = [];
      entries.forEach((entry, index) => {
        const matchedRecord = allCatsAfterFirstPass.find(c => 
          (entry.code && c.code === entry.code) || c.name === entry.name
        );
        if (matchedRecord) {
          const id = matchedRecord.id;
          const level = entry.level;
          const parentId = level > 0 ? (parentStack[level - 1] || null) : null;
          secondPassMap.set(id, {
            id,
            project_id: projectId,
            name: entry.name,
            code: entry.code,
            icon: entry.icon,
            sort_order: index,
            parent_id: parentId
          });
          parentStack[level] = id;
          parentStack = parentStack.slice(0, level + 1);
        }
      });

      const secondPassData = Array.from(secondPassMap.values());
      if (secondPassData.length > 0) {
        const { error: hierarchyError } = await supabase
          .from("project_categories")
          .upsert(secondPassData, { onConflict: 'id' });
        if (hierarchyError) throw hierarchyError;
      }

      const toDelete = existing.filter(cat => !processedIds.has(cat.id));
      if (toDelete.length > 0) {
        const deleteIds = toDelete.map(cat => cat.id);
        const { error: deleteError } = await supabase
          .from("project_categories")
          .delete()
          .in("id", deleteIds);
        if (deleteError) throw deleteError;
        for (const cat of toDelete) {
          await supabase
            .from("transactions")
            .update({ category: "General" })
            .eq("category", cat.name);
        }
      }
    },
    onSuccess: () => {
      toast.success("Categories updated successfully");
      queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
    },
    onError: (error: any) => {
      if (isNetworkError(error)) return;
      console.error("Bulk update error:", error);
      toast.error("Failed to update categories: " + error.message);
    }
  });

  return {
    categories,
    loading,
    addCategory: (name: string, code?: string) => addCategoryMutation.mutate({ name, code }),
    addSubCategory: (parentId: string, name: string, code?: string) => addSubCategoryMutation.mutate({ parentId, name, code }),
    deleteCategory: (id: string) => deleteCategoryMutation.mutate(id),
    renameCategory: (id: string, newName: string) => renameCategoryMutation.mutate({ id, newName }),
    updateCategoryCode: (id: string, code: string) => updateCategoryCodeMutation.mutate({ id, code }),
    updateCategoryIcon: (id: string, icon: string) => updateCategoryIconMutation.mutate({ id, icon }),
    reorderCategory: (id: string, direction: "up" | "down") => reorderCategoryMutation.mutate({ id, direction }),
    reorderCategories: (orderedIds: string[]) => reorderCategoriesMutation.mutate(orderedIds),
    updateCategoryParent: (id: string, newParentId: string | null) => updateCategoryParentMutation.mutate({ id, newParentId }),
    bulkUpdateCategories: (entries: any[]) => bulkUpdateCategoriesMutation.mutate(entries),
    buildCategoryTree,
    flattenCategoryTree,
    fetchCategories: () => queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] }),
  };
};
