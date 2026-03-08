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

interface Props {
  transactions: Transaction[];
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

const exportCSV = (transactions: Transaction[]) => {
  const header = "Date,Type,Category,Description,Amount";
  const rows = transactions.map(
    (tx) =>
      `${formatDate(tx)},${tx.type},"${tx.category}","${tx.description || ""}",${formatAmount(tx)}`
  );
  downloadFile([header, ...rows].join("\n"), "transactions.csv", "text/csv");
};

const exportXLS = (transactions: Transaction[]) => {
  const header = "<tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th></tr>";
  const rows = transactions
    .map(
      (tx) =>
        `<tr><td>${formatDate(tx)}</td><td>${tx.type}</td><td>${tx.category}</td><td>${tx.description || ""}</td><td>${formatAmount(tx)}</td></tr>`
    )
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${header}${rows}</table></body></html>`;
  downloadFile(html, "transactions.xls", "application/vnd.ms-excel");
};

const exportMarkdown = (transactions: Transaction[]) => {
  const header = "| Date | Type | Category | Description | Amount |";
  const sep = "| --- | --- | --- | --- | ---: |";
  const rows = transactions.map(
    (tx) =>
      `| ${formatDate(tx)} | ${tx.type} | ${tx.category} | ${tx.description || "-"} | ${formatAmount(tx)} |`
  );
  downloadFile([header, sep, ...rows].join("\n"), "transactions.md", "text/markdown");
};

const ExportTransactions = ({ transactions }: Props) => {
  if (transactions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportCSV(transactions)}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportXLS(transactions)}>
          Export as XLS
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportMarkdown(transactions)}>
          Export as Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportTransactions;
