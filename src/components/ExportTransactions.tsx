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
import { Download, Import, FileSpreadsheet, FileText, AlertTriangle, CheckCircle2, X } from "lucide-react";
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

const escapeXML = (val: any) => {
  if (val == null) return "";
  return String(val).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case "\"": return "&quot;";
      default: return c;
    }
  });
};

const formatAmount = (tx: Transaction) =>
  `${tx.type === "income" ? "" : "-"}${Number(tx.amount).toFixed(2)}`;

const formatDate = (tx: Transaction) =>
  format(parseISO(tx.transaction_date), "yyyy-MM-dd");

const getCategoryCode = (tx: Transaction, categories?: Category[]) => {
  const cat = categories?.find(c => c.name === tx.category);
  return cat?.code || "";
};

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
  const colNames = cols.map((c) => c.name);
  const header = `<Row>
    <Cell><Data ss:Type="String">${escapeXML(h.date)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXML(h.type)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXML(h.category)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXML(h.description)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXML(h.amount)}</Data></Cell>
    ${colNames.map((name) => `<Cell><Data ss:Type="String">${escapeXML(name)}</Data></Cell>`).join("")}
  </Row>`;

  const rows = transactions.map((tx) => {
    const customCells = cols.map((c) => {
      const val = getCustomVal(tx, c);
      const type = c.column_type === "numeric" ? "Number" : "String";
      return `<Cell><Data ss:Type="${type}">${escapeXML(val)}</Data></Cell>`;
    }).join("");
    return `<Row>
      <Cell><Data ss:Type="String">${formatDate(tx)}</Data></Cell>
      <Cell><Data ss:Type="String">${tx.type}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXML(tx.category)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXML(tx.description || "")}</Data></Cell>
      <Cell><Data ss:Type="Number">${Number(tx.amount)}</Data></Cell>
      ${customCells}
    </Row>`;
  }).join("\n");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Transactions">
  <Table>
   ${header}
   ${rows}
  </Table>
 </Worksheet>
</Workbook>`;
  downloadFile(xml, "transactions.xls", "application/vnd.ms-excel", msg);
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

function parseMarkdownLine(line: string): string[] {
  const parts = line.split("|").map(p => p.trim());
  // MD lines usually start and end with | so they have empty strings at index 0 and length-1
  if (parts[0] === "" && parts.length > 1) parts.shift();
  if (parts[parts.length - 1] === "" && parts.length > 1) parts.pop();
  return parts;
}

function parseXLS(text: string): string[][] {
  const parser = new DOMParser();
  // Try SpreadsheetML (XML) first
  const xmlDoc = parser.parseFromString(text, "text/xml");
  const xmlRows = Array.from(xmlDoc.querySelectorAll("Row"));
  if (xmlRows.length > 0) {
    return xmlRows.map((row) =>
      Array.from(row.querySelectorAll("Cell Data")).map((cell) => cell.textContent?.trim() || "")
    ).filter((r) => r.length > 0);
  }
  // Fallback to HTML table (old format)
  const htmlDoc = parser.parseFromString(text, "text/html");
  const rows = Array.from(htmlDoc.querySelectorAll("tr"));
  return rows.map((row) =>
    Array.from(row.querySelectorAll("th, td")).map((cell) => cell.textContent?.trim() || "")
  ).filter((r) => r.length > 0);
}

interface ImportRow { line: number; type: string; amount: string; category: string; description: string; date: string; currency: string; }
interface ValidationResult { row: ImportRow; errors: string[]; valid: boolean; parsed?: { type: "income" | "expense"; amount: number; category: string; description?: string; transaction_date?: string; currency?: string; }; }

function validateRow(row: ImportRow, categories: Category[], projectCurrency: string, t: (k: string) => string): ValidationResult {
  const errors: string[] = [];
  let typeLower = row.type.toLowerCase();
  let amount = Number(row.amount);

  // If amount is negative, treat it as an expense and use absolute value
  if (!isNaN(amount) && amount < 0) {
    amount = Math.abs(amount);
    // If type was not specified or was 'income', default to 'expense' for negative values
    if (!typeLower || typeLower === "income") {
      typeLower = "expense";
    }
  }

  if (!VALID_TYPES.includes(typeLower)) errors.push(t("import.errType"));
  if (!row.amount || isNaN(amount) || amount === 0) errors.push(t("import.errAmount"));
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
    const name = file.name.toLowerCase();
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      let rawData: string[][] = [];
      
      if (name.endsWith(".xls")) {
        rawData = parseXLS(text);
      } else if (name.endsWith(".md")) {
        const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.includes("---"));
        rawData = lines.map(parseMarkdownLine);
      } else if (name.endsWith(".csv")) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        rawData = lines.map(parseCSVLine);
      } else {
        toast.error(t("import.invalidFormat") || "Invalid file format");
        return;
      }
      
      if (rawData.length < 2) { 
        toast.error(t("import.noData")); 
        return; 
      }

      const headerCols = rawData[0].map((h) => h.toLowerCase().trim());
      const hl = { 
        date: headers.date.toLowerCase(), 
        type: headers.type.toLowerCase(), 
        category: headers.category.toLowerCase(), 
        description: headers.description.toLowerCase(), 
        amount: headers.amount.toLowerCase() 
      };
      
      const colMap = {
        type: headerCols.findIndex((h) => ["type", "유형", hl.type].includes(h)),
        amount: headerCols.findIndex((h) => ["amount", "금액", hl.amount].includes(h)),
        category: headerCols.findIndex((h) => ["category", "카테고리", hl.category].includes(h)),
        description: headerCols.findIndex((h) => ["description", "설명", "memo", "메모", hl.description].includes(h)),
        date: headerCols.findIndex((h) => ["date", "날짜", "transaction_date", hl.date].includes(h)),
        currency: headerCols.findIndex((h) => ["currency", "통화"].includes(h)),
      };
      
      if (colMap.type === -1 || colMap.amount === -1) { 
        toast.error(t("import.missingColumns")); 
        return; 
      }

      const rows: ImportRow[] = [];
      for (let i = 1; i < rawData.length; i++) {
        const cols = rawData[i];
        if (cols.length < 2) continue;
        rows.push({ 
          line: i + 1, 
          type: (cols[colMap.type] || "").trim(), 
          amount: (cols[colMap.amount] || "").trim(), 
          category: colMap.category >= 0 ? (cols[colMap.category] || "").trim() : "", 
          description: colMap.description >= 0 ? (cols[colMap.description] || "").trim() : "", 
          date: colMap.date >= 0 ? (cols[colMap.date] || "").trim() : "", 
          currency: colMap.currency >= 0 ? (cols[colMap.currency] || "").trim() : "" 
        });
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
      <input ref={fileRef} type="file" accept=".csv,.xls,.md" className="hidden" onChange={handleFile} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Download className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {transactions.length > 0 && (
            <>
              <DropdownMenuItem onClick={() => exportCSV(transactions, headers, visibleCols, msg)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t("export.csv")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportXLS(transactions, headers, visibleCols, msg)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t("export.xls")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportMarkdown(transactions, headers, visibleCols, msg)}>
                <FileText className="h-4 w-4 mr-2" />
                {t("export.markdown")}
              </DropdownMenuItem>
            </>
          )}
          {canImport && (
            <>
              {transactions.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                <Import className="h-4 w-4 mr-2" />
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
