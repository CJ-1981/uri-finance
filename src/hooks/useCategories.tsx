import { useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, useMutationState } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isNetworkError } from "@/lib/networkUtils";
import { useAuth } from "@/hooks/useAuth";

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
  const { isStandalone } = useAuth();
  const queryClient = useQueryClient();

  const CATEGORIES_KEY = ["project_categories", projectId];
  const LOCAL_CATEGORIES_KEY = `local_categories_${projectId}`;

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
        const vars = mutation.state.variables as any;
        return typeof vars === 'string' ? vars : vars.id;
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
    queryKey: CATEGORIES_KEY,
    queryFn: async () => {
      if (!projectId) return [];

      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_CATEGORIES_KEY);
        const parsedData: Category[] = local ? JSON.parse(local) : [];
        return parsedData.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
      }

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
    networkMode: "always",
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
        if (!existingIds.has(pending.id)) {
          list.push({
            id: pending.id,
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
    mutationFn: async (vars: { id: string, name: string, code?: string, project_id: string, sort_order: number }) => {
      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_CATEGORIES_KEY);
        const existing: Category[] = local ? JSON.parse(local) : [];
        const newCat: Category = {
          id: vars.id,
          project_id: vars.project_id,
          name: vars.name.trim(),
          code: vars.code?.trim() || "",
          icon: "Folder",
          sort_order: vars.sort_order,
          parent_id: null,
          created_at: new Date().toISOString(),
        };
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify([...existing, newCat]));
        return;
      }

      const { error } = await supabase
        .from("project_categories")
        .insert({ id: vars.id, project_id: vars.project_id, name: vars.name.trim(), code: vars.code?.trim() || "", sort_order: vars.sort_order });
      if (error) throw error;
    },
    onMutate: async (newCat) => {
      const queryKey = ["project_categories", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      
      const optimistic: Category = {
        id: newCat.id,
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
      if (isNetworkError(error)) {
        toast.info("Category saved offline");
        return;
      }
      queryClient.setQueryData(["project_categories", projectId], context?.previous);
      if (error.code === "23505") {
        toast.error("Category already exists");
      } else {
        toast.error("Failed to add category");
      }
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationKey: ["deleteCategory", projectId],
    mutationFn: async ({ id, project_id, categoryName }: { id: string, project_id: string, categoryName?: string }) => {
      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_CATEGORIES_KEY);
        const existing: Category[] = local ? JSON.parse(local) : [];
        const updated = existing.filter(c => c.id !== id);
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(updated));

        // Reassign transactions if category name provided
        if (categoryName) {
          const txKey = `local_transactions_${project_id}`;
          const localTxs = localStorage.getItem(txKey);
          if (localTxs) {
            const txs = JSON.parse(localTxs);
            const updatedTxs = txs.map((t: any) => 
              t.category === categoryName ? { ...t, category: "General" } : t
            );
            localStorage.setItem(txKey, JSON.stringify(updatedTxs));
          }
        }
        return;
      }

      const { error } = await supabase.from("project_categories").delete().eq("id", id).eq("project_id", project_id);
      if (error) throw error;
      
      if (categoryName) {
        const { error: txError } = await supabase
          .from("transactions")
          .update({ category: "General" })
          .eq("category", categoryName)
          .eq("project_id", project_id);
        
        if (txError) throw txError;
      }
    },
    onMutate: async ({ id }) => {
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
      if (isNetworkError(error)) {
        toast.info("Delete pending offline");
        return;
      }
      queryClient.setQueryData(["project_categories", projectId], context?.previous);
      toast.error("Failed to delete category");
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
          queryClient.invalidateQueries({ queryKey: ["infinite_transactions", projectId] });
        }, 2000);
      }
    },
  });

  const renameCategoryMutation = useMutation({
    mutationKey: ["renameCategory", projectId],
    mutationFn: async ({ id, newName, project_id, oldName }: { id: string, newName: string, project_id: string, oldName: string }) => {
      const trimmedNewName = newName.trim();
      
      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_CATEGORIES_KEY);
        const existing: Category[] = local ? JSON.parse(local) : [];
        const updated = existing.map(c => c.id === id ? { ...c, name: trimmedNewName } : c);
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(updated));

        // Update transactions
        const txKey = `local_transactions_${project_id}`;
        const localTxs = localStorage.getItem(txKey);
        if (localTxs) {
          const txs = JSON.parse(localTxs);
          const updatedTxs = txs.map((t: any) => 
            t.category === oldName ? { ...t, category: trimmedNewName } : t
          );
          localStorage.setItem(txKey, JSON.stringify(updatedTxs));
        }
        return;
      }

      const { error } = await supabase.from("project_categories").update({ name: trimmedNewName }).eq("id", id).eq("project_id", project_id);
      if (error) throw error;
      
      const { error: txError } = await supabase
        .from("transactions")
        .update({ category: trimmedNewName })
        .eq("category", oldName)
        .eq("project_id", project_id);
      
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
      if (isNetworkError(error)) {
        toast.info("Rename pending offline");
        return;
      }
      queryClient.setQueryData(["project_categories", projectId], context?.previous);
      toast.error("Failed to rename category");
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
          queryClient.invalidateQueries({ queryKey: ["infinite_transactions", projectId] });
        }, 2000);
      }
    },
  });

  const updateCategoryCodeMutation = useMutation({
    mutationKey: ["updateCategoryCode", projectId],
    mutationFn: async ({ id, code, project_id }: { id: string, code: string, project_id: string }) => {
      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_CATEGORIES_KEY);
        const existing: Category[] = local ? JSON.parse(local) : [];
        const updated = existing.map(c => c.id === id ? { ...c, code: code.trim() } : c);
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(updated));
        return;
      }

      const { error } = await supabase.from("project_categories").update({ code: code.trim() }).eq("id", id).eq("project_id", project_id);
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
      if (navigator.onLine || isStandalone) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const updateCategoryIconMutation = useMutation({
    mutationKey: ["updateCategoryIcon", projectId],
    mutationFn: async ({ id, icon, project_id }: { id: string, icon: string, project_id: string }) => {
      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_CATEGORIES_KEY);
        const existing: Category[] = local ? JSON.parse(local) : [];
        const updated = existing.map(c => c.id === id ? { ...c, icon } : c);
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(updated));
        return;
      }

      const { error } = await supabase.from("project_categories").update({ icon } as { icon: string }).eq("id", id).eq("project_id", project_id);
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
      if (navigator.onLine || isStandalone) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const reorderCategoryMutation = useMutation({
    mutationKey: ["reorderCategory", projectId],
    mutationFn: async ({ id, direction, project_id }: { id: string, direction: "up" | "down", project_id: string }) => {
      const idx = serverCategories.findIndex(c => c.id === id);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= serverCategories.length) return;
      const current = serverCategories[idx];
      const swap = serverCategories[swapIdx];
      
      const currentOrder = current.sort_order === swap.sort_order ? idx : current.sort_order;
      const swapOrder = current.sort_order === swap.sort_order ? swapIdx : swap.sort_order;

      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_CATEGORIES_KEY);
        const existing: Category[] = local ? JSON.parse(local) : [];
        const updated = existing.map(c => {
          if (c.id === current.id) return { ...c, sort_order: swapOrder };
          if (c.id === swap.id) return { ...c, sort_order: currentOrder };
          return c;
        });
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(updated));
        return;
      }

      try {
        const results = await Promise.all([
          supabase.from("project_categories").update({ sort_order: swapOrder }).eq("id", current.id).eq("project_id", project_id),
          supabase.from("project_categories").update({ sort_order: currentOrder }).eq("id", swap.id).eq("project_id", project_id),
        ]);

        const err = results.find(r => r.error)?.error;
        if (err) throw err;
      } catch (error) {
        // Rollback attempt
        await Promise.all([
          supabase.from("project_categories").update({ sort_order: currentOrder }).eq("id", current.id).eq("project_id", project_id),
          supabase.from("project_categories").update({ sort_order: swapOrder }).eq("id", swap.id).eq("project_id", project_id),
        ]);
        throw error;
      }
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const reorderCategoriesMutation = useMutation({
    mutationKey: ["reorderCategories", projectId],
    mutationFn: async (orderedIds: string[]) => {
      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_CATEGORIES_KEY);
        const existing: Category[] = local ? JSON.parse(local) : [];
        const updated = existing.map(c => {
          const newIdx = orderedIds.indexOf(c.id);
          if (newIdx !== -1) return { ...c, sort_order: newIdx };
          return c;
        });
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(updated));
        return;
      }

      const updates = orderedIds.map((id, index) =>
        supabase.from("project_categories").update({ sort_order: index } as { sort_order: number }).eq("id", id).eq("project_id", projectId!)
      );
      const results = await Promise.all(updates);
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw firstError;
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const addSubCategoryMutation = useMutation({
    mutationKey: ["addSubCategory", projectId],
    mutationFn: async (vars: { id: string, parentId: string, name: string, code?: string, project_id: string }) => {
      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_CATEGORIES_KEY);
        const existing: Category[] = local ? JSON.parse(local) : [];
        const newCat: Category = {
          id: vars.id,
          project_id: vars.project_id,
          name: vars.name.trim(),
          code: vars.code?.trim() || "",
          icon: "Folder",
          sort_order: existing.length,
          parent_id: vars.parentId,
          created_at: new Date().toISOString(),
        };
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify([...existing, newCat]));
        return;
      }

      const { error } = await supabase.from("project_categories").insert({ id: vars.id, project_id: vars.project_id, name: vars.name.trim(), code: vars.code?.trim() || "", parent_id: vars.parentId });
      if (error) throw error;
    },
    onMutate: async (newSub) => {
      const queryKey = ["project_categories", projectId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const optimistic: Category = {
        id: newSub.id,
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
      if (isNetworkError(error)) {
        toast.info("Sub-category saved offline");
        return;
      }
      queryClient.setQueryData(["project_categories", projectId], context?.previous);
      if (error.code === "23505") {
        toast.error("Sub-category already exists");
      } else {
        toast.error("Failed to add sub-category");
      }
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  const updateCategoryParentMutation = useMutation({
    mutationKey: ["updateCategoryParent", projectId],
    mutationFn: async ({ id, newParentId, project_id }: { id: string, newParentId: string | null, project_id: string }) => {
      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_CATEGORIES_KEY);
        const existing: Category[] = local ? JSON.parse(local) : [];
        
        // Simple cycle check for standalone
        if (newParentId) {
          let currentId = newParentId;
          const visited = new Set<string>();
          visited.add(id);
          while (currentId) {
            if (visited.has(currentId)) throw new Error("CYCLE_DETECTED");
            visited.add(currentId);
            const parent = existing.find(c => c.id === currentId);
            if (!parent) break;
            currentId = parent.parent_id || "";
          }
        }

        const updated = existing.map(c => c.id === id ? { ...c, parent_id: newParentId } : c);
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(updated));
        return;
      }

      if (newParentId) {
        const { data: freshCategories, error: fetchError } = await supabase
          .from("project_categories")
          .select("id, parent_id")
          .eq("project_id", project_id);
        
        if (fetchError) throw fetchError;

        let currentId = newParentId;
        const visited = new Set<string>();
        visited.add(id);

        while (currentId) {
          if (visited.has(currentId)) throw new Error("CYCLE_DETECTED");
          visited.add(currentId);
          const parent = freshCategories.find(c => c.id === currentId);
          if (!parent) break;
          currentId = parent.parent_id || "";
        }
      }
      const { error } = await supabase.from("project_categories").update({ parent_id: newParentId }).eq("id", id).eq("project_id", project_id);
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
      if (isNetworkError(error)) {
        toast.info("Parent update saved offline");
        return;
      }
      queryClient.setQueryData(["project_categories", projectId], context?.previous);
      if (error.message === "CYCLE_DETECTED") {
        toast.error("Cannot create cycle in category hierarchy");
      } else {
        toast.error("Failed to update category parent");
      }
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
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

      let existing: Category[] = [];
      if (isStandalone) {
        const local = localStorage.getItem(LOCAL_CATEGORIES_KEY);
        existing = local ? JSON.parse(local) : [];
      } else {
        const { data: currentCategories, error: fetchError } = await supabase.from("project_categories").select("*").eq("project_id", projectId);
        if (fetchError) throw fetchError;
        existing = (currentCategories || []) as Category[];
      }

      const existingByCode = new Map<string, Category>();
      const existingByName = new Map<string, Category>();
      existing.forEach(cat => {
        if (cat.code) existingByCode.set(cat.code, cat);
        existingByName.set(cat.name, cat);
      });

      const processedData: Category[] = [];
      let parentStack: string[] = [];

      entries.forEach((entry, index) => {
        const matchedCat = (entry.code && existingByCode.get(entry.code)) || existingByName.get(entry.name);
        const id = matchedCat?.id || crypto.randomUUID();
        const level = entry.level;
        const parentId = level > 0 ? (parentStack[level - 1] || null) : null;
        
        const cat: Category = {
          id,
          project_id: projectId,
          name: entry.name,
          code: entry.code,
          icon: entry.icon,
          sort_order: index,
          parent_id: parentId,
          created_at: matchedCat?.created_at || new Date().toISOString()
        };
        processedData.push(cat);
        parentStack[level] = id;
        parentStack = parentStack.slice(0, level + 1);
      });

      if (isStandalone) {
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(processedData));
        return;
      }

      // Supabase logic (Simplified for brevity but keeping original behavior)
      const { data: upsertedResult, error: upsertError } = await supabase.from("project_categories").upsert(processedData, { onConflict: 'id' }).select();
      if (upsertError) throw upsertError;

      const processedIds = new Set(processedData.map(c => c.id));
      const toDelete = existing.filter(cat => !processedIds.has(cat.id));
      if (toDelete.length > 0) {
        const deleteIds = toDelete.map(cat => cat.id);
        const { error: deleteError = null } = await supabase.from("project_categories").delete().in("id", deleteIds).eq("project_id", projectId);
        if (deleteError) throw deleteError;
        for (const cat of toDelete) {
          await supabase
            .from("transactions")
            .update({ category: "General" })
            .eq("category", cat.name)
            .eq("project_id", projectId);
        }
        queryClient.invalidateQueries({ queryKey: ["infinite_transactions", projectId] });
      }
    },
    onSuccess: () => {
      toast.success("Categories updated successfully");
    },
    onError: (error: any) => {
      if (isNetworkError(error)) {
        toast.info("Bulk update saved offline");
        return;
      }
      console.error("Bulk update error:", error);
      toast.error("Failed to update categories: " + error.message);
    },
    onSettled: () => {
      if (navigator.onLine || isStandalone) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] });
        }, 2000);
      }
    },
  });

  return {
    categories,
    loading,
    addCategory: (name: string, code?: string) => {
      if (!projectId) return;
      const id = crypto.randomUUID();
      const sort_order = categories.length;
      addCategoryMutation.mutate({ id, name, code, project_id: projectId, sort_order });
    },
    addSubCategory: (parentId: string, name: string, code?: string) => {
      if (!projectId) return;
      const id = crypto.randomUUID();
      addSubCategoryMutation.mutate({ id, parentId, name, code, project_id: projectId });
    },
    deleteCategory: (id: string) => {
      if (!projectId) return;
      const cat = categories.find(c => c.id === id);
      deleteCategoryMutation.mutate({ id, project_id: projectId, categoryName: cat?.name });
    },
    renameCategory: (id: string, newName: string) => {
      if (!projectId) return;
      const cat = categories.find(c => c.id === id);
      if (!cat) return;
      renameCategoryMutation.mutate({ id, newName, project_id: projectId, oldName: cat.name });
    },
    updateCategoryCode: (id: string, code: string) => {
      if (!projectId) return;
      updateCategoryCodeMutation.mutate({ id, code, project_id: projectId });
    },
    updateCategoryIcon: (id: string, icon: string) => {
      if (!projectId) return;
      updateCategoryIconMutation.mutate({ id, icon, project_id: projectId });
    },
    reorderCategory: (id: string, direction: "up" | "down") => {
      if (!projectId) return;
      reorderCategoryMutation.mutate({ id, direction, project_id: projectId });
    },
    reorderCategories: (orderedIds: string[]) => reorderCategoriesMutation.mutate(orderedIds),
    updateCategoryParent: (id: string, newParentId: string | null) => {
      if (!projectId) return;
      updateCategoryParentMutation.mutate({ id, newParentId, project_id: projectId });
    },
    bulkUpdateCategories: (entries: any[]) => bulkUpdateCategoriesMutation.mutate(entries),
    buildCategoryTree,
    flattenCategoryTree,
    fetchCategories: () => queryClient.invalidateQueries({ queryKey: ["project_categories", projectId] }),
  };
};
