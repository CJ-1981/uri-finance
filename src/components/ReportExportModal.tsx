// SPEC-REPORT-001: ReportExportModal - export configuration modal
import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const allChartsSelected = Object.values(chartSelection).every(Boolean);

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
          // Replace input elements with divs for better text rendering during capture
          const replacements: Array<{
            parent: HTMLElement;
            input: HTMLInputElement | HTMLTextAreaElement;
            span: HTMLElement;
          }> = [];

          // Expand specific columns for better rendering in PDF
          const headers = summaryEl.querySelectorAll("th");
          const descHeader = headers[2] as HTMLElement; // Description column
          const commentHeader = summaryEl.querySelector("th:last-child") as HTMLElement; // Comment column

          const headerOriginals = new Map<HTMLElement, { minWidth: string; width: string }>();

          [descHeader, commentHeader].forEach(h => {
            if (h) {
              headerOriginals.set(h, { minWidth: h.style.minWidth, width: h.style.width });
              h.style.minWidth = "220px";
              h.style.width = "220px";
            }
          });

          const interactiveElements = summaryEl.querySelectorAll("input:not([type='checkbox']), textarea");
          interactiveElements.forEach((el) => {
            const htmlInput = el as HTMLInputElement | HTMLTextAreaElement;
            const parent = htmlInput.parentElement;
            if (!parent) return;

            const replacement = document.createElement("div");
            const val = htmlInput.value.trim();
            replacement.textContent = val || "";

            // Copy the className to preserve text styles (font-size, weight, etc.)
            replacement.className = htmlInput.className;

            // Ensure formatting is correct for SVG/Canvas capture
            replacement.style.cssText = `
              display: block;
              width: 100%;
              height: auto;
              min-height: auto;
              overflow: visible;
              white-space: pre-wrap;
              word-wrap: break-word;
              box-sizing: border-box;
              background: transparent;
              border: none;
              padding: ${htmlInput.tagName === "TEXTAREA" ? "4px 8px" : "1px 4px"};
            `;

            // Table specific styling for comments/text fields inside cells
            if (htmlInput.closest("td")) {
              replacement.style.minWidth = "200px";
              // Use computed font size to preserve the relative sizing (e.g. 9px vs 11px)
              const computedFontSize = window.getComputedStyle(htmlInput).fontSize;
              replacement.style.fontSize = computedFontSize || "11px";
              replacement.style.lineHeight = "1.3";
            } else {
              // For top summary title/desc
              replacement.style.fontSize = htmlInput.tagName === "TEXTAREA" ? "11px" : "14px";
              replacement.style.fontWeight = htmlInput.tagName === "TEXTAREA" ? "normal" : "600";
            }

            // Store for restoration
            replacements.push({ parent: parent as HTMLElement, input: htmlInput, span: replacement });
            // Replace input with replacement div
            parent.replaceChild(replacement, htmlInput);
          });

          // Use wider capture width for summary table to accommodate expanded columns
          const summaryCapture = await captureElementAtWidth(summaryEl, 1000, "summary-table", false);
          if (summaryCapture) {
            summaryImageData = summaryCapture.imageData;
            summaryImageWidth = summaryCapture.width;
            summaryImageHeight = summaryCapture.height;
          }

          // Restore original input elements
          replacements.forEach(({ parent, input, span }) => {
            parent.replaceChild(input, span);
          });

          // Restore original header styles
          headerOriginals.forEach((original, h) => {
            h.style.minWidth = original.minWidth;
            h.style.width = original.width;
          });
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
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();

        // SPEC-REPORT-001: Delay revocation for Safari compatibility
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      } else {
        const showDetails = localStorage.getItem("report-summary-show-details") === "true";
        const content = generateMarkdownReport({
          projectName,
          periodLabel,
          summaryData,
          chartCaptures,
          generatedAt,
          showDetails,
        });
        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();

        // SPEC-REPORT-001: Delay revocation for Safari compatibility
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
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
      <DialogContent className="sm:max-w-md bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-foreground text-base font-semibold">
            {t("report.exportTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("report.exportDesc")}
          </DialogDescription>
        </DialogHeader>

        {/* Screen reader live region for progress announcements */}
        <div
          ref={liveRegionRef}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />

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
                className={`flex flex-1 items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${exportFormat === "pdf"
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
                className={`flex flex-1 items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${exportFormat === "markdown"
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
            <div className="flex items-center gap-2 mb-2.5">
              <Checkbox
                id="master-chart-select"
                checked={allChartsSelected ? true : (!anyChartSelected ? false : "indeterminate")}
                onCheckedChange={(checked) => {
                  if (checked) selectAll();
                  else deselectAll();
                }}
              />
              <Label
                htmlFor="master-chart-select"
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer"
              >
                {t("report.chartsLabel")}
              </Label>
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
                  className={`flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors ${chartSelection[key]
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

            {/* {!anyChartSelected && (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                {t("report.noChartsHint")}
              </p>
            )} */}
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
