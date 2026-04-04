import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RotateCcw, Trash2, TrendingUp, TrendingDown, CheckSquare, Square, X, CheckCheck } from "lucide-react";
import { toast } from "sonner";

interface DeletedTransaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  transaction_date: string;
  deleted_at: string;
}

interface Props {
  projectId: string;
  currency: string;
}

const TrashManager = ({ projectId, currency }: Props) => {
  const { t, language } = useI18n();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<DeletedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [permDeleteConfirmId, setPermDeleteConfirmId] = useState<string | null>(null);
  const [bulkRestoreConfirm, setBulkRestoreConfirm] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [isRestoringItem, setIsRestoringItem] = useState(false);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const MAX_DELETED_DISPLAY = 500; // Max deleted items to display in trash
  const MAX_BULK_OPERATION = 1000; // Max items for bulk restore/delete (Supabase limit)

  const fetchDeleted = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("id, type, amount, category, description, transaction_date, deleted_at")
      .eq("project_id", projectId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(MAX_DELETED_DISPLAY);
    setItems((data as DeletedTransaction[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDeleted();
  }, [projectId]);

  const handleRestore = async (id: string) => {
    setRestoreConfirmId(id);
  };

  const executeRestore = async () => {
    if (!restoreConfirmId) return;
    setIsRestoringItem(true);
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: null })
      .eq("id", restoreConfirmId);
    if (error) {
      toast.error(t("admin.restoreFailed"));
      setIsRestoringItem(false);
      return;
    }
    // Refresh the list from server to get updated data
    await fetchDeleted();
    // Refetch transactions query to update main list immediately
    await queryClient.refetchQueries({ queryKey: ["infinite_transactions", projectId] });
    toast.success(t("admin.restored"));
    setIsRestoringItem(false);
    setRestoreConfirmId(null);
  };

  const handlePermDelete = async (id: string) => {
    setPermDeleteConfirmId(id);
  };

  const executePermDelete = async () => {
    if (!permDeleteConfirmId) return;
    setIsDeletingItem(true);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", permDeleteConfirmId);
    if (error) {
      toast.error(t("admin.permDeleteFailed"));
      setIsDeletingItem(false);
      return;
    }
    // Refresh the list from server to get updated data
    await fetchDeleted();
    toast.success(t("admin.permDeleted"));
    setIsDeletingItem(false);
    setPermDeleteConfirmId(null);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleBulkRestore = async () => {
    if (selected.size > MAX_BULK_OPERATION) {
      toast.error(t("admin.bulkLimitError", { max: MAX_BULK_OPERATION }), {
        description: t("admin.itemsSelected", { count: selected.size }) + ` (max: ${MAX_BULK_OPERATION})`
      });
      return;
    }
    setBulkRestoreConfirm(true);
  };

  const executeBulkRestore = async () => {
    setRestoring(true);
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: null })
      .in("id", ids);
    if (error) {
      toast.error(t("admin.restoreFailed"));
    } else {
      // Refresh the list from server to get updated data
      await fetchDeleted();
      // Refetch transactions query to update main list immediately
      await queryClient.refetchQueries({ queryKey: ["infinite_transactions", projectId] });
      toast.success(t("admin.restored"));
      exitSelectMode();
    }
    setRestoring(false);
    setBulkRestoreConfirm(false);
  };

  const handleBulkDelete = async () => {
    if (selected.size > MAX_BULK_OPERATION) {
      toast.error(t("admin.bulkLimitError", { max: MAX_BULK_OPERATION }), {
        description: t("admin.itemsSelected", { count: selected.size }) + ` (max: ${MAX_BULK_OPERATION})`
      });
      return;
    }
    setBulkDeleteConfirm(true);
  };

  const executeBulkDelete = async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .in("id", ids);
    if (error) {
      toast.error(t("admin.permDeleteFailed"));
    } else {
      // Refresh the list from server to get updated data
      await fetchDeleted();
      toast.success(t("admin.permDeleted"));
      exitSelectMode();
    }
    setDeleting(false);
    setBulkDeleteConfirm(false);
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground text-center py-4">{t("admin.dbLoading")}</p>;
  }

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">{t("admin.trashEmpty")}</p>;
  }

  return (
    <div className="space-y-2">
      {/* Selection toolbar */}
      <div className="flex items-center justify-between px-1">
        {selectMode ? (
          <div className="flex items-center gap-2 w-full animate-fade-in">
            <Button variant="ghost" size="sm" onClick={exitSelectMode} className="text-muted-foreground h-8 px-2" aria-label={t("admin.exitSelectMode")}>
              <X className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleAll} className="text-muted-foreground h-8 px-2">
              <CheckCheck className="h-4 w-4 mr-1" />
              {t("admin.selectAll")}
            </Button>
            <span className="text-xs text-muted-foreground flex-1">
              {t("admin.selected").replace("{n}", String(selected.size))}
              {selected.size > 100 && (
                <span className={`ml-2 ${selected.size > MAX_BULK_OPERATION ? 'text-destructive font-semibold' : 'text-amber-500'}`}>
                  ({selected.size}/{MAX_BULK_OPERATION})
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkRestore}
              disabled={selected.size === 0 || restoring || selected.size > MAX_BULK_OPERATION}
              className="text-primary h-8 px-2"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {t("admin.bulkRestore")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selected.size === 0 || deleting || selected.size > MAX_BULK_OPERATION}
              className="text-destructive hover:text-destructive h-8 px-2"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t("admin.bulkDelete")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2 py-1 w-full">
            <div className="w-10 shrink-0 flex items-center justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectMode(true)}
                className="text-muted-foreground h-7 w-8 px-0 text-[10px]"
              >
                <CheckSquare className="h-3.5 w-3.5" />
              </Button>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("admin.trash")} ({items.length})
            </span>
          </div>
        )}
      </div>

      {/* Items with scroll */}
      <div className="max-h-[400px] overflow-y-auto space-y-2">
        {items.map((tx) => (
          <div
            key={tx.id}
            role="checkbox"
            aria-checked={selected.has(tx.id)}
            tabIndex={selectMode ? 0 : -1}
            onClick={() => selectMode ? toggleSelect(tx.id) : undefined}
            onKeyDown={(e) => {
              if (selectMode && (e.key === ' ' || e.key === 'Enter')) {
                e.preventDefault();
                toggleSelect(tx.id);
              }
            }}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 animate-fade-in cursor-pointer ${
              selected.has(tx.id)
                ? "bg-primary/10 ring-1 ring-primary/30"
                : "bg-muted/30"
            }${selectMode ? ' focus:ring-2 focus:ring-primary focus:outline-none' : ''}`}
          >
            {selectMode ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                {selected.has(tx.id) ? (
                  <CheckSquare className="h-5 w-5 text-primary" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            ) : (
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  tx.type === "income" ? "income-badge" : "expense-badge"
                }`}
              >
                {tx.type === "income" ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate">
                {tx.description || tx.category}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {tx.category} · {new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }).format(new Date(tx.transaction_date))}
                {" · "}{t("admin.deletedOn")} {new Intl.DateTimeFormat(language, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(tx.deleted_at))}
              </p>
            </div>
            <p className={`text-sm font-semibold shrink-0 ${tx.type === "income" ? "text-income" : "text-expense"}`}>
              {tx.type === "income" ? "+" : "-"}
              {new Intl.NumberFormat(language, { style: "currency", currency: currency, minimumFractionDigits: 2 }).format(tx.amount)}
            </p>
            {!selectMode && (
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={(e) => { e.stopPropagation(); handleRestore(tx.id); }}
                  title={t("admin.restore")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handlePermDelete(tx.id); }}
                  title={t("admin.permDelete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirmation dialogs */}
      {/* Restore confirmation */}
      <AlertDialog open={!!restoreConfirmId} onOpenChange={(open) => !open && !isRestoringItem && setRestoreConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.restoreConfirmTitle") || "Restore transaction?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRestoringItem ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>{t("admin.restoring") || "Restoring..."}</span>
                </div>
              ) : (
                <span className="text-primary">{t("admin.restoreConfirmDesc") || "This will restore the transaction to your main list."}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoringItem}>
              {t("tx.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeRestore}
              disabled={isRestoringItem}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isRestoringItem ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  {t("admin.restoring") || "Restoring..."}
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t("admin.restore") || "Restore"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent delete confirmation */}
      <AlertDialog open={!!permDeleteConfirmId} onOpenChange={(open) => !open && !isDeletingItem && setPermDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.permDeleteConfirmTitle") || "Permanently delete?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isDeletingItem ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                  <span>{t("common.deleting") || "Deleting..."}</span>
                </div>
              ) : (
                <span className="text-destructive">{t("admin.permDeleteConfirmDesc") || "This action cannot be undone. The transaction will be permanently removed."}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingItem}>
              {t("tx.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executePermDelete}
              disabled={isDeletingItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingItem ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  {t("common.deleting") || "Deleting..."}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("admin.permDelete") || "Delete"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk restore confirmation */}
      <AlertDialog open={bulkRestoreConfirm} onOpenChange={(open) => !open && !restoring && setBulkRestoreConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.bulkRestoreConfirmTitle") || "Restore selected transactions?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {restoring ? (
                <span className="flex items-center gap-2 py-2 inline-flex">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent block" />
                  <span>{t("admin.restoring") || "Restoring..."}</span>
                </span>
              ) : (
                <>
                  <span className="font-medium">
                    {selected.size} {selected.size === 1 ? t("admin.transaction") : t("admin.transactions")} {t("common.selected")}
                  </span>
                  {selected.size > 100 && (
                    <span className={`text-xs block mt-1 ${selected.size > MAX_BULK_OPERATION ? 'text-destructive' : 'text-amber-500'}`}>
                      {selected.size > MAX_BULK_OPERATION
                        ? `⚠️ ${t("admin.maxItemsAllowed", { max: MAX_BULK_OPERATION })}`
                        : t("admin.maxItemsNote", { max: MAX_BULK_OPERATION })
                      }
                    </span>
                  )}
                  <br />
                  <span className="text-primary">{t("admin.restoreConfirmDesc") || "This will restore the transactions to your main list."}</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>
              {t("tx.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkRestore}
              disabled={restoring}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {restoring ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  {t("admin.restoring") || "Restoring..."}
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t("admin.bulkRestore") || "Restore"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={(open) => !open && !deleting && setBulkDeleteConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.bulkDeleteConfirmTitle") || "Permanently delete selected?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <span className="flex items-center gap-2 py-2 inline-flex">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent block" />
                  <span>{t("common.deleting") || "Deleting..."}</span>
                </span>
              ) : (
                <>
                  <span className="font-medium">
                    {selected.size} {selected.size === 1 ? t("admin.transaction") : t("admin.transactions")} {t("common.selected")}
                  </span>
                  {selected.size > 100 && (
                    <span className={`text-xs block mt-1 ${selected.size > MAX_BULK_OPERATION ? 'text-destructive' : 'text-amber-500'}`}>
                      {selected.size > MAX_BULK_OPERATION
                        ? `⚠️ ${t("admin.maxItemsAllowed", { max: MAX_BULK_OPERATION })}`
                        : t("admin.maxItemsNote", { max: MAX_BULK_OPERATION })
                      }
                    </span>
                  )}
                  <br />
                  <span className="text-destructive">{t("admin.permDeleteConfirmDesc") || "This action cannot be undone. The transaction will be permanently removed."}</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("tx.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  {t("common.deleting") || "Deleting..."}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("admin.bulkDelete") || "Delete"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrashManager;
