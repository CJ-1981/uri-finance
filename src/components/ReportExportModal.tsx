// SPEC-REPORT-001: ReportExportModal - export configuration modal
import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FileText,
  FileDown,
  Loader2,
  BarChart3,
  TrendingUp,
  PieChart,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";
import { ReportSummaryByCurrency } from "@/hooks/useReportData";
import { captureCharts, captureElementAtWidth, CAPTURE_WIDTH } from "@/lib/chartCapture";
import { generatePdfReport } from "@/lib/pdfGenerator";
import { generateMarkdownReport } from "@/lib/markdownGenerator";
import { PeriodKey, DateRange } from "@/components/PeriodSelector";
import { format } from "date-fns";

interface ChartSelection {
  pie: boolean;
  trend: boolean;
  cumulative: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summaryData: ReportSummaryByCurrency[];
  projectName: string;
  period: PeriodKey;
  customRange: DateRange;
  hasData: boolean;
}

const CHART_SELECTORS: Record<"pie" | "trend" | "cumulative", string> = {
  pie: "[data-chart-type='pie']",
  trend: "[data-chart-type='trend']",
  cumulative: "[data-chart-type='cumulative']",
};

function getPeriodLabel(period: PeriodKey, customRange: DateRange, t: (k: string) => string): string {
  if (period === "custom" && customRange.from) {
    const from = format(customRange.from, "yyyy-MM-dd");
    const to = customRange.to ? format(customRange.to, "yyyy-MM-dd") : from;
    return `${from} to ${to}`;
  }
  return t(`period.${period}`);
}

function getReportFilename(
  format: "pdf" | "markdown",
  projectName: string,
  period: PeriodKey,
  customRange: DateRange
): string {
  const safe = projectName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const now = new Date();
  const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const ext = format === "pdf" ? "pdf" : "md";
  return `report-${safe}-${datePart}.${ext}`;
}

