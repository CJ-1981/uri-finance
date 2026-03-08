import { useState, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Upload, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { Category } from "@/hooks/useCategories";
import { toast } from "sonner";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "KRW", "CNY", "CAD", "AUD", "CHF", "INR", "BRL", "MXN"];
const VALID_TYPES = ["income", "expense"];

interface ImportRow {
  line: number;
  type: string;
  amount: string;
  category: string;
  description: string;
  date: string;
  currency: string;
}

interface ValidationResult {
  row: ImportRow;
  errors: string[];
  valid: boolean;
  parsed?: {
    type: "income" | "expense";
    amount: number;
    category: string;
    description?: string;
    transaction_date?: string;
    currency?: string;
  };
}

interface Props {
  categories: Category[];
  projectCurrency: string;
  onImport: (txs: Array<{
    type: "income" | "expense";
    amount: number;
    category: string;
    description?: string;
    transaction_date?: string;
    currency?: string;
  }>) => Promise<void>;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function validateRow(row: ImportRow, categories: Category[], projectCurrency: string, t: (k: string) => string): ValidationResult {
  const errors: string[] = [];

  // Type
  const typeLower = row.type.toLowerCase();
  if (!VALID_TYPES.includes(typeLower)) {
    errors.push(t("import.errType"));
  }

  // Amount
  const amount = Number(row.amount);
  if (!row.amount || isNaN(amount) || amount <= 0) {
    errors.push(t("import.errAmount"));
  }

  // Category
  const category = row.category || "General";
  const catNames = categories.map((c) => c.name.toLowerCase());
  if (row.category && !catNames.includes(row.category.toLowerCase())) {
    errors.push(t("import.errCategory").replace("{v}", row.category));
  }

  // Date
  let dateStr = row.date || new Date().toISOString().split("T")[0];
  if (row.date) {
    const d = new Date(row.date);
    if (isNaN(d.getTime())) {
      errors.push(t("import.errDate"));
      dateStr = new Date().toISOString().split("T")[0];
    } else {
      dateStr = d.toISOString().split("T")[0];
    }
  }

  // Currency
  const currency = row.currency?.toUpperCase() || projectCurrency;
  if (row.currency && !CURRENCIES.includes(currency)) {
    errors.push(t("import.errCurrency").replace("{v}", row.currency));
  }

  const valid = errors.length === 0;
  const matchedCategory = categories.find((c) => c.name.toLowerCase() === category.toLowerCase())?.name || category;

  return {
    row,
    errors,
    valid,
    parsed: valid
      ? {
          type: typeLower as "income" | "expense",
          amount,
          category: matchedCategory,
          description: row.description || undefined,
          transaction_date: dateStr,
          currency: CURRENCIES.includes(currency) ? currency : projectCurrency,
        }
      : undefined,
  };
}

const ImportTransactions = ({ categories, projectCurrency, onImport }: Props) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ValidationResult[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error(t("import.noData"));
        return;
      }

      // Parse header to detect column mapping
      const headerCols = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
      const colMap = {
        type: headerCols.findIndex((h) => ["type", "유형"].includes(h)),
        amount: headerCols.findIndex((h) => ["amount", "금액"].includes(h)),
        category: headerCols.findIndex((h) => ["category", "카테고리"].includes(h)),
        description: headerCols.findIndex((h) => ["description", "설명", "memo", "메모"].includes(h)),
        date: headerCols.findIndex((h) => ["date", "날짜", "transaction_date"].includes(h)),
        currency: headerCols.findIndex((h) => ["currency", "통화"].includes(h)),
      };

      // Require at least type and amount
      if (colMap.type === -1 || colMap.amount === -1) {
        toast.error(t("import.missingColumns"));
        return;
      }

      const rows: ImportRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        rows.push({
          line: i + 1,
          type: (cols[colMap.type] || "").trim(),
          amount: (cols[colMap.amount] || "").trim(),
          category: colMap.category >= 0 ? (cols[colMap.category] || "").trim() : "",
          description: colMap.description >= 0 ? (cols[colMap.description] || "").trim() : "",
          date: colMap.date >= 0 ? (cols[colMap.date] || "").trim() : "",
          currency: colMap.currency >= 0 ? (cols[colMap.currency] || "").trim() : "",
        });
      }

      const validated = rows.map((r) => validateRow(r, categories, projectCurrency, t));
      setResults(validated);
    };
    reader.readAsText(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const validCount = results?.filter((r) => r.valid).length || 0;
  const failedCount = results?.filter((r) => !r.valid).length || 0;

  const handleImport = async () => {
    if (!results) return;
    const valid = results.filter((r) => r.valid && r.parsed).map((r) => r.parsed!);
    if (valid.length === 0) return;
    setImporting(true);
    await onImport(valid);
    setImporting(false);
    toast.success(t("import.success").replace("{n}", String(valid.length)));
    setResults(null);
    setFileName("");
    setOpen(false);
  };

  const handleClose = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setResults(null);
      setFileName("");
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Upload className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl bg-card border-border/50 px-6 pb-8 max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground">{t("import.title")}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Upload area */}
            {!results && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{t("import.desc")}</p>
                <Button
                  variant="outline"
                  className="w-full h-20 border-dashed border-2 border-border/50"
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t("import.selectFile")}</span>
                  </div>
                </Button>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">{t("import.formatTitle")}</p>
                  <code className="text-[10px] text-muted-foreground block">
                    type,amount,category,description,date,currency
                    <br />
                    income,5000,Salary,Monthly pay,2026-03-01,USD
                    <br />
                    expense,50,Food,Lunch,,
                  </code>
                </div>
              </div>
            )}

            {/* Results */}
            {results && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{fileName}</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setResults(null); setFileName(""); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                {/* Summary */}
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-income" />
                    <span className="text-foreground">{t("import.valid").replace("{n}", String(validCount))}</span>
                  </div>
                  {failedCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 text-expense" />
                      <span className="text-expense">{t("import.failed").replace("{n}", String(failedCount))}</span>
                    </div>
                  )}
                </div>

                {/* Failed entries */}
                {failedCount > 0 && (
                  <div className="rounded-lg border border-expense/20 bg-expense/5 p-3 space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-[10px] font-medium text-expense">{t("import.failedEntries")}</p>
                    {results
                      .filter((r) => !r.valid)
                      .map((r, i) => (
                        <div key={i} className="text-[10px] text-muted-foreground">
                          <span className="font-medium text-foreground">{t("import.line")} {r.row.line}:</span>{" "}
                          {r.errors.join("; ")}
                        </div>
                      ))}
                  </div>
                )}

                {/* Import button */}
                <Button
                  onClick={handleImport}
                  disabled={importing || validCount === 0}
                  className="w-full gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity h-12"
                >
                  {importing
                    ? t("import.importing")
                    : t("import.importBtn").replace("{n}", String(validCount))}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default ImportTransactions;
