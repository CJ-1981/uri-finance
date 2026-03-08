import { Transaction } from "@/hooks/useTransactions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ColumnHeaders } from "@/hooks/useColumnHeaders";
import { CustomColumn } from "@/hooks/useCustomColumns";

interface Props {
  transactions: Transaction[];
  headers: ColumnHeaders;
  customColumns: CustomColumn[];
}

const formatAmount = (tx: Transaction) =>
  `${tx.type === "income" ? "" : "-"}${Number(tx.amount).toFixed(2)}`;

const formatDate = (tx: Transaction) =>
  format(parseISO(tx.transaction_date), "yyyy-MM-dd");

const downloadFile = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported as ${filename}`);
};

const getCustomVal = (tx: Transaction, colName: string) => {
  const val = tx.custom_values?.[colName];
  return val != null ? Number(val).toFixed(2) : "";
};

const exportCSV = (transactions: Transaction[], h: ColumnHeaders, cols: CustomColumn[]) => {
  const colHeaders = cols.map((c) => c.name).join(",");
  const header = `${h.date},${h.type},${h.category},${h.description},${h.amount}${cols.length ? "," + colHeaders : ""}`;
  const rows = transactions.map(
    (tx) => {
      const base = `${formatDate(tx)},${tx.type},"${tx.category}","${tx.description || ""}",${formatAmount(tx)}`;
      const custom = cols.map((c) => getCustomVal(tx, c.name)).join(",");
      return cols.length ? `${base},${custom}` : base;
    }
  );
  downloadFile([header, ...rows].join("\n"), "transactions.csv", "text/csv");
};

const exportXLS = (transactions: Transaction[], h: ColumnHeaders, cols: CustomColumn[]) => {
  const colTh = cols.map((c) => `<th>${c.name}</th>`).join("");
  const header = `<tr><th>${h.date}</th><th>${h.type}</th><th>${h.category}</th><th>${h.description}</th><th>${h.amount}</th>${colTh}</tr>`;
  const rows = transactions
    .map((tx) => {
      const colTd = cols.map((c) => `<td>${getCustomVal(tx, c.name)}</td>`).join("");
      return `<tr><td>${formatDate(tx)}</td><td>${tx.type}</td><td>${tx.category}</td><td>${tx.description || ""}</td><td>${formatAmount(tx)}</td>${colTd}</tr>`;
    })
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${header}${rows}</table></body></html>`;
  downloadFile(html, "transactions.xls", "application/vnd.ms-excel");
};

const exportMarkdown = (transactions: Transaction[], h: ColumnHeaders, cols: CustomColumn[]) => {
  const colH = cols.map((c) => ` ${c.name} |`).join("");
  const header = `| ${h.date} | ${h.type} | ${h.category} | ${h.description} | ${h.amount} |${colH}`;
  const colSep = cols.map(() => " ---: |").join("");
  const sep = `| --- | --- | --- | --- | ---: |${colSep}`;
  const rows = transactions.map((tx) => {
    const colVals = cols.map((c) => ` ${getCustomVal(tx, c.name) || "-"} |`).join("");
    return `| ${formatDate(tx)} | ${tx.type} | ${tx.category} | ${tx.description || "-"} | ${formatAmount(tx)} |${colVals}`;
  });
  downloadFile([header, sep, ...rows].join("\n"), "transactions.md", "text/markdown");
};

const ExportTransactions = ({ transactions, headers, customColumns }: Props) => {
  if (transactions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportCSV(transactions, headers, customColumns)}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportXLS(transactions, headers, customColumns)}>
          Export as XLS
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportMarkdown(transactions, headers, customColumns)}>
          Export as Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportTransactions;
