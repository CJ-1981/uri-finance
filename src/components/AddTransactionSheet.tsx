import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CategoryNameSelector } from "@/components/CategorySelector";
import NumberedSelect from "@/components/NumberedSelect";
import { Calendar } from "@/components/ui/calendar";
import { Plus, TrendingUp, TrendingDown, CalendarIcon, X, Paperclip, Loader2, FileText, Eye } from "lucide-react";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { Category } from "@/hooks/useCategories";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { Transaction } from "@/hooks/useTransactions";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AutoSuggestInput from "@/components/AutoSuggestInput";
import ColoredBadge from "@/components/ColoredBadge";
import { FileUploadSheet } from "@/components/files/FileUploadSheet";
import { FilePreviewDialog, type FilePreviewInfo } from "@/components/files/FilePreviewDialog";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

// Valid ISO 4217 currency codes (ROL was replaced by RON in 2005)
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "KRW", "CNY", "CAD", "AUD", "CHF", "INR", "BRL", "MXN", "CZK", "RON", "SGD", "PLN"];

// Platform detection for keyboard shortcuts
const isMac = typeof window !== "undefined" && window.navigator.userAgent.includes("Mac");

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
  }) => Promise<string | undefined>; // Return transaction ID for file association
  // SPEC-TRANSACTION-FILES: File upload callback
  onUploadFile?: (file: File, remark?: string, transactionId?: string) => Promise<void>;
}

