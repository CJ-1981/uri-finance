import { useState, useRef } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowDownUp, Upload, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ColumnHeaders } from "@/hooks/useColumnHeaders";
import { CustomColumn } from "@/hooks/useCustomColumns";
import { Category } from "@/hooks/useCategories";
import { useI18n } from "@/hooks/useI18n";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "KRW", "CNY", "CAD", "AUD", "CHF", "INR", "BRL", "MXN"];
const VALID_TYPES = ["income", "expense"];

interface Props {
  transactions: Transaction[];
  headers: ColumnHeaders;
  customColumns: CustomColumn[];
  isViewer?: boolean;
  categories?: Category[];
  projectCurrency?: string;
  onImport?: (txs: Array<{
    type: "income" | "expense";
    amount: number;
    category: string;
    description?: string;
    transaction_date?: string;
    currency?: string;
  }>) => Promise<void>;
}

// --- Export helpers ---

const formatAmount = (tx: Transaction) =>
  `${tx.type === "income" ? "" : "-"}${Number(tx.amount).toFixed(2)}`;

const formatDate = (tx: Transaction) =>
  format(parseISO(tx.transaction_date), "yyyy-MM-dd");

const downloadFile = (content: string, filename: string, mime: string, successMsg: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${successMsg} ${filename}`);
};

const getCustomVal = (tx: Transaction, col: CustomColumn) => {
  const val = tx.custom_values?.[col.name];
  if (val == null) return "";
  return col.column_type === "numeric" ? Number(val).toFixed(2) : String(val);
};

const exportCSV = (transactions: Transaction[], h: ColumnHeaders, cols: CustomColumn[], msg: string) => {
  const colHeaders = cols.map((c) => c.name).join(",");
  const header = `${h.date},${h.type},${h.category},${h.description},${h.amount}${cols.length ? "," + colHeaders : ""}`;
  const rows = transactions.map((tx) => {
    const base = `${formatDate(tx)},${tx.type},"${tx.category}","${tx.description || ""}",${formatAmount(tx)}`;
    const custom = cols.map((c) => `"${getCustomVal(tx, c)}"`).join(",");
    return cols.length ? `${base},${custom}` : base;
  });
  downloadFile([header, ...rows].join("\n"), "transactions.csv", "text/csv", msg);
};

const exportXLS = (transactions: Transaction[], h: ColumnHeaders, cols: CustomColumn[], msg: string) => {
  const colTh = cols.map((c) => `<th>${c.name}</th>`).join("");
  const header = `<tr><th>${h.date}</th><th>${h.type}</th><th>${h.category}</th><th>${h.description}</th><th>${h.amount}</th>${colTh}</tr>`;
  const rows = transactions.map((tx) => {
    const colTd = cols.map((c) => `<td>${getCustomVal(tx, c)}</td>`).join("");
    return `<tr><td>${formatDate(tx)}</td><td>${tx.type}</td><td>${tx.category}</td><td>${tx.description || ""}</td><td>${formatAmount(tx)}</td>${colTd}</tr>`;
  }).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${header}${rows}</table></body></html>`;
  downloadFile(html, "transactions.xls", "application/vnd.ms-excel", msg);
};

const exportMarkdown = (transactions: Transaction[], h: ColumnHeaders, cols: CustomColumn[], msg: string) => {
  const colH = cols.map((c) => ` ${c.name} |`).join("");
  const header = `| ${h.date} | ${h.type} | ${h.category} | ${h.description} | ${h.amount} |${colH}`;
  const colSep = cols.map(() => " ---: |").join("");
  const sep = `| --- | --- | --- | --- | ---: |${colSep}`;
  const rows = transactions.map((tx) => {
    const colVals = cols.map((c) => ` ${getCustomVal(tx, c) || "-"} |`).join("");
    return `| ${formatDate(tx)} | ${tx.type} | ${tx.category} | ${tx.description || "-"} | ${formatAmount(tx)} |${colVals}`;
  });
  downloadFile([header, sep, ...rows].join("\n"), "transactions.md", "text/markdown", msg);
};

// --- CSV Import helpers ---

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

interface ImportRow { line: number; type: string; amount: string; category: string; description: string; date: string; currency: string; }
interface ValidationResult { row: ImportRow; errors: string[]; valid: boolean; parsed?: { type: "income" | "expense"; amount: number; category: string; description?: string; transaction_date?: string; currency?: string; }; }

