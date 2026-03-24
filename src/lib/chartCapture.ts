// SPEC-REPORT-001: Chart capture utility - captures Recharts chart containers as base64 images
// Fallback chain: html2canvas → placeholder

export type CaptureMethod = "html2canvas" | "placeholder";

export interface ChartCaptureResult {
  chartType: "pie" | "trend" | "cumulative";
  imageData: string; // base64 data URI
  width: number;
  height: number;
  captureMethod: CaptureMethod;
}

/**
 * Attempts to capture a DOM element as a base64 PNG image.
 * Falls back to placeholder on failure.
 */
async function captureElement(
  element: HTMLElement,
  label: string
): Promise<{ imageData: string; method: CaptureMethod }> {
  try {
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
    });
    return { imageData: canvas.toDataURL("image/png"), method: "html2canvas" };
  } catch (err) {
    console.warn(`[chartCapture] html2canvas failed for "${label}":`, err);
    return { imageData: createPlaceholder(label), method: "placeholder" };
  }
}

/**
 * Creates a simple placeholder canvas data URI when capture fails.
 */
function createPlaceholder(label: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 200;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  ctx.fillStyle = "#6b7280";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`Chart unavailable: ${label}`, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

/**
 * Captures a chart by querying its container element by data-chart-type attribute.
 * Returns a ChartCaptureResult with imageData and metadata.
 */
export async function captureChart(
  chartType: "pie" | "trend" | "cumulative",
  containerSelector: string
): Promise<ChartCaptureResult> {
  const element = document.querySelector<HTMLElement>(containerSelector);

  if (!element) {
    console.warn(`[chartCapture] Element not found: ${containerSelector}`);
    const imageData = createPlaceholder(chartType);
    return {
      chartType,
      imageData,
      width: 600,
      height: 200,
      captureMethod: "placeholder",
    };
  }

  const { imageData, method } = await captureElement(element, chartType);
  return {
    chartType,
    imageData,
    width: element.offsetWidth || 600,
    height: element.offsetHeight || 200,
    captureMethod: method,
  };
}

/**
 * Captures multiple charts given a map of chartType → selector.
 */
export async function captureCharts(
  selections: Partial<Record<"pie" | "trend" | "cumulative", boolean>>,
  selectors: Record<"pie" | "trend" | "cumulative", string>
): Promise<ChartCaptureResult[]> {
  const results: ChartCaptureResult[] = [];
  for (const [type, selected] of Object.entries(selections) as [
    "pie" | "trend" | "cumulative",
    boolean
  ][]) {
    if (selected) {
      const result = await captureChart(type, selectors[type]);
      results.push(result);
    }
  }
  return results;
}
