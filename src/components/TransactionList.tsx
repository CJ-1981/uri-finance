import { useState, useMemo, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { Category } from "@/hooks/useCategories";
import { TrendingUp, TrendingDown, CheckSquare, Square, Trash2, Edit3, X, CheckCheck, Search, ChevronLeft, ChevronRight, AlertTriangle, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ColumnHeaders } from "@/hooks/useColumnHeaders";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { useI18n } from "@/hooks/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NumberedSelect from "@/components/NumberedSelect";
import ColoredBadge from "@/components/ColoredBadge";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  transactions: Transaction[];
  categories?: Category[];
  onSelect: (tx: Transaction) => void;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkEditOpen: (txs: Transaction[]) => void;
  onTransactionDeleted?: () => void; // Callback to refresh transaction list
  headers: ColumnHeaders;
  customColumns: CustomColumn[];
  isViewer?: boolean;
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetchingNextPage?: boolean;
}

const PAGE_SIZES = [10, 25, 50, 100] as const;

// List of valid ISO 4217 currency codes (ROL was replaced by RON in 2005)
const VALID_CURRENCIES = new Set(["USD", "EUR", "GBP", "JPY", "KRW", "CNY", "CAD", "AUD", "CHF", "INR", "BRL", "MXN", "CZK", "RON", "SGD", "PLN"]);

// Helper to safely format currency with validation
function formatCurrencySafe(amount: number, currencyCode: string | undefined): string {
  const currency = currencyCode || "EUR";
  // Validate currency code to avoid RangeError with toLocaleString
  const validCurrency = VALID_CURRENCIES.has(currency) ? currency : "EUR";
  return amount.toLocaleString("en-US", { style: "currency", currency: validCurrency });
}

export interface TransactionListHandle {
  focusSearch: () => void;
}

