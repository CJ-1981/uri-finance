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

// SPEC-REPORT-001: Fixed capture width ensures consistent aspect ratios across devices
// Exported for use in ReportExportModal for summary table capture consistency
export const CAPTURE_WIDTH = 800;

/**
 * Captures any DOM element at a consistent width for PDF export.
 * For Recharts elements (waitForRerender=true), clones the element into a temporary
 * container to ensure ResponsiveContainer detects the size change correctly.
 *
 * @param element - DOM element to capture
 * @param targetWidth - Width to force for capture (default: 800px)
 * @param label - Label for error logging
 * @param waitForRerender - If true, uses clone method for Recharts ResponsiveContainer
 */
export async function captureElementAtWidth(
  element: HTMLElement,
  targetWidth: number,
  label: string,
  waitForRerender = false
): Promise<{ imageData: string; width: number; height: number } | null> {
  // Non-Recharts elements: simple style modification
  if (!waitForRerender) {
    const originalWidth = element.style.width;
    const originalMinWidth = element.style.minWidth;
    const originalMaxWidth = element.style.maxWidth;

    element.style.width = `${targetWidth}px`;
    element.style.minWidth = `${targetWidth}px`;
    element.style.maxWidth = `${targetWidth}px`;

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const renderedWidth = element.offsetWidth;
      const renderedHeight = element.offsetHeight;

      element.style.width = originalWidth;
      element.style.minWidth = originalMinWidth;
      element.style.maxWidth = originalMaxWidth;

      return {
        imageData: canvas.toDataURL("image/jpeg", 0.85),
        width: renderedWidth,
        height: renderedHeight,
      };
    } catch (err) {
      element.style.width = originalWidth;
      element.style.minWidth = originalMinWidth;
      element.style.maxWidth = originalMaxWidth;
      console.warn(`[chartCapture] captureElementAtWidth failed for "${label}":`, err);
      return null;
    }
  }

  // Recharts elements: expand in-place to desktop width, then restore
  // This ensures ResizeObserver detects the change and Recharts re-renders correctly

  // Store original styles
  const originalWidth = element.style.width;
  const originalMinWidth = element.style.minWidth;
  const originalMaxWidth = element.style.maxWidth;
  const originalPadding = element.style.padding;
  const originalPaddingLeft = element.style.paddingLeft;
  const originalPaddingRight = element.style.paddingRight;
  const originalBoxSizing = element.style.boxSizing;

  // Expand element to desktop width in-place
  element.style.width = `${targetWidth}px`;
  element.style.minWidth = `${targetWidth}px`;
  element.style.maxWidth = `${targetWidth}px`;
  element.style.padding = "16px";
  element.style.paddingLeft = "16px";
  element.style.paddingRight = "16px";
  element.style.boxSizing = "border-box";

  try {
    // Force multiple resize events to trigger Recharts ResponsiveContainer
    window.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    window.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    // Poll for SVG to reach target width (Recharts ResponsiveContainer uses ResizeObserver)
    const targetSvgWidth = targetWidth - 32; // Account for padding
    const startTime = Date.now();
    const maxWait = 2000;

    while (Date.now() - startTime < maxWait) {
      const svg = element.querySelector("svg") as unknown as HTMLElement;
      if (svg && svg.offsetWidth >= targetSvgWidth * 0.95) { // 95% tolerance
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const finalSvg = element.querySelector("svg") as unknown as HTMLElement;
    const finalSvgWidth = finalSvg?.offsetWidth || 0;
    if (finalSvgWidth < targetSvgWidth * 0.95) {
      console.warn(`[chartCapture] SVG width ${finalSvgWidth}px is less than target ${targetSvgWidth}px`);
    }

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const renderedWidth = element.offsetWidth;
    const renderedHeight = element.offsetHeight;

    // Restore element to original size
    element.style.width = originalWidth;
    element.style.minWidth = originalMinWidth;
    element.style.maxWidth = originalMaxWidth;
    element.style.padding = originalPadding;
    element.style.paddingLeft = originalPaddingLeft;
    element.style.paddingRight = originalPaddingRight;
    element.style.boxSizing = originalBoxSizing;

    // Trigger resize to restore original chart size
    window.dispatchEvent(new Event("resize"));

    return {
      imageData: canvas.toDataURL("image/jpeg", 0.85),
      width: renderedWidth,
      height: renderedHeight,
    };
  } catch (err) {
    // Restore element to original size on error
    element.style.width = originalWidth;
    element.style.minWidth = originalMinWidth;
    element.style.maxWidth = originalMaxWidth;
    element.style.padding = originalPadding;
    element.style.paddingLeft = originalPaddingLeft;
    element.style.paddingRight = originalPaddingRight;
    element.style.boxSizing = originalBoxSizing;

    window.dispatchEvent(new Event("resize"));
    console.warn(`[chartCapture] captureElementAtWidth failed for "${label}":`, err);
    return null;
  }
}

/**
 * Attempts to capture a DOM element as a base64 PNG image.
 * Temporarily sets a fixed width to ensure consistent aspect ratios across devices.
 * Falls back to placeholder on failure.
 */
async function captureElement(
  element: HTMLElement,
  label: string
): Promise<{ imageData: string; width: number; height: number; method: CaptureMethod }> {
  const result = await captureElementAtWidth(element, CAPTURE_WIDTH, label, true);

  if (!result) {
    return {
      imageData: createPlaceholder(label),
      width: 600,
      height: 200,
      method: "placeholder",
    };
  }

  return {
    ...result,
    method: "html2canvas",
  };
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
  return canvas.toDataURL("image/jpeg", 0.85);
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

  const { imageData, width, height, method } = await captureElement(element, chartType);
  return {
    chartType,
    imageData,
    width,
    height,
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
