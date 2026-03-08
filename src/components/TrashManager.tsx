import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2, TrendingUp, TrendingDown } from "lucide-react";
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

  if (loading) {
    return <p className="text-xs text-muted-foreground text-center py-4">{t("admin.dbLoading")}</p>;
  }

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">{t("admin.trashEmpty")}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((tx) => (
        <div key={tx.id} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
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
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => handleRestore(tx.id)}
              title={t("admin.restore")}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => handlePermDelete(tx.id)}
              title={t("admin.permDelete")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TrashManager;
