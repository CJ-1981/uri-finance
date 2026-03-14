import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2, TrendingUp, TrendingDown, CheckSquare, Square, X, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

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
  const { t } = useI18n();
  const [items, setItems] = useState<DeletedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const fetchDeleted = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("id, type, amount, category, description, transaction_date, deleted_at")
      .eq("project_id", projectId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50);
    setItems((data as DeletedTransaction[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDeleted();
  }, [projectId]);

  const handleRestore = async (id: string) => {
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) {
      toast.error(t("admin.restoreFailed"));
      return;
    }
    toast.success(t("admin.restored"));
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handlePermDelete = async (id: string) => {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(t("admin.permDeleteFailed"));
      return;
    }
    toast.success(t("admin.permDeleted"));
    setItems((prev) => prev.filter((i) => i.id !== id));
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
    setRestoring(true);
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: null })
      .in("id", ids);
    if (error) {
      toast.error(t("admin.restoreFailed"));
    } else {
      toast.success(t("admin.restored"));
      setItems((prev) => prev.filter((i) => !selected.has(i.id)));
      exitSelectMode();
    }
    setRestoring(false);
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .in("id", ids);
    if (error) {
      toast.error(t("admin.permDeleteFailed"));
    } else {
      toast.success(t("admin.permDeleted"));
      setItems((prev) => prev.filter((i) => !selected.has(i.id)));
      exitSelectMode();
    }
    setDeleting(false);
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
            <Button variant="ghost" size="sm" onClick={exitSelectMode} className="text-muted-foreground h-8 px-2">
              <X className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleAll} className="text-muted-foreground h-8 px-2">
              <CheckCheck className="h-4 w-4 mr-1" />
              {t("admin.selectAll")}
            </Button>
            <span className="text-xs text-muted-foreground flex-1">
              {t("admin.selected").replace("{n}", String(selected.size))}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkRestore}
              disabled={selected.size === 0 || restoring}
              className="text-primary h-8 px-2"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {t("admin.bulkRestore")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selected.size === 0 || deleting}
              className="text-destructive hover:text-destructive h-8 px-2"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t("admin.bulkDelete")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2 py-1 w-full">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("admin.trash")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectMode(true)}
              className="text-muted-foreground h-7 w-8 px-0 text-[10px] shrink-0"
              title={t("admin.selectMode")}
            >
              <CheckSquare className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {items.map((tx) => (
        <div
          key={tx.id}
          onClick={() => selectMode ? toggleSelect(tx.id) : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 animate-fade-in cursor-pointer ${
            selected.has(tx.id)
              ? "bg-primary/10 ring-1 ring-primary/30"
              : "bg-muted/30"
          }`}
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
              {tx.category} · {format(parseISO(tx.transaction_date), "MMM d")}
              {" · "}{t("admin.deletedOn")} {format(parseISO(tx.deleted_at), "MMM d, HH:mm")}
            </p>
          </div>
          <p className={`text-sm font-semibold shrink-0 ${tx.type === "income" ? "text-income" : "text-expense"}`}>
            {tx.type === "income" ? "+" : "-"}
            {Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
  );
};

export default TrashManager;
