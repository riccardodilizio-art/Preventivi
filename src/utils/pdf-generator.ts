import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { loadImage } from '@/utils/image';
import { formatDate } from '@/utils/formatting';
import type { QuoteData } from '@/types/quote';
/* ------------------------------------------------------------------ */
/*  Costanti layout (mm)                                              */
/* ------------------------------------------------------------------ */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_L = 15;
const MARGIN_R = 15;
const MARGIN_TOP = 15;
const MARGIN_BOT = 12;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const PIXEL_RATIO = 3;

/* ------------------------------------------------------------------ */
/*  Utility: carica immagine come base64 da un URL/import              */
/* ------------------------------------------------------------------ */
async function toBase64(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  const b64 = canvas.toDataURL('image/png');
  canvas.width = 0;
  canvas.height = 0;
  return b64;
}

/* ------------------------------------------------------------------ */
/*  Cattura solo il contenuto HTML come immagine                       */
/* ------------------------------------------------------------------ */
async function captureContent(element: HTMLElement): Promise<string> {
  const canvas = await html2canvas(element, {
    scale: PIXEL_RATIO,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    scrollY: 0,
    scrollX: 0,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (_doc, clonedEl) => {
      const root = clonedEl as HTMLElement;
      // Rimuove oklch custom properties
      for (const sheet of Array.from(_doc.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
              for (let i = rule.style.length - 1; i >= 0; i--) {
                const prop = rule.style.item(i);
                if (rule.style.getPropertyValue(prop).includes('oklch')) {
                  rule.style.removeProperty(prop);
                }
              }
            }
          }
        } catch { /* cross-origin */ }
      }
      root.style.setProperty('color', '#000', 'important');
      root.style.setProperty('background', '#fff', 'important');
      root.querySelectorAll<HTMLElement>('*').forEach((el) => {
        const cs = window.getComputedStyle(el);
        const bg = cs.backgroundColor;
        const isTransparent = !bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' || bg === 'rgb(255, 255, 255)';
        el.style.setProperty('background-color', isTransparent ? 'transparent' : bg, 'important');
        const color = cs.color;
        el.style.setProperty('color', color.startsWith('rgb') ? color : '#000', 'important');
        el.style.setProperty('border-color', '#000', 'important');
        el.style.setProperty('filter', 'none', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
        el.style.setProperty('text-shadow', 'none', 'important');
      });
    },
  });
  return canvas.toDataURL('image/png');
}

/* ------------------------------------------------------------------ */
/*  Breakpoint e slicing (stessa logica collaudata)                    */
/* ------------------------------------------------------------------ */
function getBlockBreakpoints(container: HTMLElement): number[] {
  const blocks = container.querySelectorAll<HTMLElement>('[data-pdf-block]');
  const containerTop = container.getBoundingClientRect().top;
  return Array.from(blocks).map(b => b.getBoundingClientRect().bottom - containerTop);
}

function findSafeBreak(breakpoints: number[], maxPx: number, offsetPx: number): number {
  let best = offsetPx;
  for (const bp of breakpoints) {
    if (bp <= offsetPx) continue;
    if (bp - offsetPx <= maxPx) best = bp;
    else break;
  }
  return best <= offsetPx ? offsetPx + maxPx : best;
}

function cropImage(
  img: HTMLImageElement, srcX: number, srcY: number, srcW: number, srcH: number,
): HTMLCanvasElement {
  const h = Math.max(1, Math.round(srcH));
  const canvas = document.createElement('canvas');
  canvas.width = srcW;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, h);
  return canvas;
}

