import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { Category } from "@/hooks/useCategories";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { Transaction } from "@/hooks/useTransactions";
import { useI18n } from "@/hooks/useI18n";
import AutoSuggestInput from "@/components/AutoSuggestInput";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "KRW", "CNY", "CAD", "AUD", "CHF", "INR", "BRL", "MXN"];

interface Props {
  categories: Category[];
  customColumns: CustomColumn[];
  transactions: Transaction[];
  projectCurrency?: string;
  onAdd: (tx: {
    type: "income" | "expense";
    amount: number;
    category: string;
    description?: string;
    transaction_date?: string;
    custom_values?: Record<string, number | string>;
    currency?: string;
  }) => Promise<void>;
}

const AddTransactionSheet = ({ categories, customColumns, transactions, projectCurrency, onAdd }: Props) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [currency, setCurrency] = useState(projectCurrency || "USD");
  const [submitting, setSubmitting] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const { t } = useI18n();

  // Build suggestion lists per text column: imported + historical
  const columnSuggestions = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of customColumns) {
      if (col.column_type !== "text") continue;
      const set = new Set<string>(col.suggestions || []);
      for (const tx of transactions) {
        const v = tx.custom_values?.[col.name];
        if (typeof v === "string" && v.trim()) set.add(v.trim());
      }
      map[col.name] = Array.from(set).sort((a, b) => a.localeCompare(b));
    }
    return map;
  }, [customColumns, transactions]);

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
      currency,
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
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, "");
                setAmount(v);
              }}
              placeholder="0.00"
              required
              className="bg-muted/50 border-border/50 text-2xl font-bold h-14"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 overflow-hidden">
            <div className="space-y-2 min-w-0">
              <Label className="text-muted-foreground text-xs">{t("tx.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-muted/50 border-border/50 min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-0">
              <Label className="text-muted-foreground text-xs">{t("tx.date")}</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-muted/50 border-border/50 min-w-0 w-full px-1 pr-0.5 text-xs [&::-webkit-calendar-picker-indicator]:w-3 [&::-webkit-calendar-picker-indicator]:h-3 [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:mr-0 [&::-webkit-date-and-time-value]:text-left"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">{t("tx.currency") || "Currency"}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-muted/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {col.column_type === "text" && columnSuggestions[col.name]?.length > 0 ? (
                    <AutoSuggestInput
                      value={customValues[col.name] || ""}
                      onChange={(val) =>
                        setCustomValues((prev) => ({ ...prev, [col.name]: val }))
                      }
                      suggestions={columnSuggestions[col.name]}
                      placeholder=""
                      className="bg-muted/50 border-border/50"
                    />
                  ) : (
                    <Input
                      type="text"
                      inputMode={col.column_type === "numeric" ? "decimal" : "text"}
                      value={customValues[col.name] || ""}
                      onChange={(e) => {
                        const val = col.column_type === "numeric"
                          ? e.target.value.replace(/[^0-9.]/g, "")
                          : e.target.value;
                        setCustomValues((prev) => ({ ...prev, [col.name]: val }));
                      }}
                      placeholder={col.column_type === "numeric" ? "0.00" : ""}
                      className="bg-muted/50 border-border/50"
                    />
                  )}
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