export default function ReportExportModal({
  open,
  onOpenChange,
  summaryData,
  projectName,
  period,
  customRange,
  hasData,
}: Props) {
  const { t } = useI18n();
  const [exportFormat, setExportFormat] = useState<"pdf" | "markdown">("pdf");
  const [chartSelection, setChartSelection] = useState<ChartSelection>({
    pie: true,
    trend: true,
    cumulative: true,
  });
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Announce progress to screen readers
  useEffect(() => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = progress;
    }
  }, [progress]);

  const anyChartSelected = Object.values(chartSelection).some(Boolean);

  const toggleChart = (key: keyof ChartSelection) => {
    setChartSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => setChartSelection({ pie: true, trend: true, cumulative: true });
  const deselectAll = () => setChartSelection({ pie: false, trend: false, cumulative: false });

  const handleExport = useCallback(async () => {
    if (!anyChartSelected && summaryData.length === 0) return;
    setGenerating(true);

    try {
      const periodLabel = getPeriodLabel(period, customRange, t);
      const generatedAt = new Date();

      // Step 1: Capture charts
      setProgress(t("report.progressCapturing"));
      const chartCaptures = await captureCharts(chartSelection, CHART_SELECTORS);

      // Step 2: Generate report
      setProgress(
        exportFormat === "pdf"
          ? t("report.progressGeneratingPdf")
          : t("report.progressGeneratingMd")
      );

      const filename = getReportFilename(exportFormat, projectName, period, customRange);

      if (exportFormat === "pdf") {
        // Capture the rendered summary table at consistent width for PDF export
        let summaryImageData: string | null = null;
        let summaryImageWidth = 0;
        let summaryImageHeight = 0;
        const summaryEl = document.querySelector<HTMLElement>("[data-report-summary='true']");
        if (summaryEl) {
          // Replace input elements with spans for better text rendering during capture
          const replacements: Array<{
            parent: HTMLElement;
            input: HTMLInputElement;
            span: HTMLSpanElement;
          }> = [];

          const commentInputs = summaryEl.querySelectorAll("input[type='text']");
          commentInputs.forEach((input) => {
            const htmlInput = input as HTMLInputElement;
            const parent = htmlInput.parentElement;
            if (!parent) return;

            // Create span to replace input
            const span = document.createElement("span");
            span.className = htmlInput.className;
            span.textContent = htmlInput.value || "";
            span.style.cssText = `
              display: inline-block;
              width: 200px;
              min-width: 200px;
              padding: 4px 8px;
              font-size: 11px;
              line-height: 1.5;
              word-wrap: break-word;
              white-space: pre-wrap;
            `;

            // Store for restoration
            replacements.push({ parent: parent as HTMLElement, input: htmlInput, span });
            // Replace input with span
            parent.replaceChild(span, htmlInput);
          });

          // Also expand the comment column header
          const commentHeader = summaryEl.querySelector("th:last-child");
          const headerOriginalMinWidth = commentHeader ? (commentHeader as HTMLElement).style.minWidth : "";
          const headerOriginalWidth = commentHeader ? (commentHeader as HTMLElement).style.width : "";
          if (commentHeader) {
            (commentHeader as HTMLElement).style.minWidth = "200px";
            (commentHeader as HTMLElement).style.width = "200px";
          }

          // Use wider capture width for summary table to accommodate comment column
          const summaryCapture = await captureElementAtWidth(summaryEl, 900, "summary-table", false);
          if (summaryCapture) {
            summaryImageData = summaryCapture.imageData;
            summaryImageWidth = summaryCapture.width;
            summaryImageHeight = summaryCapture.height;
          }

          // Restore original input elements
          replacements.forEach(({ parent, input, span }) => {
            parent.replaceChild(input, span);
          });

          if (commentHeader) {
            (commentHeader as HTMLElement).style.minWidth = headerOriginalMinWidth;
            (commentHeader as HTMLElement).style.width = headerOriginalWidth;
          }
        }

        const blob = await generatePdfReport({
          projectName,
          periodLabel,
          summaryImageData,
          summaryImageWidth,
          summaryImageHeight,
          chartCaptures,
          generatedAt,
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const content = generateMarkdownReport({
          projectName,
          periodLabel,
          summaryData,
          chartCaptures,
          generatedAt,
        });
        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }

      setProgress(t("report.progressDone"));
      toast.success(`${t("report.successMsg")} ${filename}`);
      onOpenChange(false);
    } catch (err) {
      console.error("[ReportExportModal] export failed:", err);
      const msg = t("report.exportFailed");
      setProgress(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
      setProgress("");
    }
  }, [
    anyChartSelected,
    chartSelection,
    exportFormat,
    projectName,
    period,
    customRange,
    summaryData,
    t,
    onOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md bg-card border-border/50"
        aria-modal="true"
        aria-labelledby="report-export-modal-title"
      >
        {/* Screen reader live region for progress announcements */}
        <div
          ref={liveRegionRef}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />

        <DialogTitle id="report-export-modal-title" className="text-foreground text-base font-semibold">
          {t("report.exportTitle")}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t("report.exportDesc")}
        </DialogDescription>

        <div className="space-y-5 pt-1">
          {/* Format selection */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {t("report.formatLabel")}
            </p>
            <RadioGroup
              value={exportFormat}
              onValueChange={(v) => setExportFormat(v as "pdf" | "markdown")}
              className="flex gap-3"
            >
              <Label
                htmlFor="fmt-pdf"
                className={`flex flex-1 items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                  exportFormat === "pdf"
                    ? "border-primary bg-primary/5"
                    : "border-border/40 hover:border-border"
                }`}
              >
                <RadioGroupItem value="pdf" id="fmt-pdf" />
                <FileDown className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">PDF</span>
              </Label>
              <Label
                htmlFor="fmt-md"
                className={`flex flex-1 items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                  exportFormat === "markdown"
                    ? "border-primary bg-primary/5"
                    : "border-border/40 hover:border-border"
                }`}
              >
                <RadioGroupItem value="markdown" id="fmt-md" />
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Markdown</span>
              </Label>
            </RadioGroup>
          </div>

          {/* Chart selection */}
          <div
            role="group"
            aria-label={t("report.chartSelectionLabel")}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("report.chartsLabel")}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  <CheckSquare className="h-3 w-3" />
                  {t("report.selectAll")}
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:underline"
                >
                  <Square className="h-3 w-3" />
                  {t("report.deselectAll")}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {(
                [
                  {
                    key: "pie" as const,
                    label: t("report.chartPie"),
                    icon: PieChart,
                  },
                  {
                    key: "trend" as const,
                    label: t("report.chartTrend"),
                    icon: TrendingUp,
                  },
                  {
                    key: "cumulative" as const,
                    label: t("report.chartCumulative"),
                    icon: BarChart3,
                  },
                ]
              ).map(({ key, label, icon: Icon }) => (
                <label
                  key={key}
                  htmlFor={`chart-${key}`}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                    chartSelection[key]
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/30 hover:border-border"
                  }`}
                >
                  <Checkbox
                    id={`chart-${key}`}
                    checked={chartSelection[key]}
                    onCheckedChange={() => toggleChart(key)}
                  />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[12px] font-medium text-foreground">{label}</span>
                </label>
              ))}
            </div>

            {!anyChartSelected && (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                {t("report.noChartsHint")}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={generating}
              className="flex-1 border-border/40 text-sm"
            >
              {t("tx.cancel")}
            </Button>
            <Button
              onClick={handleExport}
              disabled={generating || !hasData}
              className="flex-1 gradient-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity text-sm"
            >
              {generating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  {progress || t("report.generating")}
                </>
              ) : (
                <>
                  <FileDown className="h-3.5 w-3.5 mr-2" />
                  {t("report.exportBtn")}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