const TransactionList = forwardRef<TransactionListHandle, Props>(({ 
  transactions, 
  categories, 
  onSelect, 
  onBulkDelete, 
  onBulkEditOpen, 
  onTransactionDeleted, 
  headers, 
  customColumns, 
  isViewer,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage
}, ref) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const searchRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focusSearch: () => searchRef.current?.focus() }));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<Transaction | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem("tx_page_size");
    return saved ? Number(saved) : 25;
  });

  // Long press state for mobile
  const [longPressTx, setLongPressTx] = useState<Transaction | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const LONG_PRESS_DURATION = 500; // ms
  const lastPopupCloseTimeRef = useRef(0);
  const TOUCH_BLOCK_DURATION = 500; // ms - increased to be safer

  // Clear long press timer
  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Check if touch is blocked (popup recently closed)
  const isTouchBlocked = () => {
    return Date.now() - lastPopupCloseTimeRef.current < TOUCH_BLOCK_DURATION;
  };

  // Handle long press on transaction item
  const handleTouchStart = (tx: Transaction, e: React.TouchEvent) => {
    if (!isMobile || isViewer || !ownTxIds.has(tx.id) || isTouchBlocked()) return;

    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX;
    const y = rect.top; // Position at top of the item

    longPressTimerRef.current = setTimeout(() => {
      setLongPressTx(tx);
      setPopupPosition({ x, y });
      // Provide haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50); // Short vibration
      }
    }, LONG_PRESS_DURATION);
  };

  // Handle touch move (cancel long press if finger moves)
  const handleTouchMove = () => {
    clearLongPress();
  };

  // Handle touch end (clear timer, don't close popup if it's already open)
  const handleTouchEnd = () => {
    clearLongPress();
  };

  // Close popup
  const closePopup = () => {
    setLongPressTx(null);
    setPopupPosition(null);
    // Record close time to block subsequent touches
    lastPopupCloseTimeRef.current = Date.now();
  };

  // Delete single transaction
  const handleDeleteTransaction = async (tx: Transaction) => {
    // Show confirmation dialog
    setDeleteConfirmTx(tx);
    setLongPressTx(null);
  };

  // Execute delete after confirmation
  const executeDelete = async () => {
    if (!deleteConfirmTx) return;

    setDeleting(true);
    try {
      // Soft delete transaction
      const { error } = await supabase
        .from("transactions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deleteConfirmTx.id);

      if (error) {
        toast.error(t("tx.deleteFailed") || "Failed to delete transaction");
        return;
      }

      // Unlink all files associated with this transaction
      const { error: unlinkError } = await supabase
        .from("project_files")
        .update({ transaction_id: null })
        .eq("transaction_id", deleteConfirmTx.id);

      if (unlinkError) {
        console.error("Failed to unlink files from transaction:", unlinkError);
      }

      toast.success(t("tx.deleted") || "Transaction deleted");

      setSelected(prev => {
        const newSet = new Set(prev);
        newSet.delete(deleteConfirmTx.id);
        return newSet;
      });

      // Call callback to refresh transaction list
      onTransactionDeleted?.();
    } finally {
      setDeleting(false);
      setDeleteConfirmTx(null);
    }
  };

  const categoryIconMap = useMemo(() => {
    const map = new Map<string, string>();
    categories?.forEach(cat => {
      if (cat.icon) map.set(cat.name, cat.icon);
    });
    return map;
  }, [categories]);

  const categoryCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    categories?.forEach(cat => {
      if (cat.code) map.set(cat.name, cat.code);
    });
    return map;
  }, [categories]);

  const maskedColumnNames = useMemo(() => {
    if (!isViewer) return new Set<string>();
    return new Set(customColumns.filter(col => col.masked).map(col => col.name));
  }, [customColumns, isViewer]);

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter((tx) => {
      if (tx.description?.toLowerCase().includes(q)) return true;
      if (tx.category.toLowerCase().includes(q)) return true;
      if (tx.type.toLowerCase().includes(q)) return true;
      if (tx.currency?.toLowerCase().includes(q)) return true;
      if (tx.transaction_date.includes(q)) return true;
      if (String(tx.amount).includes(q)) return true;
      const categoryCode = categoryCodeMap.get(tx.category);
      if (categoryCode?.toLowerCase().includes(q)) return true;
      if (tx.custom_values) {
        for (const [key, val] of Object.entries(tx.custom_values)) {
          if (maskedColumnNames.has(key)) continue;
          if (String(val).toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [transactions, searchQuery, maskedColumnNames, categoryCodeMap]);

  // Reset page when search or data changes
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  if (safePage !== page) setPage(safePage);

  const paginatedTransactions = useMemo(() => {
    const start = safePage * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, safePage, pageSize]);

  // Handle page navigation with infinite loading integration
  const handleNextPage = useCallback(() => {
    if (safePage < totalPages - 1) {
      setPage(safePage + 1);
    } else if (hasNextPage && fetchNextPage) {
      fetchNextPage();
    }
  }, [safePage, totalPages, hasNextPage, fetchNextPage]);

  // Sum of selected transactions grouped by currency
  const selectedSummary = useMemo(() => {
    if (!selectMode || selected.size === 0) return null;
    const sums = new Map<string, { income: number; expense: number }>();
    for (const tx of filteredTransactions) {
      if (!selected.has(tx.id)) continue;
      const cur = tx.currency || "EUR";
      const entry = sums.get(cur) || { income: 0, expense: 0 };
      if (tx.type === "income") entry.income += Number(tx.amount);
      else entry.expense += Number(tx.amount);
      sums.set(cur, entry);
    }
    return sums;
  }, [selectMode, selected, filteredTransactions]);

  const ownTxIds = new Set(transactions.filter((tx) => tx.user_id === user?.id).map((tx) => tx.id));

  const toggleSelect = (id: string) => {
    if (!ownTxIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const selectableIds = paginatedTransactions.filter((tx) => ownTxIds.has(tx.id)).map((tx) => tx.id);
    if (selected.size === selectableIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    await onBulkDelete(Array.from(selected));
    setDeleting(false);
    exitSelectMode();
  };

  const handleBulkEdit = () => {
    const selectedTxs = filteredTransactions.filter((tx) => selected.has(tx.id));
    onBulkEditOpen(selectedTxs);
  };

  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        {t("tx.noTransactions")}
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full animate-fade-in" data-testid="transaction-list">
      {/* Search */}
      <div className="relative px-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setSearchQuery(""); searchRef.current?.blur(); } }}
          placeholder={t("tx.search") || "Search transactions..."}
          className="pl-8 pr-10 h-8 text-sm bg-muted/30 border-border/50"
        />
        {searchQuery ? (
          <button
            onClick={() => { setSearchQuery(""); setPage(0); searchRef.current?.focus(); }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
            title={t("common.clear") || "Clear"}
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center rounded border border-border/50 bg-muted/50 px-1.5 text-[10px] font-mono text-muted-foreground">/</kbd>
        )}
      </div>

      {/* Selection toolbar */}
      <div className="flex items-center justify-between px-1">
        {!isViewer && selectMode ? (
          <div className="flex items-center gap-2 w-full animate-fade-in">
            <Button variant="ghost" size="sm" onClick={exitSelectMode} className="text-muted-foreground h-8 px-2">
              <X className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleAll} className="text-muted-foreground h-8 px-2">
              <CheckCheck className="h-4 w-4 mr-1" />
              {t("tx.selectAll")}
            </Button>
            <span className="text-xs text-muted-foreground flex-1">
              {t("tx.selected").replace("{n}", String(selected.size))}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkEdit}
              disabled={selected.size === 0}
              className="text-foreground h-8 px-2"
            >
              <Edit3 className="h-4 w-4 mr-1" />
              {t("tx.bulkEdit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selected.size === 0 || deleting}
              className="text-destructive hover:text-destructive h-8 px-2"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t("tx.bulkDelete")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-full">
            <div className="w-10 shrink-0 flex items-center justify-center">
              {!isViewer && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectMode(true)}
                  className="text-muted-foreground h-7 w-8 px-0 text-[10px]"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="flex-1 min-w-[100px] truncate">{headers.description}</div>
            <span className="hidden sm:block w-24 text-right shrink-0">{headers.category}</span>
            {customColumns.filter(col => !(isViewer && col.masked)).map((col) => (
              <span key={col.id} className="hidden sm:block w-24 text-right shrink-0">{col.name}</span>
            ))}
            <span className="w-28 text-right shrink-0">{headers.amount}</span>
          </div>
        )}
      </div>

      {paginatedTransactions.map((tx, i) => (
        <div
          key={tx.id}
          onClick={() => {
            if (isTouchBlocked()) return;
            selectMode ? toggleSelect(tx.id) : onSelect(tx);
          }}
          onContextMenu={(e) => {
            if (!isViewer && !selectMode && ownTxIds.has(tx.id)) {
              e.preventDefault();
              setSelectMode(true);
              setSelected(new Set([tx.id]));
            }
          }}
          onTouchStart={(e) => handleTouchStart(tx, e)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer active:scale-[0.98] transition-all ${
            selected.has(tx.id)
              ? "bg-primary/10 ring-1 ring-primary/30"
              : "bg-muted/30 hover:bg-muted/50"
          }`}
        >
          {selectMode ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
              {!ownTxIds.has(tx.id) ? (
                <div className="h-5 w-5 rounded border border-muted-foreground/20" />
              ) : selected.has(tx.id) ? (
                <CheckSquare className="h-5 w-5 text-primary" />
              ) : (
                <Square className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          ) : (
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                categoryIconMap.has(tx.category)
                  ? "bg-muted/50"
                  : tx.type === "income" ? "income-badge" : "expense-badge"
              }`}
            >
              {categoryIconMap.has(tx.category) ? (
                <span className="text-lg">{categoryIconMap.get(tx.category)}</span>
              ) : tx.type === "income" ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
          )}
          <div className="flex-1 min-w-[100px] overflow-hidden">
            <p className="text-sm font-medium text-foreground truncate">
              {isMobile ? (tx.description || tx.category) : (tx.description || <span className="opacity-0">.</span>)}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {categoryCodeMap.get(tx.category)?.trim() ? (
                <span className="font-mono text-[10px] text-muted-foreground/70 mr-1 whitespace-nowrap">{categoryCodeMap.get(tx.category)}</span>
              ) : null}
              {tx.category} · {format(parseISO(tx.transaction_date), "MMM d")}
            </p>
          </div>
          <span className="hidden sm:block w-24 text-right text-xs text-muted-foreground truncate shrink-0">
            {tx.category}
          </span>
          {customColumns.filter(col => !(isViewer && col.masked)).map((col) => {
            const val = tx.custom_values?.[col.name];
            const isListCol = col.column_type === "list";
            const colorKey = isListCol && val ? (col.suggestion_colors as Record<string, string>)?.[String(val)] : undefined;
            return (
              <span key={col.id} className="hidden sm:block w-24 text-right text-xs text-muted-foreground truncate shrink-0">
                {val != null
                  ? isListCol && colorKey
                    ? <ColoredBadge value={String(val)} colorKey={colorKey} />
                    : col.column_type === "numeric"
                      ? Number(val).toLocaleString("en-US", { minimumFractionDigits: 2 })
                      : String(val)
                  : "—"}
              </span>
            );
          })}
          <p
            className={`w-28 text-right text-sm font-semibold shrink-0 ${
              tx.type === "income" ? "text-income" : "text-expense"
            }`}
          >
            {tx.type === "income" ? "+" : "-"}{formatCurrencySafe(Number(tx.amount), tx.currency)}
          </p>
        </div>
      ))}

      {/* Pagination controls */}
      {filteredTransactions.length > 0 && (
        <div className="flex flex-col gap-4 px-2 pt-2 pb-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <NumberedSelect
                value={String(pageSize)}
                onValueChange={(v) => { const n = Number(v); setPageSize(n); localStorage.setItem("tx_page_size", v); setPage(0); }}
                items={PAGE_SIZES.map((s) => ({ value: String(s), label: String(s) }))}
                className="h-7 w-[72px] text-xs bg-muted/30 border-border/50 px-2"
                showNumbers
              />
              <span className="text-xs text-muted-foreground">/ {t("tx.page") || "page"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground tabular-nums mr-1">
                {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filteredTransactions.length)} / {filteredTransactions.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={safePage >= totalPages - 1 && !hasNextPage}
                onClick={handleNextPage}
              >
                {isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Floating sum popup for multi-select */}
      {selectedSummary && selectedSummary.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[45] bg-card border border-border shadow-lg rounded-2xl px-5 py-3 animate-fade-in max-w-[calc(100vw-2rem)]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground font-medium">{selected.size} selected</span>
            <div className="h-4 w-px bg-border" />
            {Array.from(selectedSummary.entries()).map(([cur, { income, expense }]) => {
              const net = income - expense;
              return (
                <div key={cur} className="flex items-center gap-3 tabular-nums">
                  {income > 0 && (
                    <span className="text-income font-semibold">
                      +{formatCurrencySafe(income, cur)}
                    </span>
                  )}
                  {expense > 0 && (
                    <span className="text-expense font-semibold">
                      -{formatCurrencySafe(expense, cur)}
                    </span>
                  )}
                  <span className={`font-bold ${net >= 0 ? "text-income" : "text-expense"}`}>
                    = {formatCurrencySafe(net, cur)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmTx} onOpenChange={(open) => !open && setDeleteConfirmTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tx.deleteTitle") || "Delete transaction?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmTx && (
                <span className="font-medium">
                  {deleteConfirmTx.description || deleteConfirmTx.category} · {Number(deleteConfirmTx.amount).toLocaleString()} {deleteConfirmTx.currency}
                </span>
              )}
              <br />
              <span className="text-destructive">{t("tx.deleteDesc") || "This action cannot be undone."}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("tx.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
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
                  {t("tx.delete") || "Delete"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Long press delete popup */}
      {longPressTx && popupPosition && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[50] bg-black/20"
            onClick={(e) => {
              e.stopPropagation();
              closePopup();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              closePopup();
            }}
            style={{ touchAction: 'none', cursor: 'pointer' }}
          />
          {/* Popup button */}
          <div
            className="fixed z-[51] animate-fade-in"
            style={{
              left: `${Math.min(Math.max(popupPosition.x - 60, 10), window.innerWidth - 130)}px`,
              top: `${popupPosition.y}px`,
            }}
          >
            <button
              onClick={() => longPressTx && handleDeleteTransaction(longPressTx)}
              disabled={deleting}
              className="flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2.5 rounded-full shadow-lg hover:bg-destructive/90 active:scale-95 transition-all font-medium text-sm"
            >
              {deleting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t("common.deleting") || "Deleting..."}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  {t("tx.delete") || "Delete"}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
});

export default TransactionList;