/* ------------------------------------------------------------------ */
/*  Disegna header vettoriale (restituisce Y finale in mm)             */
/* ------------------------------------------------------------------ */
async function drawHeader(
  pdf: jsPDF,
  data: QuoteData,
  logoB64: string,
): Promise<number> {
  let y = MARGIN_TOP;

  // Logo a sinistra
  const logoImg = await loadImage(logoB64);
  const logoMaxW = 50;
  const logoMaxH = 22;
  const aspect = logoImg.naturalWidth / logoImg.naturalHeight;
  let lw = logoMaxW;
  let lh = lw / aspect;
  if (lh > logoMaxH) { lh = logoMaxH; lw = lh * aspect; }
  pdf.addImage(logoB64, 'PNG', MARGIN_L, y, lw, lh);

  // Company info a destra
  const rightX = PAGE_W - MARGIN_R;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.companyName, rightX, y + 5, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text(data.companyAddress, rightX, y + 10, { align: 'right' });
  pdf.text(data.companyCity, rightX, y + 14.5, { align: 'right' });
  pdf.setFontSize(8.5);
  pdf.text(`C.F. ${data.taxCode}`, rightX, y + 19, { align: 'right' });
  pdf.text(`P. IVA ${data.vatNumber}`, rightX, y + 23, { align: 'right' });

  y += Math.max(lh, 25) + 8;

  // Titolo "PREVENTIVO"
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PREVENTIVO', MARGIN_L, y);
  y += 8;

  // Box oggetto con sfondo grigio
  const boxH = 14;
  pdf.setFillColor(245, 245, 245);
  pdf.setDrawColor(220, 220, 220);
  pdf.roundedRect(MARGIN_L, y, CONTENT_W, boxH, 2, 2, 'FD');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`OGGETTO: ${data.subject}`, MARGIN_L + 6, y + boxH / 2 + 1, {
    baseline: 'middle',
    maxWidth: CONTENT_W - 12,
  });
  y += boxH + 6;

  return y;
}

/* ------------------------------------------------------------------ */
/*  Disegna footer vettoriale (restituisce altezza footer in mm)       */
/* ------------------------------------------------------------------ */
async function drawFooter(
  pdf: jsPDF,
  data: QuoteData,
  firmaB64: string,
  footerY: number,
): Promise<void> {
  const y = footerY;

  // Location e data a sinistra
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.location, MARGIN_L, y + 6);
  pdf.setFontSize(9);
  pdf.text(formatDate(data.date), MARGIN_L, y + 12);

  // Firma a destra
  const sigBoxW = 60;
  const sigBoxX = PAGE_W - MARGIN_R - sigBoxW;
  const sigLineY = y + 24;

  // Immagine firma
  const firmaImg = await loadImage(firmaB64);
  const firmaAspect = firmaImg.naturalWidth / firmaImg.naturalHeight;
  const firmaH = 18;
  const firmaW = firmaH * firmaAspect;
  const firmaX = sigBoxX + (sigBoxW - firmaW) / 2;
  pdf.addImage(firmaB64, 'PNG', firmaX, y + 2, firmaW, firmaH);

  // Linea firma
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.4);
  pdf.line(sigBoxX, sigLineY, sigBoxX + sigBoxW, sigLineY);

  // Testo firma sotto la linea
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(120, 120, 120);
  pdf.text(data.signature, sigBoxX + sigBoxW / 2, sigLineY + 4, { align: 'center' });
  pdf.setTextColor(0, 0, 0);
}

const FOOTER_TOTAL_H = 35; // altezza riservata al footer in mm

/* ------------------------------------------------------------------ */
/*  Interfaccia pubblica                                               */
/* ------------------------------------------------------------------ */
export interface GeneratePdfParams {
  data: QuoteData;
  contentElement: HTMLElement;
  logoSrc: string;
  firmaSrc: string;
}

/**
 * Genera il PDF del preventivo.
 *
 * - Header e footer: vettoriali (jsPDF text/line/rect/image)
 * - Content: bitmap via html2canvas, con slicing intelligente su [data-pdf-block]
 */
