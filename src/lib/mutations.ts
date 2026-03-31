import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/**
 * Shared mutation functions for TanStack Query defaults and resume support.
 */

export const mutationFunctions = {
  addTransaction: async (tx: any) => {
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
      currency: tx.currency || "USD",
    });
    if (error) throw error;
    return tx.id;
  },

  updateTransaction: async ({ id, updates, project_id }: any) => {
    const { error } = await supabase
      .from("transactions")
      .update(updates)
      .eq("id", id)
      .eq("project_id", project_id);
    if (error) throw error;
  },

  deleteTransaction: async ({ id, project_id }: any) => {
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
    const { error } = await supabase.from("project_categories").update({ name: newName }).eq("id", id).eq("project_id", project_id);
    if (error) throw error;
    
    await supabase
      .from("transactions")
      .update({ category: newName })
      .eq("category", oldName)
      .eq("project_id", project_id);
  },

  updateCategoryCode: async ({ id, code, project_id }: any) => {
    const { error } = await supabase.from("project_categories").update({ code: code.trim() }).eq("id", id).eq("project_id", project_id);
    if (error) throw error;
  },

  updateCategoryIcon: async ({ id, icon, project_id }: any) => {
    const { error } = await supabase.from("project_categories").update({ icon }).eq("id", id).eq("project_id", project_id);
    if (error) throw error;
  },

  reorderCategory: async ({ id, sort_order, project_id }: any) => {
    const { error } = await supabase.from("project_categories").update({ sort_order }).eq("id", id).eq("project_id", project_id);
    if (error) throw error;
  },

  // Files
  uploadFile: async (params: any) => {
    // This one is complex because it involves storage. 
    // Usually we don't resume complex file uploads via TanStack Query's basic persister 
    // but we can provide the metadata insert part.
    // For now, we'll focus on data mutations.
  },

  // Custom Columns
  addColumn: async (vars: any) => {
    const { error } = await supabase.from("custom_columns").insert(vars);
    if (error) throw error;
  },

  deleteColumn: async ({ id, project_id, name }: any) => {
    const { error: deleteError } = await supabase.from("custom_columns").delete().eq("id", id).eq("project_id", project_id);
    if (deleteError) throw deleteError;

    await supabase.rpc("remove_custom_column_key", {
      _project_id: project_id,
      _column_name: name,
    });
  },

  updateColumn: async ({ id, updates, project_id }: any) => {
    const { error } = await supabase.from("custom_columns").update(updates).eq("id", id).eq("project_id", project_id);
    if (error) throw error;
  },

  renameColumn: async ({ id, oldName, newName, project_id }: any) => {
    const { error: updateError } = await supabase.from("custom_columns").update({ name: newName }).eq("id", id).eq("project_id", project_id);
    if (updateError) throw updateError;

    await supabase.rpc("rename_custom_column_key", {
      _project_id: project_id,
      _old_name: oldName,
      _new_name: newName,
    });
  }
};
