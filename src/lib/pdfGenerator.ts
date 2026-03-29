// SPEC-REPORT-001: PDF report generator
// Uses html2canvas for ALL user-visible text so that Korean (CJK) characters
// render correctly via the browser's font stack instead of jsPDF's Latin-only fonts.
import type { ChartCaptureResult } from "@/lib/chartCapture";

interface PdfReportConfig {
  projectName: string;
  periodLabel: string;
  /** Base64 PNG of the rendered summary table captured via html2canvas */
  summaryImageData: string | null;
  summaryImageHeight: number;
  summaryImageWidth: number;
  chartCaptures: ChartCaptureResult[];
  generatedAt: Date;
}

/**
 * Captures an arbitrary DOM element as a base64 PNG.
 * Returns null on failure so the caller can fall back gracefully.
 */
async function captureElementToPng(
  selector: string
): Promise<{ data: string; w: number; h: number } | null> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  try {
    const isMobile = typeof window !== "undefined" && 
      (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768);
    const scale = isMobile ? 1.5 : 2;

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(el, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    return {
      data: canvas.toDataURL("image/jpeg", 0.85),
      w: el.offsetWidth,
      h: el.offsetHeight,
    };
  } catch (err) {
    console.warn("[pdfGenerator] captureElementToPng failed:", err);
    return null;
  }
}

/**
 * Builds a one-line header image using a temporary off-screen div so that
 * the project name and period (which may contain Korean) are rendered by the
 * browser and captured as PNG — avoiding jsPDF's Latin-only font limitation.
 */
async function buildHeaderImage(
  projectName: string,
  periodLabel: string,
  generatedAt: Date
): Promise<{ data: string; w: number; h: number } | null> {
  const div = document.createElement("div");
  div.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 760px;
    padding: 16px 20px;
    background: #ffffff;
    font-family: -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    color: #1a1a1a;
    box-sizing: border-box;
  `;
  div.innerHTML = `
    <div style="font-size:22px;font-weight:700;margin-bottom:6px;">Financial Report</div>
    <div style="font-size:13px;color:#555;line-height:1.6;">
      <span style="font-weight:600;">Project :</span> ${projectName}<br/>
      <span style="font-weight:600;">Period :</span> ${periodLabel}<br/>
      <span style="font-weight:600;">Generated :</span> ${generatedAt.toLocaleString()}
    </div>
  `;
  document.body.appendChild(div);
  try {
    const isMobile = typeof window !== "undefined" && 
      (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768);
    const scale = isMobile ? 1.5 : 2;

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(div, {
      scale: scale,
      backgroundColor: "#ffffff",
      logging: false,
    });
    return {
      data: canvas.toDataURL("image/jpeg", 0.85),
      w: div.offsetWidth,
      h: div.offsetHeight,
    };
  } catch {
    return null;
  } finally {
    document.body.removeChild(div);
  }
}

export async function generatePdfReport(config: PdfReportConfig): Promise<Blob> {
  const { jsPDF } = await import("jspdf");

  const {
    projectName,
    periodLabel,
    summaryImageData,
    summaryImageHeight,
    summaryImageWidth,
    chartCaptures,
    generatedAt,
  } = config;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  /**
   * Helper: embed a JPEG image, scaling it to fit contentWidth.
   * Returns the height in mm that was used, or 0 on skip.
   */
  function embedImage(
    imgData: string,
    srcPxW: number,
    srcPxH: number,
    maxHeightMm = 120
  ): number {
    if (!imgData || srcPxW === 0) return 0;
    
    const aspect = srcPxH / srcPxW;
    let imgWidthMm = contentWidth;
    let imgHeightMm = imgWidthMm * aspect;
    
    // Preserve aspect ratio if height exceeds limit
    if (imgHeightMm > maxHeightMm) {
      imgHeightMm = maxHeightMm;
      imgWidthMm = imgHeightMm / aspect;
    }
    
    // Center horizontally if shrunk in width
    const xOffset = margin + (contentWidth - imgWidthMm) / 2;
    
    try {
      doc.addImage(imgData, "JPEG", xOffset, y, imgWidthMm, imgHeightMm);
    } catch (e) {
      console.warn("[pdfGenerator] addImage failed:", e);
      return 0;
    }
    return imgHeightMm;
  }

  /** Adds a new page if the remaining space is less than needed. */
  function ensureSpace(neededMm: number) {
    if (y + neededMm > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // ── Header (captured as image to support Korean/CJK) ──────────────────────
  const headerImg = await buildHeaderImage(projectName, periodLabel, generatedAt);
  if (headerImg) {
    const hMm = embedImage(headerImg.data, headerImg.w, headerImg.h, 50);
    y += hMm + 4;
  } else {
    // Plain ASCII fallback (safe if header image capture fails)
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Financial Report", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Project: ${projectName}`, margin, y); y += 5;
    doc.text(`Period: ${periodLabel}`, margin, y); y += 5;
    doc.text(`Generated: ${generatedAt.toLocaleString()}`, margin, y); y += 8;
  }

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

    // ── Summary Table (captured as image) ─────────────────────────────────────
    if (summaryImageData) {
      const tAspect = summaryImageHeight / summaryImageWidth;
      let tWidthMm = contentWidth;
      let tHeightMm = Math.min(tWidthMm * tAspect, 250);
      
      ensureSpace(tHeightMm + 6);
      
      const tMm = embedImage(
        summaryImageData,
        summaryImageWidth,
        summaryImageHeight,
        250
      );
      y += tMm + 6;
    }

    // ── Charts ─────────────────────────────────────────────────────────────────
    if (chartCaptures.length > 0) {
      const chartLabels: Record<string, string> = {
        pie: "Distribution by Category",
        trend: "Trend Over Time",
        cumulative: "Cumulative Chart",
      };

      // Force a page break before charts so they start on a new page (e.g. 2nd page)
      if (y > margin) {
        doc.addPage();
        y = margin;
      }

      for (const capture of chartCaptures) {
        const label = chartLabels[capture.chartType] || capture.chartType;

        // Calculate expected height before rendering title/body
        const aspect = capture.height / capture.width;
        let imgWidthMm = contentWidth;
        let imgHeightMm = imgWidthMm * aspect;
        const maxHeight = 230;
        if (imgHeightMm > maxHeight) {
          imgHeightMm = maxHeight;
          imgWidthMm = imgHeightMm / aspect;
        }

        const totalNeeded = capture.captureMethod === "placeholder" ? 20 : (imgHeightMm + 15);
        ensureSpace(totalNeeded);

        // Chart label (ASCII-safe, label is hardcoded English)
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(60, 60, 60);
        doc.text(label, margin, y);
        y += 4;

        if (capture.captureMethod === "placeholder") {
          doc.setFontSize(9);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(150, 150, 150);
          doc.text("(Chart capture unavailable)", margin, y);
          y += 10;
        } else {
          // Pass null if we already calculated the values but hMm is more robust
          const hMm = embedImage(capture.imageData, capture.width, capture.height, maxHeight);
          y += hMm + 8;
        }
      }
    }

  // ── Footer on each page ────────────────────────────────────────────────────
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      `URI Finance | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  return doc.output("blob");
}