export async function generateQuotePdf({
  data,
  contentElement,
  logoSrc,
  firmaSrc,
}: GeneratePdfParams): Promise<void> {

  // 1) Pre-carica immagini come base64
  const [logoB64, firmaB64] = await Promise.all([
    toBase64(logoSrc),
    toBase64(firmaSrc),
  ]);

  // 2) Cattura solo il contenuto come immagine
  const contentDataUrl = await captureContent(contentElement);
  const contentImg = await loadImage(contentDataUrl);

  // 3) Breakpoint dal DOM (px CSS, relativi al contentElement)
  const breakpointsDomPx = getBlockBreakpoints(contentElement);

  // 4) Scala: canvas px ↔ DOM px
  const contentDomH = contentElement.scrollHeight;
  const scaleY = contentImg.height / contentDomH;

  // Breakpoint in canvas px
  const breakpointsCpx = breakpointsDomPx
    .map(bp => Math.round(bp * scaleY))
    .filter(bp => bp > 0 && bp < contentImg.height);

  // 5) mm per canvas-pixel
  const mmPerCpx = CONTENT_W / contentImg.width;
  const contentTotalCpx = contentImg.height;

  // 6) Crea il PDF
  const pdf = new jsPDF('p', 'mm', 'a4');

  // 7) Disegna header sulla prima pagina per sapere dove inizia il content
  const headerEndY = await drawHeader(pdf, data, logoB64);

  // 8) Calcola le slice del content
  const slices: { offsetCpx: number; heightCpx: number }[] = [];
  {
    let offsetCpx = 0;

    while (offsetCpx < contentTotalCpx) {
      const remaining = contentTotalCpx - offsetCpx;
      const isFirst = slices.length === 0;

      // Dove inizia il content in questa pagina (mm)
      const topMm = isFirst ? headerEndY : MARGIN_TOP;

      // Spazio se questa fosse l'ultima pagina (con footer)
      const availLastMm = PAGE_H - topMm - FOOTER_TOTAL_H;
      const availLastCpx = Math.round(availLastMm / mmPerCpx);

      // Se il contenuto rimanente entra con il footer, chiudi
      if (remaining <= availLastCpx) {
        slices.push({ offsetCpx, heightCpx: remaining });
        break;
      }

      // Pagina intermedia: spazio fino al margine inferiore
      const availMidMm = PAGE_H - topMm - MARGIN_BOT;
      const availMidCpx = Math.round(availMidMm / mmPerCpx);

      const safeCut = findSafeBreak(breakpointsCpx, availMidCpx, offsetCpx);
      let actualCut = Math.min(safeCut, offsetCpx + availMidCpx);

      // Se consuma tutto, ricalcola con spazio per footer
      if (actualCut >= contentTotalCpx) {
        const safeLastCut = findSafeBreak(breakpointsCpx, availLastCpx, offsetCpx);
        actualCut = Math.min(safeLastCut, offsetCpx + availLastCpx);
      }

      const h = actualCut - offsetCpx;
      if (h <= 0) {
        slices.push({ offsetCpx, heightCpx: availMidCpx });
        offsetCpx += availMidCpx;
      } else {
        slices.push({ offsetCpx, heightCpx: h });
        offsetCpx += h;
      }
    }
  }

  // 9) Render pagina per pagina
  const totalPages = slices.length;

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) {
      pdf.addPage();
      // Nessun header sulle pagine successive
    }

    const { offsetCpx, heightCpx } = slices[i]!;
    const isFirst = i === 0;
    const isLast = i === totalPages - 1;

    const contentYmm = isFirst ? headerEndY : MARGIN_TOP;
    const sliceMm = heightCpx * mmPerCpx;

    // Disegna la slice del contenuto
    const sliceCanvas = cropImage(contentImg, 0, offsetCpx, contentImg.width, heightCpx);
    pdf.addImage(
      sliceCanvas.toDataURL('image/png'), 'PNG',
      MARGIN_L, contentYmm, CONTENT_W, sliceMm,
    );
    sliceCanvas.width = 0;
    sliceCanvas.height = 0;

    // Footer solo sull'ultima pagina
    if (isLast) {
      const footerY = PAGE_H - FOOTER_TOTAL_H;
      await drawFooter(pdf, data, firmaB64, footerY);
    }
  }

  // 10) Salva
  pdf.save(`Preventivo_${data.subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`);
}
