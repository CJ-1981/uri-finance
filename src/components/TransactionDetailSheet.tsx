import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NumberedSelect from "@/components/NumberedSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TrendingUp, TrendingDown, Trash2, Save, ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { Transaction } from "@/hooks/useTransactions";
import { Category } from "@/hooks/useCategories";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import AutoSuggestInput from "@/components/AutoSuggestInput";
import ColoredBadge from "@/components/ColoredBadge";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "KRW", "CNY", "CAD", "AUD", "CHF", "INR", "BRL", "MXN"];

interface Props {
  transaction: Transaction | null;
  categories: Category[];
  customColumns: CustomColumn[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<Pick<Transaction, "type" | "amount" | "category" | "description" | "transaction_date" | "custom_values" | "currency">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isViewer?: boolean;
  /** For multi-edit: full list of selected transactions */
  transactionList?: Transaction[];
  onNavigate?: (tx: Transaction) => void;
  /** All transactions for historical suggestions */
  allTransactions?: Transaction[];
}

const TransactionDetailSheet = ({ transaction, categories, customColumns, open, onOpenChange, onUpdate, onDelete, isViewer, transactionList, onNavigate, allTransactions }: Props) => {
  const { user } = useAuth();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const amountInputRef = useRef<HTMLInputElement>(null);

  const isOwn = !isViewer && transaction?.user_id === user?.id;

  // Build suggestion lists per text column
  const columnSuggestions = useMemo(() => {
    const txList = allTransactions || [];
    const map: Record<string, string[]> = {};
    for (const col of customColumns) {
      if (col.column_type !== "text") continue;
      const set = new Set<string>(col.suggestions || []);
      for (const tx of txList) {
        const v = tx.custom_values?.[col.name];
        if (typeof v === "string" && v.trim()) set.add(v.trim());
      }
      map[col.name] = Array.from(set).sort((a, b) => a.localeCompare(b));
    }
    return map;
  }, [customColumns, allTransactions]);

  const currentIndex = transactionList && transaction
    ? transactionList.findIndex((tx) => tx.id === transaction.id)
    : -1;
  const hasPrev = transactionList && currentIndex > 0;
  const hasNext = transactionList && currentIndex >= 0 && currentIndex < transactionList.length - 1;
  const totalCount = transactionList?.length ?? 0;

  const loadTransaction = useCallback((tx: Transaction) => {
    setType(tx.type);
    setAmount(String(tx.amount));
    setCategory(tx.category);
    setDescription(tx.description || "");
    setDate(tx.transaction_date);
    setCurrency(tx.currency || "USD");
    const cv: Record<string, string> = {};
    if (tx.custom_values) {
      for (const [k, v] of Object.entries(tx.custom_values)) {
        cv[k] = String(v);
      }
    }
    setCustomValues(cv);
  }, []);

  // Load form when transaction changes
  useEffect(() => {
    if (open && transaction) loadTransaction(transaction);
  }, [open, transaction, loadTransaction]);

  const handleOpenChange = (val: boolean) => {
    if (val && transaction) loadTransaction(transaction);
    onOpenChange(val);
  };

  const handleSave = async () => {
    if (!transaction || !amount || Number(amount) <= 0) return;

    // Validate required custom columns
    for (const col of customColumns) {
      if (col.required && !customValues[col.name]?.trim()) {
        toast.error(`${col.name} is required`);
        return;
      }
    }

    setSaving(true);
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
    await onUpdate(transaction.id, {
      type,
      amount: Number(amount),
      category,
      description: description || null,
      transaction_date: date,
      custom_values: cv,
      currency,
    });
    setSaving(false);

    // In multi-edit mode, auto-advance to next; otherwise close
    if (transactionList && hasNext && onNavigate) {
      onNavigate(transactionList[currentIndex + 1]);
    } else {
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    await onDelete(transaction.id);
    // In multi-edit, advance to next or prev; otherwise close
    if (transactionList && onNavigate) {
      if (hasNext) {
        onNavigate(transactionList[currentIndex + 1]);
      } else if (hasPrev) {
        onNavigate(transactionList[currentIndex - 1]);
      } else {
        onOpenChange(false);
      }
    } else {
      onOpenChange(false);
    }
  };

  const goPrev = useCallback(() => {
    if (hasPrev && transactionList && onNavigate) {
      onNavigate(transactionList[currentIndex - 1]);
    }
  }, [hasPrev, transactionList, onNavigate, currentIndex]);

  const goNext = useCallback(() => {
    if (hasNext && transactionList && onNavigate) {
      onNavigate(transactionList[currentIndex + 1]);
    }
  }, [hasNext, transactionList, onNavigate, currentIndex]);

  const formRef = useRef<HTMLDivElement>(null);

  const handleFormKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter → save
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
      return;
    }

    if (e.key !== "Tab") return;
    if (document.querySelector('[data-radix-popper-content-wrapper]')) return;

    const container = formRef.current;
    if (!container) return;

    const stops = Array.from(
      container.querySelectorAll<HTMLElement>('[data-tab-stop]')
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
  }, [handleSave]);

  if (!transaction) return null;

  const visibleCustomCols = customColumns.filter(col => !(isViewer && col.masked));

