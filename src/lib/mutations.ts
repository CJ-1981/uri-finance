import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/**
 * Shared mutation functions for TanStack Query defaults and resume support.
 */

const getIsStandalone = () => localStorage.getItem("is_standalone") === "true";

export const mutationFunctions = {
  addTransaction: async (tx: any) => {
    if (getIsStandalone()) {
      const key = `local_transactions_${tx.project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const newTx = {
        ...tx,
        description: tx.description || null,
        transaction_date: tx.transaction_date || format(new Date(), "yyyy-MM-dd"),
        custom_values: tx.custom_values || {},
        currency: tx.currency || "EUR",
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      localStorage.setItem(key, JSON.stringify([newTx, ...existing]));
      return tx.id;
    }

    const { error } = await supabase.from("transactions").insert({
      id: tx.id,
      project_id: tx.project_id,
      user_id: tx.user_id,
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      description: tx.description || null,
      transaction_date: tx.transaction_date || format(new Date(), "yyyy-MM-dd"),
      custom_values: tx.custom_values || {},
      currency: tx.currency || "EUR",
    });
    if (error) throw error;
    return tx.id;
  },

  updateTransaction: async ({ id, updates, project_id }: any) => {
    if (getIsStandalone()) {
      const key = `local_transactions_${project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const updated = existing.map((t: any) => t.id === id ? { ...t, ...updates } : t);
      localStorage.setItem(key, JSON.stringify(updated));
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .update(updates)
      .eq("id", id)
      .eq("project_id", project_id);
    if (error) throw error;
  },

  deleteTransaction: async ({ id, project_id }: any) => {
    if (getIsStandalone()) {
      const key = `local_transactions_${project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const updated = existing.map((t: any) => t.id === id ? { ...t, deleted_at: new Date().toISOString() } : t);
      localStorage.setItem(key, JSON.stringify(updated));
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("project_id", project_id);
    if (error) throw error;

    await supabase
      .from("project_files")
      .update({ transaction_id: null })
      .eq("transaction_id", id);
  },

  addCategory: async (vars: any) => {
    if (getIsStandalone()) {
      const key = `local_categories_${vars.project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const newCat = { 
        id: vars.id, 
        project_id: vars.project_id, 
        name: vars.name.trim(), 
        code: vars.code?.trim() || "", 
        sort_order: vars.sort_order,
        icon: "Folder",
        parent_id: null,
        created_at: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify([...existing, newCat]));
      return;
    }

    const { error } = await supabase
      .from("project_categories")
      .insert({ 
        id: vars.id, 
        project_id: vars.project_id, 
        name: vars.name.trim(), 
        code: vars.code?.trim() || "", 
        sort_order: vars.sort_order 
      });
    if (error) throw error;
  },

  deleteCategory: async ({ id, project_id, categoryName }: any) => {
    if (getIsStandalone()) {
      const key = `local_categories_${project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const updated = existing.filter((c: any) => c.id !== id);
      localStorage.setItem(key, JSON.stringify(updated));

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
      await supabase
        .from("transactions")
        .update({ category: "General" })
        .eq("category", categoryName)
        .eq("project_id", project_id);
    }
  },

  renameCategory: async ({ id, newName, project_id, oldName }: any) => {
    if (getIsStandalone()) {
      const key = `local_categories_${project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const updated = existing.map((c: any) => c.id === id ? { ...c, name: newName } : c);
      localStorage.setItem(key, JSON.stringify(updated));

      const txKey = `local_transactions_${project_id}`;
      const localTxs = localStorage.getItem(txKey);
      if (localTxs) {
        const txs = JSON.parse(localTxs);
        const updatedTxs = txs.map((t: any) => 
          t.category === oldName ? { ...t, category: newName } : t
        );
        localStorage.setItem(txKey, JSON.stringify(updatedTxs));
      }
      return;
    }

    let finalProjectId = project_id;
    let finalOldName = oldName;

    // Fetch missing info if not provided (needed for resumed mutations)
    if (!finalProjectId || !finalOldName) {
      const { data, error: fetchError } = await supabase
        .from("project_categories")
        .select("project_id, name")
        .eq("id", id)
        .single();
      
      if (fetchError) throw fetchError;
      finalProjectId = data.project_id;
      finalOldName = data.name;
    }

    const { error } = await supabase.from("project_categories").update({ name: newName }).eq("id", id).eq("project_id", finalProjectId);
    if (error) throw error;
    
    await supabase
      .from("transactions")
      .update({ category: newName })
      .eq("category", finalOldName)
      .eq("project_id", finalProjectId);
  },

  updateCategoryCode: async ({ id, code, project_id }: any) => {
    if (getIsStandalone()) {
      const key = `local_categories_${project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const updated = existing.map((c: any) => c.id === id ? { ...c, code: code.trim() } : c);
      localStorage.setItem(key, JSON.stringify(updated));
      return;
    }

    const { error } = await supabase.from("project_categories").update({ code: code.trim() }).eq("id", id).eq("project_id", project_id);
    if (error) throw error;
  },

  updateCategoryIcon: async ({ id, icon, project_id }: any) => {
    if (getIsStandalone()) {
      const key = `local_categories_${project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const updated = existing.map((c: any) => c.id === id ? { ...c, icon } : c);
      localStorage.setItem(key, JSON.stringify(updated));
      return;
    }

    const { error } = await supabase.from("project_categories").update({ icon }).eq("id", id).eq("project_id", project_id);
    if (error) throw error;
  },

  reorderCategory: async ({ id, sort_order, project_id }: any) => {
    if (getIsStandalone()) {
      const key = `local_categories_${project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const updated = existing.map((c: any) => c.id === id ? { ...c, sort_order } : c);
      localStorage.setItem(key, JSON.stringify(updated));
      return;
    }

    const { error } = await supabase.from("project_categories").update({ sort_order }).eq("id", id).eq("project_id", project_id);
    if (error) throw error;
  },

  // Files
  uploadFile: async () => {
    throw new Error("uploadFile not implemented in background mutations: see specific storage handler in useFiles.tsx");
  },

  // Custom Columns
  addColumn: async (vars: any) => {
    if (getIsStandalone()) {
      const key = `local_custom_columns_${vars.project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const maxOrder = existing.length > 0 ? Math.max(...existing.map((c: any) => c.sort_order)) : -1;
      const newCol = {
        ...vars,
        masked: false,
        required: false,
        sort_order: maxOrder + 1,
        suggestions: [],
        suggestion_colors: {},
        created_at: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify([...existing, newCol]));
      return;
    }

    const { error } = await supabase.from("custom_columns").insert(vars);
    if (error) throw error;
  },

  deleteColumn: async ({ id, project_id, name }: any) => {
    if (getIsStandalone()) {
      const key = `local_custom_columns_${project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const updated = existing.filter((c: any) => c.id !== id);
      localStorage.setItem(key, JSON.stringify(updated));

      // Remove the custom value from transactions
      const txKey = `local_transactions_${project_id}`;
      const localTxs = localStorage.getItem(txKey);
      if (localTxs) {
        const txs = JSON.parse(localTxs);
        const updatedTxs = txs.map((t: any) => {
          if (t.custom_values && t.custom_values[name] !== undefined) {
            const newVals = { ...t.custom_values };
            delete newVals[name];
            return { ...t, custom_values: newVals };
          }
          return t;
        });
        localStorage.setItem(txKey, JSON.stringify(updatedTxs));
      }
      return;
    }

    const { error: deleteError } = await supabase.from("custom_columns").delete().eq("id", id).eq("project_id", project_id);
    if (deleteError) throw deleteError;

    await supabase.rpc("remove_custom_column_key", {
      _project_id: project_id,
      _column_name: name,
    });
  },

  updateColumn: async ({ id, updates, project_id }: any) => {
    if (getIsStandalone()) {
      const key = `local_custom_columns_${project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const updated = existing.map((c: any) => c.id === id ? { ...c, ...updates } : c);
      localStorage.setItem(key, JSON.stringify(updated));
      return;
    }

    const { error } = await supabase.from("custom_columns").update(updates).eq("id", id).eq("project_id", project_id);
    if (error) throw error;
  },

  renameColumn: async ({ id, oldName, newName, project_id }: any) => {
    if (getIsStandalone()) {
      const key = `local_custom_columns_${project_id}`;
      const local = localStorage.getItem(key);
      const existing = local ? JSON.parse(local) : [];
      const updated = existing.map((c: any) => c.id === id ? { ...c, name: newName } : c);
      localStorage.setItem(key, JSON.stringify(updated));

      // Update transactions
      const txKey = `local_transactions_${project_id}`;
      const localTxs = localStorage.getItem(txKey);
      if (localTxs) {
        const txs = JSON.parse(localTxs);
        const updatedTxs = txs.map((t: any) => {
          if (t.custom_values && t.custom_values[oldName] !== undefined) {
            const newVals = { ...t.custom_values };
            newVals[newName] = newVals[oldName];
            delete newVals[oldName];
            return { ...t, custom_values: newVals };
          }
          return t;
        });
        localStorage.setItem(txKey, JSON.stringify(updatedTxs));
      }
      return;
    }

    const { error: updateError } = await supabase.from("custom_columns").update({ name: newName }).eq("id", id).eq("project_id", project_id);
    if (updateError) throw updateError;

    await supabase.rpc("rename_custom_column_key", {
      _project_id: project_id,
      _old_name: oldName,
      _new_name: newName,
    });
  }
};
