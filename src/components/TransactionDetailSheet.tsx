import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryNameSelector } from "@/components/CategorySelector";
import NumberedSelect from "@/components/NumberedSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TrendingUp, TrendingDown, Trash2, Save, ChevronLeft, ChevronRight, CalendarIcon, Paperclip, FileText, Download, ExternalLink, Eye, X } from "lucide-react";
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
import { useFiles } from "@/hooks/useFiles";
import { FileUploadSheet } from "@/components/files/FileUploadSheet";
import { FilePreviewDialog, type FilePreviewInfo } from "@/components/files/FilePreviewDialog";
import type { ProjectFile } from "@/types/files";

// Valid ISO 4217 currency codes (ROL was replaced by RON in 2005)
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "KRW", "CNY", "CAD", "AUD", "CHF", "INR", "BRL", "MXN", "CZK", "RON", "SGD", "PLN"];

// Platform detection for keyboard shortcuts
const isMac = typeof window !== "undefined" && window.navigator.userAgent.includes("Mac");

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
  /** Current project ID for file fetch */
  projectId?: string;
  /** Callback to navigate to files view with optional file highlight */
  onViewInFiles?: (fileId?: string) => void;
  /** Project currency for default selection */
  projectCurrency?: string;
}

const TransactionDetailSheet = ({ transaction, categories, customColumns, open, onOpenChange, onUpdate, onDelete, isViewer, transactionList, onNavigate, allTransactions, projectId, onViewInFiles, projectCurrency }: Props) => {
  const { user } = useAuth();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [currency, setCurrency] = useState(projectCurrency || "USD");
  const [isCustomCurrency, setIsCustomCurrency] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [previewFile, setPreviewFile] = useState<FilePreviewInfo | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const customCurrencyInputRef = useRef<HTMLInputElement>(null);

  // SPEC-TRANSACTION-FILES: Fetch files associated with this transaction
  const { files, isLoading: isLoadingFiles, downloadFile, uploadFile, isUploading } = useFiles(projectId || "");
  const transactionFiles = transaction && projectId ? files.filter(f => f.transaction_id === transaction.id) : [];

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
    setIsCustomCurrency(!!tx.currency && !CURRENCIES.includes(tx.currency));
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

  const handleSave = async (closeAfterSave = false) => {
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

    if (closeAfterSave) {
      onOpenChange(false);
    } else if (transactionList && hasNext && onNavigate) {
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
    // Ctrl+Enter or Cmd+Enter
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) {
        handleSave(false); // save and next
      } else {
        handleSave(true); // save and close
      }
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

  const FormContent = (
    <div ref={formRef} onKeyDown={handleFormKeyDown} className="space-y-4 pb-16">
      {/* Type toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          data-tab-stop
          onClick={() => isOwn && setType("income")}
          onPointerDown={(e) => isMobile && e.stopPropagation()}
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
          onPointerDown={(e) => isMobile && e.stopPropagation()}
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
        <CategoryNameSelector
          categories={categories}
          selectedCategoryName={category}
          onCategoryChange={setCategory}
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
                    className="bg-muted/50 border-border/50 min-w-0"
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

      {/* SPEC-TRANSACTION-FILES: Attached Files Section */}
      {projectId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" />
              {t("files.attachments") || "Attachments"}
            </Label>
            <span className="text-xs text-muted-foreground">
              {transactionFiles.length} {transactionFiles.length === 1 ? t("files.file") || "file" : t("files.files") || "files"}
            </span>
          </div>

          {/* File upload button - only show for non-viewers who own the transaction */}
          {isOwn && transaction && (
            <div className="flex items-center gap-2">
              <FileUploadSheet
                onUpload={async (file, remark) => {
                  try {
                    await uploadFile({ file, remark, transactionId: transaction.id });
                    // Note: Query invalidation happens automatically in useFiles hook's onSuccess handler
                    // This ensures the file list refreshes to show the newly uploaded file
                  } catch (error) {
                    console.error('Failed to upload file:', error);
                    toast.error(t("files.uploadError") || "Failed to upload file");
                  }
                }}
                isUploading={isUploading}
                transactionId={transaction.id}
              />
            </div>
          )}

          {isLoadingFiles ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">{t("files.loading") || "Loading..."}</p>
            </div>
          ) : transactionFiles.length === 0 ? (
            <div className="text-center py-4 border border-dashed border-border/50 rounded-lg">
              <Paperclip className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No files attached
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactionFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate" title={file.file_name}>
                        {file.file_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{(file.file_size / 1024).toFixed(1)} KB</span>
                        {file.remark && (
                          <span className="truncate" title={file.remark}>
                            • {file.remark}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setPreviewFile(file);
                          setPreviewOpen(true);
                        }}
                        title={t('files.preview') || 'Preview'}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          try {
                            const blob = await downloadFile(file);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = file.file_name;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            setTimeout(() => URL.revokeObjectURL(url), 100);
                          } catch (error) {
                            console.error('Download failed:', error);
                            toast.error('Failed to download file');
                          }
                        }}
                        title={t('files.download') || 'Download'}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          onOpenChange(false); // Close the detail sheet
                          onViewInFiles?.(file.id); // Navigate to files view with file highlight
                        }}
                        title="View in Files"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Date & Currency (last before buttons) */}
      <div className="grid grid-cols-2 gap-3 overflow-hidden">
        <div className="space-y-2 min-w-0">
          <Label className="text-muted-foreground text-xs">{t("tx.date")}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                data-tab-stop
                disabled={!isOwn}
                onPointerDown={(e) => isMobile && e.stopPropagation()}
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
          <div className="flex gap-2">
            {isCustomCurrency ? (
              <div className="flex-1 flex gap-1.5">
                <Input
                  ref={customCurrencyInputRef}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  placeholder="XYZ"
                  disabled={!isOwn}
                  className="bg-muted/50 border-border/50 h-10 flex-1"
                  autoFocus
                />
                {isOwn && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setIsCustomCurrency(false);
                      if (!CURRENCIES.includes(currency)) {
                        setCurrency(projectCurrency || "USD");
                      }
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <NumberedSelect
                value={currency}
                onValueChange={(v) => {
                  if (v === "CUSTOM") {
                    setIsCustomCurrency(true);
                    setCurrency("");
                    setTimeout(() => customCurrencyInputRef.current?.focus(), 0);
                  } else {
                    setCurrency(v);
                  }
                }}
                disabled={!isOwn}
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

      {/* Action buttons - sticky to bottom */}
      {isOwn && (
        <div className="sticky bottom-0 bg-card/95 backdrop-blur-sm z-20 pt-4 pb-2 mt-6 flex flex-wrap sm:flex-nowrap gap-2 border-t border-border/20">
          <div className="flex gap-2 w-full sm:w-auto">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" data-tab-stop className="h-12 px-4 flex-1 sm:flex-none" onPointerDown={(e) => isMobile && e.stopPropagation()}>
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
              type="button"
              onClick={() => onOpenChange(false)}
              onPointerDown={(e) => isMobile && e.stopPropagation()}
              className="h-12 px-4 flex-1 sm:flex-none gradient-violet font-semibold text-white hover:opacity-90 transition-opacity justify-center gap-2"
            >
              <X className="h-4 w-4" />
              <span>{t("tx.cancel") || "Cancel"}</span>
            </Button>
          </div>

          <Button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            data-tab-stop
            onPointerDown={(e) => isMobile && e.stopPropagation()}
            variant="outline"
            className="flex-1 font-semibold h-12 w-full sm:w-auto"
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? t("tx.saving") : (
              <>
                <span>{t("tx.saveAndNext") || "Save & Next"}</span>
                <kbd className="hidden sm:inline-flex h-5 px-1.5 items-center gap-1 rounded bg-muted/70 text-[10px] font-mono text-muted-foreground pointer-events-none border border-border/50 ml-2">
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
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            data-tab-stop
            onPointerDown={(e) => isMobile && e.stopPropagation()}
            className="flex-1 gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity h-12 w-full sm:w-auto"
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? t("tx.saving") : (
              <>
                <span>{t("tx.saveAndClose") || "Save & Close"}</span>
                <kbd className="hidden sm:inline-flex h-5 px-1.5 items-center gap-1 rounded bg-primary-foreground/20 text-[10px] font-mono text-primary-foreground/80 pointer-events-none border border-primary-foreground/20 ml-2">
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
      )}
    </div>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl bg-card border-border/50 px-0 pb-0 h-[85vh] sm:h-[90vh] flex flex-col outline-none shadow-2xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            if (!isMobile) {
              amountInputRef.current?.focus();
            }
          }}
        >
          <div className="px-6 pt-6 pb-4 shrink-0 border-b border-border/10">
            <SheetHeader className="p-0">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-foreground text-xl">{t("tx.editTransaction")}</SheetTitle>
                {totalCount > 1 && (
                  <div className="flex items-center gap-1 mr-8">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev} disabled={!hasPrev}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums min-w-[3ch] text-center">
                      {currentIndex + 1}/{totalCount}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext} disabled={!hasNext}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <SheetDescription className="sr-only">
                Edit transaction details including amount, category, and custom fields.
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 px-6 pt-6 pb-8 overscroll-contain">
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

export default TransactionDetailSheet;
