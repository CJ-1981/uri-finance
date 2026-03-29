import { useMemo, useState, useEffect, useCallback, Fragment } from "react";
import { Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Transaction } from "@/hooks/useTransactions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/useI18n";
import { ReportSummaryByCurrency } from "@/hooks/useReportData";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  summaryData: ReportSummaryByCurrency[];
  projectCurrency: string;
  onTransactionClick?: (tx: Transaction) => void;
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

export default function ReportSummaryTable({ summaryData, projectCurrency, onTransactionClick }: Props) {
  const { t, locale } = useI18n();

  // State for summary title and description
  const [summaryTitle, setSummaryTitle] = useState(() => 
    localStorage.getItem(`report-summary-title-${locale}`) || t("report.summaryTitle")
  );
  const [summaryDesc, setSummaryDesc] = useState(() => 
    localStorage.getItem(`report-summary-desc-${locale}`) || t("report.summaryDesc")
  );
  const [showDetails, setShowDetails] = useState(() => 
    localStorage.getItem("report-summary-show-details") === "true"
  );

  useEffect(() => {
    localStorage.setItem("report-summary-show-details", String(showDetails));
  }, [showDetails]);

  // Update when locale changes if not customized
  useEffect(() => {
    const savedTitle = localStorage.getItem(`report-summary-title-${locale}`);
    setSummaryTitle(savedTitle || t("report.summaryTitle"));
    
    const savedDesc = localStorage.getItem(`report-summary-desc-${locale}`);
    setSummaryDesc(savedDesc || t("report.summaryDesc"));
  }, [locale, t]);

  const updateSummaryTitle = (val: string) => {
    setSummaryTitle(val);
    localStorage.setItem(`report-summary-title-${locale}`, val);
  };

  const updateSummaryDesc = (val: string) => {
    setSummaryDesc(val);
    localStorage.setItem(`report-summary-desc-${locale}`, val);
  };

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

  // Clear comments dialog state
  const [showClearDialog, setShowClearDialog] = useState(false);

  const handleClearComments = () => {
    setComments({});
    localStorage.removeItem("report-summary-comments");
    
    // Also reset title and description customizations for current locale
    localStorage.removeItem(`report-summary-title-${locale}`);
    localStorage.removeItem(`report-summary-desc-${locale}`);
    setSummaryTitle(t("report.summaryTitle"));
    setSummaryDesc(t("report.summaryDesc"));
    
    setShowClearDialog(false);
  };

  const hasComments = Object.keys(comments).some(key => comments[key].trim() !== "");
  const hasCustomHeader = !!localStorage.getItem(`report-summary-title-${locale}`) || !!localStorage.getItem(`report-summary-desc-${locale}`);
  const canReset = hasComments || hasCustomHeader;

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
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-4">
            <input
              value={summaryTitle}
              onChange={(e) => updateSummaryTitle(e.target.value)}
              className="w-full text-sm font-semibold text-foreground bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/30 rounded px-1 -ml-1"
              placeholder={t("report.summaryTitle")}
            />
            <textarea
              value={summaryDesc}
              onChange={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
                updateSummaryDesc(e.target.value);
              }}
              onFocus={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              rows={1}
              style={{ overflow: "hidden", resize: "none" }}
              className="w-full text-[11px] text-muted-foreground mt-0.5 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/30 rounded px-1 -ml-1 block leading-tight min-h-[1.5em]"
              placeholder={t("report.summaryDesc")}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-full border border-border/20">
              <Switch
                id="show-details"
                checked={showDetails}
                onCheckedChange={setShowDetails}
                className="h-4 w-8"
              />
              <Label htmlFor="show-details" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer">
                {t("report.showDetails")}
              </Label>
            </div>
            {canReset && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearDialog(true)}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive whitespace-nowrap"
                data-html2canvas-ignore="true"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                {t("report.clearComments")}
              </Button>
            )}
          </div>
        </div>
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
                  <TableHead className="text-[11px] font-semibold text-muted-foreground min-w-[150px] py-2.5">
                    {t("report.description")}
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
                  <Fragment key={`${row.currency}-${row.categoryName}`}>
                    <TableRow
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
                      <TableCell className="py-2">
                        <span className="text-[11px] text-muted-foreground leading-snug">
                          {row.descriptions.join(", ") || <span className="opacity-30">—</span>}
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
                        <textarea
                          value={comments[getCommentKey(row.currency, row.categoryName)] || ""}
                          onChange={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                            updateComment(getCommentKey(row.currency, row.categoryName), e.target.value);
                          }}
                          onFocus={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          placeholder={t("report.addComment") || "Add comment..."}
                          rows={1}
                          style={{ overflow: "hidden", resize: "none" }}
                          className="w-full px-2 py-1.5 min-h-[28px] text-[11px] border border-border/30 rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50 align-top"
                        />
                      </TableCell>
                    </TableRow>
                    {showDetails && row.transactions.map((tx) => (
                      <TableRow
                        key={tx.id}
                        className={`border-none bg-muted/5 transition-colors ${onTransactionClick ? "cursor-pointer hover:bg-muted/15" : "hover:bg-muted/10"}`}
                        onClick={() => onTransactionClick?.(tx)}
                      >
                        <TableCell className="py-1 font-mono text-[9px] text-muted-foreground/50">
                          {tx.transaction_date.slice(5)}
                        </TableCell>
                        <TableCell className="py-1" colSpan={2}>
                          <span className="text-[10px] text-muted-foreground leading-tight italic ml-4 block">
                            {tx.description || <span className="opacity-30">—</span>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-1">
                          <span className="text-[10px] text-income/70">
                            {tx.type === "income" ? formatAmount(Number(tx.amount)) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-1">
                          <span className="text-[10px] text-expense/70">
                            {tx.type === "expense" ? formatAmount(Number(tx.amount)) : "—"}
                          </span>
                        </TableCell>
                        <TableCell colSpan={3} />
                      </TableRow>
                    ))}
                  </Fragment>
                ))}

                {/* Totals row */}
                <TableRow className="border-t border-border/40 bg-muted/10 hover:bg-muted/20">
                  <TableCell className="py-2" />
                  <TableCell className="py-2">
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">
                      {t("report.total")}
                    </span>
                  </TableCell>
                  <TableCell className="py-2" />
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

      {/* Clear Comments Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("report.clearCommentsTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("report.clearCommentsDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("tx.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearComments} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("report.clearCommentsConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
