import { useState, useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { Category } from "@/hooks/useCategories";
import { TrendingUp, TrendingDown, CheckSquare, Square, Trash2, Edit3, X, CheckCheck, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ColumnHeaders } from "@/hooks/useColumnHeaders";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { useI18n } from "@/hooks/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  transactions: Transaction[];
  categories?: Category[];
  onSelect: (tx: Transaction) => void;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkEditOpen: (txs: Transaction[]) => void;
  headers: ColumnHeaders;
  customColumns: CustomColumn[];
  isViewer?: boolean;
}

const PAGE_SIZES = [10, 25, 50, 100] as const;

export interface TransactionListHandle {
  focusSearch: () => void;
}

const TransactionList = forwardRef<TransactionListHandle, Props>(({ transactions, categories, onSelect, onBulkDelete, onBulkEditOpen, headers, customColumns, isViewer }, ref) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focusSearch: () => searchRef.current?.focus() }));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem("tx_page_size");
    return saved ? Number(saved) : 25;
  });

  const categoryIconMap = useMemo(() => {
    const map = new Map<string, string>();
    categories?.forEach(cat => {
      if (cat.icon) map.set(cat.name, cat.icon);
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
      if (tx.custom_values) {
        for (const [key, val] of Object.entries(tx.custom_values)) {
          if (maskedColumnNames.has(key)) continue;
          if (String(val).toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [transactions, searchQuery, maskedColumnNames]);

  // Reset page when search or data changes
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  if (safePage !== page) setPage(safePage);

  const paginatedTransactions = useMemo(() => {
    const start = safePage * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, safePage, pageSize]);

  // Sum of selected transactions grouped by currency
  const selectedSummary = useMemo(() => {
    if (!selectMode || selected.size === 0) return null;
    const sums = new Map<string, { income: number; expense: number }>();
    for (const tx of filteredTransactions) {
      if (!selected.has(tx.id)) continue;
      const cur = tx.currency || "USD";
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
    <div className="space-y-2 max-w-3xl mx-auto">
      {/* Search */}
      <div className="relative px-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); searchRef.current?.blur(); } }}
          placeholder={t("tx.search") || "Search transactions..."}
          className="pl-8 pr-10 h-8 text-sm bg-muted/30 border-border/50"
        />
        <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center rounded border border-border/50 bg-muted/50 px-1.5 text-[10px] font-mono text-muted-foreground">/</kbd>
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
            {!isViewer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectMode(true)}
                className="text-muted-foreground h-7 w-8 px-0 text-[10px] shrink-0"
              >
                <CheckSquare className="h-3.5 w-3.5" />
              </Button>
            )}
            <div className="w-10 shrink-0 hidden sm:block" />
            <span className="flex-1 min-w-0 truncate">{headers.description}</span>
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
          onClick={() => selectMode ? toggleSelect(tx.id) : onSelect(tx)}
          onContextMenu={(e) => {
            if (!isViewer && !selectMode && ownTxIds.has(tx.id)) {
              e.preventDefault();
              setSelectMode(true);
              setSelected(new Set([tx.id]));
            }
          }}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 animate-fade-in cursor-pointer active:scale-[0.98] transition-all ${
            selected.has(tx.id)
              ? "bg-primary/10 ring-1 ring-primary/30"
              : "bg-muted/30"
          }`}
          style={{ animationDelay: `${i * 50}ms` }}
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
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {tx.description || tx.category}
            </p>
            <p className="text-xs text-muted-foreground">
              {tx.category} · {format(parseISO(tx.transaction_date), "MMM d")}
            </p>
          </div>
          <span className="hidden sm:block w-24 text-right text-xs text-muted-foreground truncate shrink-0">
            {tx.category}
          </span>
          {customColumns.filter(col => !(isViewer && col.masked)).map((col) => {
            const val = tx.custom_values?.[col.name];
            return (
              <span key={col.id} className="hidden sm:block w-24 text-right text-xs text-muted-foreground truncate shrink-0">
                {val != null
                  ? col.column_type === "numeric"
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
            {tx.type === "income" ? "+" : "-"}{Number(tx.amount).toLocaleString("en-US", { style: "currency", currency: tx.currency || "USD" })}
          </p>
        </div>
      ))}

      {/* Pagination controls */}
      {filteredTransactions.length > 0 && (
        <div className="flex items-center justify-between px-2 pt-2 pb-1">
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(v) => { const n = Number(v); setPageSize(n); localStorage.setItem("tx_page_size", v); setPage(0); }}>
              <SelectTrigger className="h-7 w-[70px] text-xs bg-muted/30 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {/* Floating sum popup for multi-select */}
      {selectedSummary && selectedSummary.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-lg rounded-2xl px-5 py-3 animate-fade-in">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground font-medium">{selected.size} selected</span>
            <div className="h-4 w-px bg-border" />
            {Array.from(selectedSummary.entries()).map(([cur, { income, expense }]) => {
              const net = income - expense;
              return (
                <div key={cur} className="flex items-center gap-3 tabular-nums">
                  {income > 0 && (
                    <span className="text-income font-semibold">
                      +{income.toLocaleString("en-US", { style: "currency", currency: cur })}
                    </span>
                  )}
                  {expense > 0 && (
                    <span className="text-expense font-semibold">
                      -{expense.toLocaleString("en-US", { style: "currency", currency: cur })}
                    </span>
                  )}
                  <span className={`font-bold ${net >= 0 ? "text-income" : "text-expense"}`}>
                    = {net.toLocaleString("en-US", { style: "currency", currency: cur })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default TransactionList;
