import { useState, useMemo, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CategoryNameSelector } from "@/components/CategorySelector";
import NumberedSelect from "@/components/NumberedSelect";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Minus, TrendingUp, TrendingDown, CalendarIcon, ChevronDown, ChevronRight, Tag } from "lucide-react";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { Category } from "@/hooks/useCategories";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { Transaction } from "@/hooks/useTransactions";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import AutoSuggestInput from "@/components/AutoSuggestInput";
import ColoredBadge from "@/components/ColoredBadge";

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

// Tree item component for inline dropdown
const InlineTreeItem = ({ node, depth, selectedCategoryName, expandedNodes, onToggleExpand, onSelect, isMobile }: {
  node: Category & { children: (Category & { children: any[] })[] };
  depth: number;
  selectedCategoryName: string | null;
  expandedNodes: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (name: string | null) => void;
  isMobile: boolean;
}) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);

  return (
    <div>
      <div className="flex items-center gap-1">
        {/* Expand/collapse button */}
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className={cn(
              "shrink-0 rounded transition-colors",
              isMobile
                ? "p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                : "p-0.5 min-w-[20px] min-h-[20px] flex items-center justify-center text-muted-foreground hover:text-foreground"
            )}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isMobile ? (
              isExpanded ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />
            ) : (
              isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
        {/* Spacer if no children */}
        {!hasChildren && (
          <div className={cn(
            isMobile ? "w-[36px] h-[36px]" : "w-[20px] h-[20px]"
          )} />
        )}
        {/* Category button */}
        <button
          type="button"
          onClick={() => onSelect(node.name)}
          className={cn(
            "flex-1 text-left rounded-md px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2",
            selectedCategoryName === node.name
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-muted"
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {node.icon && <span className="shrink-0">{node.icon}</span>}
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <InlineTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedCategoryName={selectedCategoryName}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Custom inline dropdown for modal context
const InlineCategoryDropdown = ({ categories, selectedCategoryName, onCategoryChange }: {
  categories: Category[];
  selectedCategoryName: string | null;
  onCategoryChange: (name: string | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const selectedCategory = categories.find((c) => c.name === selectedCategoryName);
  const activeLabel = selectedCategory ? selectedCategory.name : t("tx.selectAllCategories");

  // Build tree structure
  const categoryTree = useMemo(() => {
    const categoryMap = new Map<string, Category & { children: (Category & { children: any[] })[] }>();
    const roots: (Category & { children: any[] })[] = [];

    // First pass: create nodes
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree
    categories.forEach(cat => {
      const node = categoryMap.get(cat.id)!;
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        categoryMap.get(cat.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [categories]);

  const handleSelect = (name: string | null) => {
    onCategoryChange(name);
    setOpen(false);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(!open);
  };

  const toggleExpanded = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div
      ref={dropdownRef}
      className="relative"
      data-category-dropdown-open={open ? "true" : "false"}
    >
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap overflow-hidden max-w-[200px]",
          !open && "data-tab-stop"
        )}
      >
        <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{activeLabel}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-[60]"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown content */}
          <div
            className={cn(
              "absolute left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-[70] min-w-[200px] max-w-[300px]",
              isMobile ? "max-h-[60vh] overflow-y-auto" : "max-h-[400px] overflow-y-auto"
            )}
            style={{
              touchAction: 'pan-y',
              WebkitOverflowScrolling: 'touch'
            }}
            onKeyDown={(e) => {
              // Prevent tab key from bubbling to form
              if (e.key === 'Tab') {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
          >
            <div className="p-1">
              {/* "All Categories" option */}
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={cn(
                  "w-full text-left rounded-md px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2",
                  selectedCategoryName === null
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{t("tx.selectAllCategories")}</span>
              </button>
              {/* Tree items */}
              {categoryTree.map((node) => (
                <InlineTreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedCategoryName={selectedCategoryName}
                  expandedNodes={expandedNodes}
                  onToggleExpand={toggleExpanded}
                  onSelect={handleSelect}
                  isMobile={isMobile}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

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
  const isMobile = useIsMobile();
  const amountInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
    // Don't intercept Tab when custom category dropdown is open
    if (document.querySelector('[data-category-dropdown-open="true"]')) return;

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

  // Handle sheet open to blur trigger button
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      // Blur trigger button when sheet opens to avoid aria-hidden conflict
      triggerRef.current?.blur();
    }
    setOpen(newOpen);
  }, [setOpen]);

  const FormContent = (
    <>
      {isMobile ? (
        <DrawerHeader>
          <DrawerTitle className="text-foreground">{t("tx.addTransaction")}</DrawerTitle>
          <DrawerDescription className="sr-only">
            Add a new transaction to track your income or expenses.
          </DrawerDescription>
        </DrawerHeader>
      ) : (
        <SheetHeader>
          <SheetTitle className="text-foreground">{t("tx.addTransaction")}</SheetTitle>
          <SheetDescription className="sr-only">
            Add a new transaction to track your income or expenses.
          </SheetDescription>
        </SheetHeader>
      )}

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
            ref={amountInputRef}
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
          {isMobile ? (
            <InlineCategoryDropdown
              categories={categories}
              selectedCategoryName={category}
              onCategoryChange={setCategory}
            />
          ) : (
            <CategoryNameSelector
              categories={categories}
              selectedCategoryName={category}
              onCategoryChange={setCategory}
            />
          )}
        </div>

        {/* Custom columns (after category) */}
        {customColumns.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {customColumns.map((col) => (
              <div key={col.id} className="space-y-2">
                <Label className="text-muted-foreground text-xs">{col.name}{col.required ? <span className="text-destructive ml-0.5">*</span> : <span className="text-muted-foreground/50 ml-1">({t("tx.optional") || "optional"})</span>}</Label>
                {col.column_type === "list" && (col.suggestions || []).length > 0 ? (
                  <NumberedSelect
                    value={customValues[col.name] || ""}
                    onValueChange={(val) =>
                      setCustomValues((prev) => ({ ...prev, [col.name]: val }))
                    }
                    items={col.suggestions.map((opt) => ({
                      value: opt,
                      label: <ColoredBadge value={opt} colorKey={(col.suggestion_colors as Record<string, string>)?.[opt]} />
                    }))}
                    className="bg-muted/50 border-border/50 min-w-0"
                    showNumbers
                  />
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
          <div className="space-y-2 min-w-0">
            <Label className="text-muted-foreground text-xs">{t("tx.currency") || "Currency"}</Label>
            <NumberedSelect
              value={currency}
              onValueChange={setCurrency}
              items={CURRENCIES.map((c) => ({ value: c, label: c }))}
              className="bg-muted/50 border-border/50 min-w-0"
              showNumbers
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
    </>
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerTrigger asChild>
            <Button ref={triggerRef} size="icon" className="fixed bottom-6 left-6 z-40 h-14 w-14 rounded-full gradient-primary shadow-lg shadow-primary/30">
              <Plus className="h-6 w-6" />
            </Button>
          </DrawerTrigger>
          <DrawerContent
            className="rounded-t-3xl bg-card border-border/50 px-0 pb-0 max-h-[85vh] flex flex-col"
          >
            <div className="px-6 overflow-y-auto flex-1 pb-8">
              {FormContent}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetTrigger asChild>
            <Button ref={triggerRef} size="icon" className="fixed bottom-6 left-6 z-40 h-14 w-14 rounded-full gradient-primary shadow-lg shadow-primary/30">
              <Plus className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl bg-card border-border/50 px-0 pb-0 max-h-[85vh] sm:max-h-[95vh] flex flex-col"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              if (!isMobile) {
                amountInputRef.current?.focus();
              }
            }}
          >
            <div className="px-6 overflow-y-auto flex-1 pb-8">
              {FormContent}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
};

export default AddTransactionSheet;