const AddTransactionSheet = ({ categories, customColumns, transactions, projectCurrency, externalOpen, onExternalOpenChange, onAdd, onUploadFile }: Props) => {
  const isOnline = useOnlineStatus();
  const { isStandalone } = useAuth();
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
  const [currency, setCurrency] = useState(projectCurrency || "EUR");
  const [isCustomCurrency, setIsCustomCurrency] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    customColumns.forEach(col => {
      if (col.default_value) initial[col.name] = col.default_value;
    });
    return initial;
  });
  // SPEC-TRANSACTION-FILES: State for file attachments
  const [pendingFiles, setPendingFiles] = useState<Array<{ file: File; remark: string; uploading?: boolean }>>([]);
  const [lastCreatedTransactionId, setLastCreatedTransactionId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [previewFile, setPreviewFile] = useState<FilePreviewInfo | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const customCurrencyInputRef = useRef<HTMLInputElement>(null);

  // Reset form with defaults when opening
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, customColumns]);

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
    const defaults: Record<string, string> = {};
    customColumns.forEach((col) => {
      if (col.default_value) {
        defaults[col.name] = col.default_value;
      }
    });
    setCustomValues(defaults);
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

    try {
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

      const result = await onAdd({
        type,
        amount: Number(amount),
        category,
        description: description || undefined,
        transaction_date: date,
        custom_values: Object.keys(cv).length > 0 ? cv : undefined,
        currency,
      });

      const transactionId = typeof result === 'string' ? result : result;
      if (transactionId) {
        setLastCreatedTransactionId(transactionId);
      }

      // SPEC-TRANSACTION-FILES: Upload pending files after transaction is created
      if (result && pendingFiles.length > 0 && onUploadFile) {
        if (!isOnline && !isStandalone) {
          toast.warning(t("tx.offlineFilesWarning") || "You are offline. Transaction saved, but files will not be uploaded.");
          // DO NOT clear pendingFiles here, so they stay in the UI for retry
        } else {
          const transactionIdStr = typeof result === 'string' ? result : result;
          const successfulIndices: number[] = [];

          // Upload each pending file with progress tracking
          for (let i = 0; i < pendingFiles.length; i++) {
            const pendingFile = pendingFiles[i];
            setUploadProgress(prev => ({ ...prev, [i]: 0 }));
            setPendingFiles(prev => prev.map((pf, idx) => idx === i ? { ...pf, uploading: true } : pf));

            try {
              await onUploadFile(pendingFile.file, pendingFile.remark, transactionIdStr);
              setUploadProgress(prev => ({ ...prev, [i]: 100 }));
              successfulIndices.push(i);
            } catch (error) {
              console.error('Failed to upload file:', error);
              setPendingFiles(prev => prev.map((pf, idx) => idx === i ? { ...pf, uploading: false } : pf));
              toast.error(`${t('files.uploadFailed') || 'Failed to upload'}: ${pendingFile.file.name}`);
            }
          }

          // Only remove the files that succeeded
          if (successfulIndices.length > 0) {
            setPendingFiles(prev => prev.filter((_, idx) => !successfulIndices.includes(idx)));
            // Reset progress for next batch
            setUploadProgress({});
          }
        }
      }
      return true;
    } catch (err) {
      console.error("[AddTransactionSheet] submit failed:", err);
      toast.error(t("tx.addFailed") || "Failed to add transaction");
      return false;
    } finally {
      setSubmitting(false);
    }
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

  const sheetRef = useRef<HTMLDivElement>(null);

  const handleFormKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter → submit
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
      return;
    }

    // Shift+Ctrl+Enter or Shift+Cmd+Enter → add and continue
    if (e.key === "Enter" && e.shiftKey && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAddAndContinue();
      return;
    }

    // Tab management
    if (e.key !== "Tab") return;

    // Don't intercept Tab when a popover/dropdown is open
    if (document.querySelector('[data-radix-popper-content-wrapper]')) return;
    // Don't intercept Tab when custom category dropdown is open
    if (document.querySelector('[data-category-dropdown-open="true"]')) return;

    const container = sheetRef.current;
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
  }, [handleAddAndContinue]);

  // Handle sheet open to blur trigger button
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      // Blur trigger button when sheet opens to avoid aria-hidden conflict
      triggerRef.current?.blur();
    } else {
      // Blur currently focused element when sheet closes to prevent aria-hidden violation
      (document.activeElement as HTMLElement)?.blur();
    }
    setOpen(newOpen);
  }, [setOpen]);

  const FormContent = (
    <>
      <form ref={formRef} onSubmit={handleSubmit} className="mt-4 space-y-4 pb-16">
        {/* Type toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            data-tab-stop
            onClick={() => setType("income")}
            onPointerDown={(e) => isMobile && e.stopPropagation()}
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
            onPointerDown={(e) => isMobile && e.stopPropagation()}
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
            data-testid="transaction-amount"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">{t("tx.category")}</Label>
          <CategoryNameSelector
            categories={categories}
            selectedCategoryName={category}
            onCategoryChange={setCategory}
          />
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
            data-testid="transaction-description"
          />
        </div>

        {/* Date & Currency (moved to last) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 min-w-0">
            <Label className="text-muted-foreground text-xs">{t("tx.date")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  data-tab-stop
                  className={cn(
                    "w-full h-10 justify-start text-left font-normal bg-muted/50 border-border/50 min-w-0 px-3",
                    !date && "text-muted-foreground"
                  )}
                  onPointerDown={(e) => isMobile && e.stopPropagation()}
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
            <div className="flex gap-2">
              {isCustomCurrency ? (
                <div className="flex-1 flex gap-1.5">
                  <Input
                    ref={customCurrencyInputRef}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    placeholder="XYZ"
                    className="bg-muted/50 border-border/50 h-10 flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setIsCustomCurrency(false);
                      if (!CURRENCIES.includes(currency)) {
                        setCurrency(projectCurrency || "EUR");
                      }
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <NumberedSelect
                  value={currency}
                  onValueChange={(v) => {
                    if (v === "CUSTOM") {
                      setIsCustomCurrency(true);
                      setCurrency("");
                      // Small timeout to ensure input is rendered before focusing
                      setTimeout(() => customCurrencyInputRef.current?.focus(), 0);
                    } else {
                      setCurrency(v);
                    }
                  }}
                  items={[
                    ...CURRENCIES.map((c) => ({ value: c, label: c })),
                    { value: "CUSTOM", label: t("tx.customCurrency") || "Custom..." }
                  ]}
                  className="bg-muted/50 border-border/50 min-w-0"
                  showNumbers
                />
              )}
            </div>
          </div>
        </div>

        {/* SPEC-TRANSACTION-FILES: File Attachments Section */}
        {onUploadFile && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-xs flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                {t("files.attachments") || "Attachments"}
              </Label>
              {pendingFiles.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {pendingFiles.length} {t("files.files") || "files"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <FileUploadSheet
                uploadMode="single"
                onUpload={async (file, remark) => {
                  // Store file as pending until transaction is created
                  setPendingFiles(prev => [...prev, { file, remark }]);
                }}
                isUploading={false}
                transactionId={lastCreatedTransactionId || undefined}
              />
            </div>

            {/* Display pending files with upload progress */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2 mt-3">
                {pendingFiles.map((pendingFile, index) => {
                  const progress = uploadProgress[index] || 0;
                  const isUploading = pendingFile.uploading;

                  return (
                    <div key={index} className={`flex items-start justify-between p-2 rounded-lg border transition-colors ${
                      isUploading ? 'bg-primary/5 border-primary/20' : 'bg-muted/50 border-border/50'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isUploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <p className="text-sm font-medium text-foreground truncate" title={pendingFile.file.name}>
                            {pendingFile.file.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground">
                            {(pendingFile.file.size / 1024).toFixed(1)} KB
                            {pendingFile.remark && ` • ${pendingFile.remark}`}
                          </p>
                          {isUploading && (
                            <span className="text-xs text-primary font-medium">
                              {progress}%
                            </span>
                          )}
                        </div>
                        {/* Progress bar */}
                        {isUploading && (
                          <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                      {!isUploading && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground"
                            onClick={() => {
                              setPreviewFile({
                                file_name: pendingFile.file.name,
                                file_type: pendingFile.file.type,
                                localFile: pendingFile.file
                              });
                              setPreviewOpen(true);
                            }}
                            title={t('files.preview') || 'Preview'}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setPendingFiles(prev => prev.filter((_, i) => i !== index));
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {/* Action buttons - sticky to bottom */}
        <div className="sticky bottom-0 bg-card/95 backdrop-blur-sm z-20 pt-4 pb-2 mt-6 flex flex-wrap sm:flex-nowrap gap-2 border-t border-border/20">
          <Button
            type="button"
            data-tab-stop
            onClick={() => setOpen(false)}
            onPointerDown={(e) => isMobile && e.stopPropagation()}
            className="w-full sm:w-auto gradient-violet font-semibold text-white hover:opacity-90 transition-opacity h-12 justify-center gap-2"
          >
            <X className="h-4 w-4" />
            <span>{t("tx.cancel") || "Cancel"}</span>
          </Button>
          <Button
            type="button"
            data-tab-stop
            disabled={submitting}
            onClick={handleAddAndContinue}
            onPointerDown={(e) => isMobile && e.stopPropagation()}
            variant="outline"
            className="flex-1 font-semibold h-12 justify-center gap-2"
          >
            {submitting ? t("tx.adding") : (
              <>
                <span>{t("tx.addAndContinue")}</span>
                <kbd className="hidden sm:inline-flex h-5 px-1.5 items-center gap-1 rounded bg-muted/70 text-[10px] font-mono text-muted-foreground pointer-events-none border border-border/50">
                  {isMac ? (
                    <>
                      <span>⌘</span><span>⇧</span><span>⏎</span>
                    </>
                  ) : (
                    <span>Ctrl+⇧+Enter</span>
                  )}
                </kbd>
              </>
            )}
          </Button>
          <Button
            type="submit"
            data-tab-stop
            disabled={submitting}
            onPointerDown={(e) => isMobile && e.stopPropagation()}
            className="flex-1 gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity h-12 justify-center gap-2"
            data-testid="transaction-submit-button"
          >
            {submitting ? t("tx.adding") : (
              <>
                <span>{t("tx.addTransaction")}</span>
                <kbd className="hidden sm:inline-flex h-5 px-1.5 items-center gap-1 rounded bg-primary-foreground/20 text-[10px] font-mono text-primary-foreground/80 pointer-events-none border border-primary-foreground/20">
                  {isMac ? (
                    <>
                      <span>⌘</span><span>⏎</span>
                    </>
                  ) : (
                    <span>Ctrl+Enter</span>
                  )}
                </kbd>
              </>
            )}
          </Button>
        </div>
      </form>
    </>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
          <div className="max-w-screen-2xl mx-auto px-4 relative h-24">
            <SheetTrigger asChild>
              <Button
                ref={triggerRef}
                size="icon"
                className="absolute bottom-6 left-4 pointer-events-auto h-14 w-14 rounded-full gradient-primary shadow-lg shadow-primary/30"
                aria-label={t("tx.addTransaction") || "Add transaction"}
                data-testid="add-transaction-button"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </SheetTrigger>
          </div>
        </div>
        <SheetContent
          ref={sheetRef}
          onKeyDown={handleFormKeyDown}
          side="bottom"
          className="rounded-t-3xl bg-card border-border/50 px-0 pb-0 h-[85vh] sm:h-[90vh] flex flex-col outline-none shadow-2xl w-full max-w-2xl mx-auto left-1/2 -translate-x-1/2"
          data-testid="add-transaction-form"
          tabIndex={-1}
          onOpenAutoFocus={(e) => {
            if (!isMobile && amountInputRef.current) {
              e.preventDefault();
              amountInputRef.current.focus();
            } else if (isMobile && sheetRef.current) {
              e.preventDefault();
              sheetRef.current.focus();
            }
          }}
        >
          <div className="px-6 pt-6 pb-2 shrink-0 border-b border-border/5">
            <SheetHeader className="p-0 text-left sm:text-left">
              <SheetTitle className="text-foreground text-xl">{t("tx.addTransaction")}</SheetTitle>
              <SheetDescription className="sr-only">
                {t("tx.addTransactionDesc")}
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 px-6 pb-8 overscroll-contain">
            {FormContent}
          </div>
        </SheetContent>
      </Sheet>
      <FilePreviewDialog
        file={previewFile}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </>
  );
};

export default AddTransactionSheet;
