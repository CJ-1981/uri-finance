import { useState, useMemo } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { TrendingUp, TrendingDown, CheckSquare, Square, Trash2, Edit3, X, CheckCheck, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ColumnHeaders } from "@/hooks/useColumnHeaders";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { useI18n } from "@/hooks/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  transactions: Transaction[];
  onSelect: (tx: Transaction) => void;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkEditOpen: (txs: Transaction[]) => void;
  headers: ColumnHeaders;
  customColumns: CustomColumn[];
  isViewer?: boolean;
}

const TransactionList = ({ transactions, onSelect, onBulkDelete, onBulkEditOpen, headers, customColumns, isViewer }: Props) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Filter transactions by search query matching any text field
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
      // Search custom values
      if (tx.custom_values) {
        for (const val of Object.values(tx.custom_values)) {
          if (String(val).toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [transactions, searchQuery]);

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
    const selectableIds = filteredTransactions.slice(0, 20).filter((tx) => ownTxIds.has(tx.id)).map((tx) => tx.id);
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
            {/* Icon spacer */}
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

      {transactions.slice(0, 20).map((tx, i) => (
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
                tx.type === "income" ? "income-badge" : "expense-badge"
              }`}
            >
              {tx.type === "income" ? (
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
    </div>
  );
};

export default TransactionList;
