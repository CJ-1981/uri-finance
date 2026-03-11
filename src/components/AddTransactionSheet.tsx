import { useState, useMemo, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NumberedSelect from "@/components/NumberedSelect";
import { Calendar } from "@/components/ui/calendar";
import { Plus, TrendingUp, TrendingDown, CalendarIcon } from "lucide-react";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { Category } from "@/hooks/useCategories";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { Transaction } from "@/hooks/useTransactions";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";
import AutoSuggestInput from "@/components/AutoSuggestInput";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "KRW", "CNY", "CAD", "AUD", "CHF", "INR", "BRL", "MXN"];

interface Props {
  categories: Category[];
  customColumns: CustomColumn[];
  transactions: Transaction[];
  projectCurrency?: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
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

const AddTransactionSheet = ({ categories, customColumns, transactions, projectCurrency, externalOpen, onExternalOpenChange, onAdd }: Props) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onExternalOpenChange?.(v);
  };
  const [type, setType] = useState<"income" | "expense">("income");
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

    // Validate required custom columns
    for (const col of customColumns) {
      if (col.required && !customValues[col.name]?.trim()) {
        toast.error(`${col.name} is required`);
        return;
      }
    }

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

  const formRef = useRef<HTMLFormElement>(null);

  const handleFormKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter → submit
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      formRef.current?.requestSubmit();
      return;
    }

    // Tab management
    if (e.key !== "Tab") return;

    // Don't intercept Tab when a popover/dropdown is open
    if (document.querySelector('[data-radix-popper-content-wrapper]')) return;

    const form = formRef.current;
    if (!form) return;

    const stops = Array.from(
      form.querySelectorAll<HTMLElement>('[data-tab-stop]')
    ).filter((el) => el.offsetParent !== null && !el.hasAttribute('disabled'));

    if (stops.length === 0) return;

    const target = (e.target as HTMLElement).closest?.('[data-tab-stop]') as HTMLElement | null;
    const currentIdx = target ? stops.indexOf(target) : -1;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) {
      const prev = currentIdx <= 0 ? stops.length - 1 : currentIdx - 1;
      stops[prev].focus();
    } else {
      const next = currentIdx < 0 || currentIdx >= stops.length - 1 ? 0 : currentIdx + 1;
      stops[next].focus();
    }
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon" className="fixed bottom-6 left-6 z-40 h-14 w-14 rounded-full gradient-primary shadow-lg shadow-primary/30">
          <Plus className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl bg-card border-border/50 px-0 pb-0 max-h-[85vh] sm:max-h-[95vh] flex flex-col">
        <div className="px-6 overflow-y-auto flex-1 pb-8">
        <SheetHeader>
          <SheetTitle className="text-foreground">{t("tx.addTransaction")}</SheetTitle>
        </SheetHeader>

        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="mt-4 space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              data-tab-stop
              onClick={() => setType("income")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-all ${
                type === "income"
                  ? "income-badge ring-1 ring-income/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <TrendingUp className="h-4 w-4" /> {t("tx.income")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              data-tab-stop
              onClick={() => setType("expense")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-all ${
                type === "expense"
                  ? "expense-badge ring-1 ring-expense/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <TrendingDown className="h-4 w-4" /> {t("tx.expense")}
            </Button>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">{t("tx.amount")}</Label>
            <Input
              type="text"
              inputMode="decimal"
              data-tab-stop
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

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">{t("tx.category")}</Label>
            <NumberedSelect
              value={category}
              onValueChange={setCategory}
              items={categories.map((c) => ({ value: c.name, label: c.name }))}
              showNumbers
              className="bg-muted/50 border-border/50 min-w-0"
            />
          </div>

          {/* Custom columns (after category) */}
          {customColumns.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {customColumns.map((col) => (
                <div key={col.id} className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{col.name}{col.required ? <span className="text-destructive ml-0.5">*</span> : <span className="text-muted-foreground/50 ml-1">({t("tx.optional") || "optional"})</span>}</Label>
                  {col.column_type === "list" && (col.suggestions || []).length > 0 ? (
                    <Select
                      value={customValues[col.name] || ""}
                      onValueChange={(val) =>
                        setCustomValues((prev) => ({ ...prev, [col.name]: val }))
                      }
                    >
                      <SelectTrigger data-tab-stop className="bg-muted/50 border-border/50">
                        <SelectValue placeholder={t("tx.selectOption")} />
                      </SelectTrigger>
                      <SelectContent>
                        {col.suggestions.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : col.column_type === "text" && columnSuggestions[col.name]?.length > 0 ? (
                    <AutoSuggestInput
                      value={customValues[col.name] || ""}
                      onChange={(val) =>
                        setCustomValues((prev) => ({ ...prev, [col.name]: val }))
                      }
                      suggestions={columnSuggestions[col.name]}
                      placeholder=""
                      className="bg-muted/50 border-border/50"
                      data-tab-stop
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
                      data-tab-stop
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">{t("tx.descriptionOptional")}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("tx.descriptionPlaceholder")}
              className="bg-muted/50 border-border/50"
              data-tab-stop
            />
          </div>

          {/* Date & Currency (moved to last) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 min-w-0">
              <Label className="text-muted-foreground text-xs">{t("tx.date")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    data-tab-stop
                    className={cn(
                      "w-full h-10 justify-start text-left font-normal bg-muted/50 border-border/50 min-w-0 px-3",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">
                      {date ? format(parse(date, "yyyy-MM-dd", new Date()), "MMM d, yyyy") : "Pick date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date ? parse(date, "yyyy-MM-dd", new Date()) : undefined}
                    onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">{t("tx.currency") || "Currency"}</Label>
              <NumberedSelect
                value={currency}
                onValueChange={setCurrency}
                items={CURRENCIES.map((c) => ({ value: c, label: c }))}
                className="bg-muted/50 border-border/50"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              data-tab-stop
              disabled={submitting}
              onClick={handleAddAndContinue}
              variant="outline"
              className="flex-1 font-semibold h-12"
            >
              {submitting ? t("tx.adding") : t("tx.addAndContinue")}
            </Button>
            <Button
              type="submit"
              data-tab-stop
              disabled={submitting}
              className="flex-1 gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity h-12"
            >
              {submitting ? t("tx.adding") : t("tx.addTransaction")}
            </Button>
          </div>
        </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddTransactionSheet;
