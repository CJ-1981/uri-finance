import { useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, useMutationState } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isNetworkError } from "@/lib/networkUtils";

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
  const queryClient = useQueryClient();

  // Track pending and recently successful "add" mutations to keep them in UI during re-sync
  const pendingAdds = useMutationState({
    filters: { mutationKey: ["addCategory", projectId] },
    select: (mutation) => {
      const isRecent = mutation.state.status === "success" && (Date.now() - mutation.state.submittedAt < 60000);
      if (mutation.state.status === "pending" || isRecent) {
        return mutation.state.variables as any;
      }
      return null;
    },
  }).filter(Boolean);

  // Track pending and recently successful "delete" IDs
  const pendingDeletes = useMutationState({
    filters: { mutationKey: ["deleteCategory", projectId] },
    select: (mutation) => {
      const isRecent = mutation.state.status === "success" && (Date.now() - mutation.state.submittedAt < 60000);
      if (mutation.state.status === "pending" || isRecent) {
        return mutation.state.variables as string;
      }
      return null;
    },
  }).filter(Boolean);

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
      const maxOrder = serverCategories.length > 0 ? Math.max(...serverCategories.map(c => c.sort_order)) : -1;
      const { error } = await supabase
        .from("project_categories")
        .insert({ project_id: projectId, name: name.trim(), code: code?.trim() || "", sort_order: maxOrder + 1 });
      if (error) throw error;
    },
    onMutate: async (newCat) => {
      const queryKey = ["project_categories", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const optimistic: Category = {
        id: crypto.randomUUID(),
        project_id: projectId!,
        name: newCat.name,
        code: newCat.code || "",
        icon: "Folder",
        sort_order: (previous as Category[])?.length || 0,
        parent_id: null,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData(queryKey, (old: any) => [...(old || []), optimistic]);
      return { previous };
    },
    onSuccess: () => {
      toast.success("Category added!");
    },
    onError: (error: any, variables, context) => {
      if (isNetworkError(error)) return;
      queryClient.setQueryData(["project_categories", projectId], context?.previous);
      if (error.code === "23505") {
        toast.error("Category already exists");
      } else {
        toast.error("Failed to add category");
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationKey: ["deleteCategory", projectId],
    mutationFn: async (id: string) => {
      if (!projectId) throw new Error("No project ID");
      const category = serverCategories.find(c => c.id === id);
      const categoryName = category?.name;
      const { error } = await supabase.from("project_categories").delete().eq("id", id);
      if (error) throw error;
      if (categoryName) {
        // Scope transaction update to current project
        await supabase
          .from("transactions")
          .update({ category: "General" })
          .eq("category", categoryName)
          .eq("project_id", projectId);
      }
    },
    onMutate: async (id) => {
      const queryKey = ["project_categories", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => (old as Category[])?.filter(c => c.id !== id));
      return { previous };
    },
    onSuccess: () => {
      toast.success("Category removed");
    },
    onError: (error: any, variables, context) => {
      if (isNetworkError(error)) return;
      queryClient.setQueryData(["project_categories", projectId], context?.previous);
      toast.error("Failed to delete category");
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
          queryClient.invalidateQueries({ queryKey: ["transactions", projectId] });
        }, 2000);
      }
    },
  });

  const renameCategoryMutation = useMutation({
    mutationKey: ["renameCategory", projectId],
    mutationFn: async ({ id, newName }: { id: string, newName: string }) => {
      if (!projectId) throw new Error("No project ID");
      const category = serverCategories.find(c => c.id === id);
      if (!category) throw new Error("Category not found");
      const oldName = category.name;
      const trimmedNewName = newName.trim();
      const { error } = await supabase.from("project_categories").update({ name: trimmedNewName }).eq("id", id);
      if (error) throw error;
      
      // Scope transaction update to current project
      const { error: txError } = await supabase
        .from("transactions")
        .update({ category: trimmedNewName })
        .eq("category", oldName)
        .eq("project_id", projectId);
      if (txError) throw txError;
    },
    onMutate: async ({ id, newName }) => {
      const queryKey = ["project_categories", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => (old as Category[])?.map(c => c.id === id ? { ...c, name: newName } : c));
      return { previous };
    },
    onSuccess: () => {
      toast.success("Category renamed!");
    },
    onError: (error: any, variables, context) => {
      if (isNetworkError(error)) return;
      queryClient.setQueryData(["project_categories", projectId], context?.previous);
      toast.error("Failed to rename category");
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
          queryClient.invalidateQueries({ queryKey: ["transactions", projectId] });
        }, 2000);
      }
    },
  });

  const updateCategoryCodeMutation = useMutation({
    mutationKey: ["updateCategoryCode", projectId],
    mutationFn: async ({ id, code }: { id: string, code: string }) => {
      const { error } = await supabase.from("project_categories").update({ code: code.trim() }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, code }) => {
      const queryKey = ["project_categories", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => (old as Category[])?.map(c => c.id === id ? { ...c, code } : c));
      return { previous };
    },
    onSuccess: () => {
      toast.success("Code updated");
    },
    onError: (error: any, variables, context) => {
      if (isNetworkError(error)) return;
      queryClient.setQueryData(["project_categories", projectId], context?.previous);
      toast.error("Failed to update code");
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const updateCategoryIconMutation = useMutation({
    mutationKey: ["updateCategoryIcon", projectId],
    mutationFn: async ({ id, icon }: { id: string, icon: string }) => {
      const { error } = await supabase.from("project_categories").update({ icon } as { icon: string }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, icon }) => {
      const queryKey = ["project_categories", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => (old as Category[])?.map(c => c.id === id ? { ...c, icon } : c));
      return { previous };
    },
    onSuccess: () => {
      toast.success("Icon updated");
    },
    onError: (error: any, variables, context) => {
      if (isNetworkError(error)) return;
      queryClient.setQueryData(["project_categories", projectId], context?.previous);
      toast.error("Failed to update icon");
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const reorderCategoryMutation = useMutation({
    mutationKey: ["reorderCategory", projectId],
    mutationFn: async ({ id, direction }: { id: string, direction: "up" | "down" }) => {
      const idx = categories.findIndex(c => c.id === id);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= categories.length) return;
      const current = categories[idx];
      const swap = categories[swapIdx];
      
      // Handle equal sort_order by falling back to indices
      const currentOrder = current.sort_order === swap.sort_order ? idx : current.sort_order;
      const swapOrder = current.sort_order === swap.sort_order ? swapIdx : swap.sort_order;

      try {
        const { error } = await Promise.all([
          supabase.from("project_categories").update({ sort_order: swapOrder }).eq("id", current.id),
          supabase.from("project_categories").update({ sort_order: currentOrder }).eq("id", swap.id),
        ]).then(([res1, res2]) => ({ error: res1.error || res2.error }));

        if (error) throw error;
      } catch (error) {
        // Rollback attempt
        await Promise.all([
          supabase.from("project_categories").update({ sort_order: currentOrder }).eq("id", current.id),
          supabase.from("project_categories").update({ sort_order: swapOrder }).eq("id", swap.id),
        ]);
        throw error;
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const reorderCategoriesMutation = useMutation({
    mutationKey: ["reorderCategories", projectId],
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from("project_categories").update({ sort_order: index } as { sort_order: number }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw firstError;
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const addSubCategoryMutation = useMutation({
    mutationKey: ["addSubCategory", projectId],
    mutationFn: async ({ parentId, name, code }: { parentId: string, name: string, code?: string }) => {
      if (!projectId) throw new Error("No project ID");
      const { error } = await supabase.from("project_categories").insert({ project_id: projectId, name: name.trim(), code: code?.trim() || "", parent_id: parentId });
      if (error) throw error;
    },
    onMutate: async (newSub) => {
      const queryKey = ["project_categories", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const optimistic = {
        id: crypto.randomUUID(),
        project_id: projectId!,
        name: newSub.name,
        code: newSub.code || "",
        icon: "Folder",
        sort_order: (previous as Category[])?.length || 0,
        parent_id: newSub.parentId,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData(queryKey, (old: any) => [...(old || []), optimistic]);
      return { previous };
    },
    onSuccess: () => {
      toast.success("Sub-category added!");
    },
    onError: (error: any, variables, context) => {
      if (isNetworkError(error)) return;
      queryClient.setQueryData(["project_categories", projectId], context?.previous);
      if (error.code === "23505") {
        toast.error("Sub-category already exists");
      } else {
        toast.error("Failed to add sub-category");
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const updateCategoryParentMutation = useMutation({
    mutationKey: ["updateCategoryParent", projectId],
    mutationFn: async ({ id, newParentId }: { id: string, newParentId: string | null }) => {
      if (newParentId) {
        // Fetch fresh data for cycle detection
        const { data: freshCategories, error: fetchError } = await supabase
          .from("project_categories")
          .select("id, parent_id")
          .eq("project_id", projectId);
        
        if (fetchError) throw fetchError;

        let currentId = newParentId;
        const visited = new Set<string>();
        // Seed visited with the moving category ID to detect moves under own descendants
        visited.add(id);

        while (currentId) {
          if (visited.has(currentId)) throw new Error("CYCLE_DETECTED");
          visited.add(currentId);
          const parent = freshCategories.find(c => c.id === currentId);
          if (!parent) break;
          currentId = parent.parent_id || "";
        }
      }
      const { error } = await supabase.from("project_categories").update({ parent_id: newParentId }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, newParentId }) => {
      const queryKey = ["project_categories", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => (old as Category[])?.map(c => c.id === id ? { ...c, parent_id: newParentId } : c));
      return { previous };
    },
    onSuccess: () => {
      toast.success("Category parent updated");
    },
    onError: (error: any, variables, context) => {
      if (isNetworkError(error)) return;
      queryClient.setQueryData(["project_categories", projectId], context?.previous);
      if (error.message === "CYCLE_DETECTED") {
        toast.error("Cannot create cycle in category hierarchy");
      } else {
        toast.error("Failed to update category parent");
      }
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const bulkUpdateCategoriesMutation = useMutation({
    mutationKey: ["bulkUpdateCategories", projectId],
    mutationFn: async (entries: { code: string; icon: string; name: string; level: number }[]) => {
      if (!projectId) throw new Error("No project ID");
      const { data: currentCategories, error: fetchError } = await supabase.from("project_categories").select("*").eq("project_id", projectId);
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
        const data: any = { id, project_id: projectId, name: entry.name, code: entry.code, icon: entry.icon, sort_order: index, parent_id: matchedCat?.parent_id || null };
        if (!firstPassMap.has(id)) firstPassMap.set(id, data);
      });
      const firstPassData = Array.from(firstPassMap.values());
      const { data: upsertedResult, error: upsertError } = await supabase.from("project_categories").upsert(firstPassData, { onConflict: 'id' }).select();
      if (upsertError) throw upsertError;
      const allCatsAfterFirstPass = (upsertedResult || []) as Category[];
      const processedIds = new Set(allCatsAfterFirstPass.map(c => c.id));
      const secondPassMap = new Map<string, any>();
      let parentStack: string[] = [];
      entries.forEach((entry, index) => {
        const matchedRecord = allCatsAfterFirstPass.find(c => (entry.code && c.code === entry.code) || c.name === entry.name);
        if (matchedRecord) {
          const id = matchedRecord.id;
          const level = entry.level;
          const parentId = level > 0 ? (parentStack[level - 1] || null) : null;
          secondPassMap.set(id, { id, project_id: projectId, name: entry.name, code: entry.code, icon: entry.icon, sort_order: index, parent_id: parentId });
          parentStack[level] = id;
          parentStack = parentStack.slice(0, level + 1);
        }
      });
      const secondPassData = Array.from(secondPassMap.values());
      if (secondPassData.length > 0) {
        const { error: hierarchyError } = await supabase.from("project_categories").upsert(secondPassData, { onConflict: 'id' });
        if (hierarchyError) throw hierarchyError;
      }
      const toDelete = existing.filter(cat => !processedIds.has(cat.id));
      if (toDelete.length > 0) {
        const deleteIds = toDelete.map(cat => cat.id);
        const { error: deleteError } = await supabase.from("project_categories").delete().in("id", deleteIds);
        if (deleteError) throw deleteError;
        for (const cat of toDelete) {
          // Scope transaction update to current project
          await supabase
            .from("transactions")
            .update({ category: "General" })
            .eq("category", cat.name)
            .eq("project_id", projectId);
        }
      }
    },
    onSuccess: () => {
      toast.success("Categories updated successfully");
    },
    onError: (error: any) => {
      if (isNetworkError(error)) return;
      console.error("Bulk update error:", error);
      toast.error("Failed to update categories: " + error.message);
    },
    onSettled: () => {
      if (navigator.onLine) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
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
