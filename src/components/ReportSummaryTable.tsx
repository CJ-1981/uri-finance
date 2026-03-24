// SPEC-REPORT-001: ReportSummaryTable component – spreadsheet-like category breakdown
import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/hooks/useI18n";
import { ReportSummaryByCurrency } from "@/hooks/useReportData";

interface Props {
  summaryData: ReportSummaryByCurrency[];
  projectCurrency: string;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function NetCell({ value }: { value: number }) {
  const color =
    value > 0
      ? "text-income"
      : value < 0
      ? "text-expense"
      : "text-muted-foreground";
  return (
    <span className={`font-medium ${color}`}>
      {value >= 0 ? "+" : ""}
      {formatAmount(value)}
    </span>
  );
}

export default function ReportSummaryTable({ summaryData, projectCurrency }: Props) {
  const { t } = useI18n();

  // State for row comments - keyed by currency-categoryName
  const [comments, setComments] = useState<Record<string, string>>(() => {
    // Load saved comments from localStorage
    const saved = localStorage.getItem("report-summary-comments");
    return saved ? JSON.parse(saved) : {};
  });

  // Save comments to localStorage whenever they change
  const updateComment = (key: string, value: string) => {
    const updated = { ...comments, [key]: value };
    setComments(updated);
    localStorage.setItem("report-summary-comments", JSON.stringify(updated));
  };

  const getCommentKey = (currency: string, categoryName: string) => `${currency}-${categoryName}`;

  const hasData = useMemo(
    () => summaryData.some((g) => g.rows.length > 0),
    [summaryData]
  );

  if (!hasData) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {t("report.noData")}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden" data-report-summary="true">
      <div className="px-4 pt-4 pb-2 border-b border-border/30">
        <h3 className="text-sm font-semibold text-foreground">
          {t("report.summaryTitle")}
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {t("report.summaryDesc")}
        </p>
      </div>

      {summaryData.map((group) => (
        <div key={group.currency}>
          {/* Currency group header (only shown when multiple currencies) */}
          {summaryData.length > 1 && (
            <div className="px-4 py-2 bg-muted/20 border-b border-border/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.currency}
              </span>
            </div>
          )}

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold text-muted-foreground w-16 py-2.5">
                    {t("report.code")}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground min-w-[120px] py-2.5">
                    {t("report.category")}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground text-right py-2.5">
                    {t("report.income")} ({group.currency})
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground text-right py-2.5">
                    {t("report.expense")} ({group.currency})
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground text-right py-2.5">
                    {t("report.net")} ({group.currency})
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground text-right py-2.5 w-14">
                    {t("report.percent")}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground py-2.5 min-w-[150px]">
                    {t("report.comment")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.rows.map((row) => (
                  <TableRow
                    key={`${row.currency}-${row.categoryName}`}
                    className="border-border/20 hover:bg-muted/10 transition-colors"
                  >
                    <TableCell className="font-mono text-[11px] text-muted-foreground py-2">
                      {row.categoryCode || (
                        <span className="opacity-30">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-[12px] font-medium text-foreground">
                        {row.categoryEmoji && (
                          <span className="mr-1">{row.categoryEmoji}</span>
                        )}
                        {row.categoryName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <span className="text-[12px] text-income font-medium">
                        {row.income > 0 ? formatAmount(row.income) : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <span className="text-[12px] text-expense font-medium">
                        {row.expense > 0 ? formatAmount(row.expense) : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-2 text-[12px]">
                      <NetCell value={row.net} />
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <span className="text-[11px] text-muted-foreground">
                        {row.percentage.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      <input
                        type="text"
                        value={comments[getCommentKey(row.currency, row.categoryName)] || ""}
                        onChange={(e) => updateComment(getCommentKey(row.currency, row.categoryName), e.target.value)}
                        placeholder={t("report.addComment") || "Add comment..."}
                        className="w-full px-2 py-1 text-[11px] border border-border/30 rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                      />
                    </TableCell>
                  </TableRow>
                ))}

                {/* Totals row */}
                <TableRow className="border-t border-border/40 bg-muted/10 hover:bg-muted/20">
                  <TableCell className="py-2" />
                  <TableCell className="py-2">
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">
                      {t("report.total")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <span className="text-[12px] font-bold text-income">
                      {formatAmount(group.totalIncome)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <span className="text-[12px] font-bold text-expense">
                      {formatAmount(group.totalExpense)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-2 text-[12px]">
                    <NetCell value={group.totalNet} />
                  </TableCell>
                  <TableCell className="py-2" />
                  <TableCell className="py-2" />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
