import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { Category } from "@/hooks/useCategories";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  categories: Category[];
  customColumns: CustomColumn[];
  onAdd: (tx: {
    type: "income" | "expense";
    amount: number;
    category: string;
    description?: string;
    transaction_date?: string;
    custom_values?: Record<string, number | string>;
  }) => Promise<void>;
}

const AddTransactionSheet = ({ categories, customColumns, onAdd }: Props) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const { t } = useI18n();

  const resetForm = () => {
    setAmount("");
    setDescription("");
    setCustomValues({});
  };

  const doSubmit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSubmitting(true);

    const cv: Record<string, number | string> = {};
    for (const col of customColumns) {
      const val = customValues[col.name];
      if (!val) continue;
      if (col.column_type === "numeric") {
        if (!isNaN(Number(val))) cv[col.name] = Number(val);
      } else {
        cv[col.name] = val;
      }
    }

    await onAdd({
      type,
      amount: Number(amount),
      category,
      description: description || undefined,
      transaction_date: date,
      custom_values: Object.keys(cv).length > 0 ? cv : undefined,
    });
    setSubmitting(false);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await doSubmit();
    if (ok) {
      resetForm();
      setOpen(false);
    }
  };

  const handleAddAndContinue = async () => {
    const ok = await doSubmit();
    if (ok) {
      resetForm();
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon" className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full gradient-primary shadow-lg shadow-primary/30">
          <Plus className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-border/50 px-6 pb-8 max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">{t("tx.addTransaction")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("income")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-all ${
                type === "income"
                  ? "income-badge ring-1 ring-income/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <TrendingUp className="h-4 w-4" /> {t("tx.income")}
            </button>
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-all ${
                type === "expense"
                  ? "expense-badge ring-1 ring-expense/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <TrendingDown className="h-4 w-4" /> {t("tx.expense")}
            </button>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">{t("tx.amount")}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="bg-muted/50 border-border/50 text-2xl font-bold h-14"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">{t("tx.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-muted/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">{t("tx.date")}</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-muted/50 border-border/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">{t("tx.descriptionOptional")}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("tx.descriptionPlaceholder")}
              className="bg-muted/50 border-border/50"
            />
          </div>

          {customColumns.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {customColumns.map((col) => (
                <div key={col.id} className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{col.name}</Label>
                  <Input
                    type={col.column_type === "numeric" ? "number" : "text"}
                    step={col.column_type === "numeric" ? "0.01" : undefined}
                    value={customValues[col.name] || ""}
                    onChange={(e) => setCustomValues((prev) => ({ ...prev, [col.name]: e.target.value }))}
                    placeholder={col.column_type === "numeric" ? "0.00" : ""}
                    className="bg-muted/50 border-border/50"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              disabled={submitting}
              onClick={handleAddAndContinue}
              variant="outline"
              className="flex-1 font-semibold h-12"
            >
              {submitting ? t("tx.adding") : t("tx.addAndContinue")}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity h-12"
            >
              {submitting ? t("tx.adding") : t("tx.addTransaction")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default AddTransactionSheet;