  const HeaderContent = (
    <>
      <div className="flex items-center justify-between">
        {isMobile ? (
          <DrawerTitle className="text-foreground">{t("tx.editTransaction")}</DrawerTitle>
        ) : (
          <SheetTitle className="text-foreground">{t("tx.editTransaction")}</SheetTitle>
        )}
        {totalCount > 1 && (
          <div className="flex items-center gap-1 mr-8">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goPrev}
              disabled={!hasPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums min-w-[3ch] text-center">
              {currentIndex + 1}/{totalCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goNext}
              disabled={!hasNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  );

  const FormContent = (
    <div ref={formRef} onKeyDown={handleFormKeyDown} className="mt-4 space-y-4">
      {/* Type toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          data-tab-stop
          onClick={() => isOwn && setType("income")}
          disabled={!isOwn}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-all ${
            type === "income" ? "income-badge ring-1 ring-income/30" : "bg-muted text-muted-foreground"
          } ${!isOwn ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <TrendingUp className="h-4 w-4" /> {t("tx.income")}
        </button>
        <button
          type="button"
          data-tab-stop
          onClick={() => isOwn && setType("expense")}
          disabled={!isOwn}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-all ${
            type === "expense" ? "expense-badge ring-1 ring-expense/30" : "bg-muted text-muted-foreground"
          } ${!isOwn ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <TrendingDown className="h-4 w-4" /> {t("tx.expense")}
        </button>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs">{t("tx.amount")}</Label>
        <Input
          ref={amountInputRef}
          type="text"
          inputMode="decimal"
          data-tab-stop
          value={amount}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            setAmount(v);
          }}
          disabled={!isOwn}
          className="bg-muted/50 border-border/50 text-2xl font-bold h-14"
        />
      </div>

      {/* Category */}
      <div className="space-y-2 min-w-0">
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
      {visibleCustomCols.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {visibleCustomCols.map((col) => (
              <div key={col.id} className="space-y-2">
                <Label className="text-muted-foreground text-xs">{col.name}{col.required ? <span className="text-destructive ml-0.5">*</span> : <span className="text-muted-foreground/50 ml-1">({t("tx.optional") || "optional"})</span>}</Label>
                {col.column_type === "list" && (col.suggestions || []).length > 0 ? (
                  <NumberedSelect
                    value={customValues[col.name] || ""}
                    onValueChange={(val) =>
                      setCustomValues((prev) => ({ ...prev, [col.name]: val }))
                    }
                    disabled={!isOwn}
                    items={col.suggestions.map((opt) => ({
                      value: opt,
                      label: <ColoredBadge value={opt} colorKey={(col.suggestion_colors as Record<string, string>)?.[opt]} />
                    }))}
                    className="bg-muted/50 border-border/50"
                    showNumbers
                  />
                ) : col.column_type === "text" && columnSuggestions[col.name]?.length > 0 && isOwn ? (
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
                    data-tab-stop
                    value={customValues[col.name] || ""}
                    onChange={(e) => {
                      const val = col.column_type === "numeric"
                        ? e.target.value.replace(/[^0-9.]/g, "")
                        : e.target.value;
                      setCustomValues((prev) => ({ ...prev, [col.name]: val }));
                    }}
                    placeholder={col.column_type === "numeric" ? "0.00" : ""}
                    disabled={!isOwn}
                    className="bg-muted/50 border-border/50"
                  />
                )}
              </div>
            ))}
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs">{t("tx.description")}</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("tx.descriptionPlaceholder")}
          disabled={!isOwn}
          data-tab-stop
          className="bg-muted/50 border-border/50"
        />
      </div>

      {/* Date & Currency (last before buttons) */}
      <div className="grid grid-cols-2 gap-3 overflow-hidden">
        <div className="space-y-2 min-w-0">
          <Label className="text-muted-foreground text-xs">{t("tx.date")}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                data-tab-stop
                disabled={!isOwn}
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
            disabled={!isOwn}
            items={CURRENCIES.map((c) => ({ value: c, label: c }))}
            className="bg-muted/50 border-border/50"
            showNumbers
          />
        </div>
      </div>

      {/* Action buttons */}
      {isOwn && (
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-tab-stop className="h-12 px-4">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("tx.deleteTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("tx.deleteDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("tx.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>{t("tx.delete")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            onClick={handleSave}
            disabled={saving}
            data-tab-stop
            className="flex-1 gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity h-12"
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? t("tx.saving") : t("tx.saveChanges")}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent
            className="rounded-t-3xl bg-card border-border/50 px-0 pb-0 max-h-[85vh]"
          >
            <div className="overflow-y-auto flex-1 px-6 pb-8">
              <DrawerHeader>
                {HeaderContent}
              </DrawerHeader>
              {FormContent}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl bg-card border-border/50 px-0 pb-0 max-h-[85vh] sm:max-h-[95vh]"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              if (!isMobile) {
                amountInputRef.current?.focus();
              }
            }}
          >
            <div className="overflow-y-auto flex-1 px-6 pb-8">
              <SheetHeader>
                {HeaderContent}
              </SheetHeader>
              {FormContent}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
};

export default TransactionDetailSheet;