function validateRow(row: ImportRow, categories: Category[], projectCurrency: string, t: (k: string) => string): ValidationResult {
  const errors: string[] = [];
  const typeLower = row.type.toLowerCase();
  if (!VALID_TYPES.includes(typeLower)) errors.push(t("import.errType"));
  const amount = Number(row.amount);
  if (!row.amount || isNaN(amount) || amount <= 0) errors.push(t("import.errAmount"));
  const category = row.category || "General";
  const catNames = categories.map((c) => c.name.toLowerCase());
  if (row.category && !catNames.includes(row.category.toLowerCase())) errors.push(t("import.errCategory").replace("{v}", row.category));
  let dateStr = row.date || new Date().toISOString().split("T")[0];
  if (row.date) { const d = new Date(row.date); if (isNaN(d.getTime())) { errors.push(t("import.errDate")); dateStr = new Date().toISOString().split("T")[0]; } else { dateStr = d.toISOString().split("T")[0]; } }
  const currency = row.currency?.toUpperCase() || projectCurrency;
  if (row.currency && !CURRENCIES.includes(currency)) errors.push(t("import.errCurrency").replace("{v}", row.currency));
  const valid = errors.length === 0;
  const matchedCategory = categories.find((c) => c.name.toLowerCase() === category.toLowerCase())?.name || category;
  return { row, errors, valid, parsed: valid ? { type: typeLower as "income" | "expense", amount, category: matchedCategory, description: row.description || undefined, transaction_date: dateStr, currency: CURRENCIES.includes(currency) ? currency : projectCurrency } : undefined };
}

// --- Component ---

const ExportTransactions = ({ transactions, headers, customColumns, isViewer, categories, projectCurrency, onImport }: Props) => {
  const { t } = useI18n();
  const [importOpen, setImportOpen] = useState(false);
  const [results, setResults] = useState<ValidationResult[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const visibleCols = isViewer ? customColumns.filter((c) => !c.masked) : customColumns;
  const msg = t("export.success");
  const canImport = !isViewer && onImport && categories && projectCurrency;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !categories || !projectCurrency) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { toast.error(t("import.noData")); return; }
      const headerCols = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
      const colMap = {
        type: headerCols.findIndex((h) => ["type", "유형"].includes(h)),
        amount: headerCols.findIndex((h) => ["amount", "금액"].includes(h)),
        category: headerCols.findIndex((h) => ["category", "카테고리"].includes(h)),
        description: headerCols.findIndex((h) => ["description", "설명", "memo", "메모"].includes(h)),
        date: headerCols.findIndex((h) => ["date", "날짜", "transaction_date"].includes(h)),
        currency: headerCols.findIndex((h) => ["currency", "통화"].includes(h)),
      };
      if (colMap.type === -1 || colMap.amount === -1) { toast.error(t("import.missingColumns")); return; }
      const rows: ImportRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        rows.push({ line: i + 1, type: (cols[colMap.type] || "").trim(), amount: (cols[colMap.amount] || "").trim(), category: colMap.category >= 0 ? (cols[colMap.category] || "").trim() : "", description: colMap.description >= 0 ? (cols[colMap.description] || "").trim() : "", date: colMap.date >= 0 ? (cols[colMap.date] || "").trim() : "", currency: colMap.currency >= 0 ? (cols[colMap.currency] || "").trim() : "" });
      }
      setResults(rows.map((r) => validateRow(r, categories!, projectCurrency!, t)));
      setImportOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const validCount = results?.filter((r) => r.valid).length || 0;
  const failedCount = results?.filter((r) => !r.valid).length || 0;

  const handleImport = async () => {
    if (!results || !onImport) return;
    const valid = results.filter((r) => r.valid && r.parsed).map((r) => r.parsed!);
    if (valid.length === 0) return;
    setImporting(true);
    await onImport(valid);
    setImporting(false);
    toast.success(t("import.success").replace("{n}", String(valid.length)));
    setResults(null); setFileName(""); setImportOpen(false);
  };

  const handleImportClose = (v: boolean) => {
    setImportOpen(v);
    if (!v) { setResults(null); setFileName(""); }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {transactions.length > 0 && (
            <>
              <DropdownMenuItem onClick={() => exportCSV(transactions, headers, visibleCols, msg)}>
                {t("export.csv")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportXLS(transactions, headers, visibleCols, msg)}>
                {t("export.xls")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportMarkdown(transactions, headers, visibleCols, msg)}>
                {t("export.markdown")}
              </DropdownMenuItem>
            </>
          )}
          {canImport && (
            <>
              {transactions.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {t("import.title")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Import results sheet */}
      <Sheet open={importOpen} onOpenChange={handleImportClose}>
        <SheetContent side="bottom" className="rounded-t-3xl bg-card border-border/50 px-6 pb-8 max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground">{t("import.title")}</SheetTitle>
          </SheetHeader>
          {results && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{fileName}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleImportClose(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
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
              {failedCount > 0 && (
                <div className="rounded-lg border border-expense/20 bg-expense/5 p-3 space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-[10px] font-medium text-expense">{t("import.failedEntries")}</p>
                  {results.filter((r) => !r.valid).map((r, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground">{t("import.line")} {r.row.line}:</span>{" "}
                      {r.errors.join("; ")}
                    </div>
                  ))}
                </div>
              )}
              <Button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="w-full gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity h-12"
              >
                {importing ? t("import.importing") : t("import.importBtn").replace("{n}", String(validCount))}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default ExportTransactions;
