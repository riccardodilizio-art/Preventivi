import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PDF_CONFIG } from '@/constants';
import { loadImage } from '@/utils/image';

const captureElement = async (element: HTMLElement): Promise<string> => {
    const canvas = await html2canvas(element, {
        scale: PDF_CONFIG.PIXEL_RATIO,
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

            root.style.setProperty('color', '#000', 'important');
            root.style.setProperty('background', '#fff', 'important');
            root.style.setProperty('background-color', '#fff', 'important');

            root.querySelectorAll<HTMLElement>('*').forEach((el) => {
                el.style.setProperty('color', '#000', 'important');
                el.style.setProperty('background-color', 'transparent', 'important');
                el.style.setProperty('border-color', '#000', 'important');
                el.style.setProperty('filter', 'none', 'important');
                el.style.setProperty('text-shadow', 'none', 'important');
            });
        },
    });

    return canvas.toDataURL('image/png');
};

/**
 * Legge le posizioni Y (in px) dei bordi inferiori di ogni [data-pdf-block]
 * relative al contentElement. Questi sono i punti "sicuri" dove tagliare.
 */
function getBlockBreakpoints(contentElement: HTMLElement): number[] {
  const blocks = contentElement.querySelectorAll<HTMLElement>('[data-pdf-block]');
  const containerTop = contentElement.getBoundingClientRect().top;
  const breakpoints: number[] = [];

  blocks.forEach((block) => {
    const rect = block.getBoundingClientRect();
    const bottomPx = rect.bottom - containerTop;
    breakpoints.push(bottomPx);
  });

  return breakpoints;
}

/**
 * Dato un limite massimo in px, trova il breakpoint sicuro più vicino
 * che non supera quel limite. Se nessun breakpoint entra, usa il limite grezzo.
 */
function findSafeBreak(breakpointsPx: number[], maxPx: number, offsetPx: number): number {
  let bestBreak = offsetPx; // fallback: nessun contenuto (non dovrebbe succedere)

  for (const bp of breakpointsPx) {
    if (bp <= offsetPx) continue; // già passato
    if (bp - offsetPx <= maxPx) {
      bestBreak = bp; // questo blocco entra, aggiorna il miglior taglio
    } else {
      break; // il prossimo non entra, fermati
    }
  }

  // Se nessun breakpoint valido trovato, usa il taglio grezzo (fallback sicuro)
  if (bestBreak <= offsetPx) {
    return offsetPx + maxPx;
  }

  return bestBreak;
}

interface GeneratePdfParams {
  subject: string;
  headerElement: HTMLElement;
  footerElement: HTMLElement;
  contentElement: HTMLElement;
}

export async function generateQuotePdf({
  subject,
  headerElement,
  footerElement,
  contentElement,
}: GeneratePdfParams): Promise<void> {
  // 1) Leggi i breakpoint PRIMA della cattura (servono le posizioni DOM reali)
  const breakpointsPx = getBlockBreakpoints(contentElement);

  // 2) Cattura immagini
  const headerDataUrl = await captureElement(headerElement);
  const footerDataUrl = await captureElement(footerElement);
  const contentDataUrl = await captureElement(contentElement);

  const headerImg = await loadImage(headerDataUrl);
  const footerImg = await loadImage(footerDataUrl);
  const contentImg = await loadImage(contentDataUrl);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Altezze in mm
  const headerHeightMm = (headerImg.height * pageWidth) / headerImg.width;
  const footerHeightMm = (footerImg.height * pageWidth) / footerImg.width;
  const contentHeightMm = (contentImg.height * pageWidth) / contentImg.width;
  const footerY = pageHeight - footerHeightMm;

  // Rapporto px (DOM reali, non canvas) → mm
  const contentDomHeight = contentElement.scrollHeight;
  const pxToMm = contentHeightMm / contentDomHeight;
  const mmToPx = contentDomHeight / contentHeightMm;

  // Rapporto px canvas → mm (per il taglio dell'immagine)
  const canvasPxPerMm = contentImg.height / contentHeightMm;

  // Converti breakpoint da px DOM a mm
  const breakpointsMm = breakpointsPx.map((bp) => bp * pxToMm);

  const drawHeader = () => {
    pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeightMm);
  };

  const drawFooter = () => {
    pdf.addImage(footerDataUrl, 'PNG', 0, footerY, pageWidth, footerHeightMm);
  };

  // 3) Pre-calcola le fette usando breakpoint intelligenti
  const slices: { offsetMm: number; sliceMm: number }[] = [];
  {
    let offsetMm = 0;
    const totalMm = contentHeightMm;

    while (offsetMm < totalMm) {
      const startY = headerHeightMm;
      const remaining = totalMm - offsetMm;

      // Controlla se il contenuto rimanente entra con il footer (ultima pagina)
      const availableWithFooter = footerY - startY;
      if (remaining <= availableWithFooter) {
        // Ultima pagina: tutto il contenuto rimanente
        slices.push({ offsetMm, sliceMm: remaining });
        break;
      }

      // Pagina intermedia: usa tutto lo spazio senza footer
      const availableWithoutFooter = pageHeight - startY;
      const maxCutMm = offsetMm + availableWithoutFooter;

      // Trova il breakpoint sicuro più vicino (in mm)
      const offsetPx = offsetMm * mmToPx;
      const maxPx = availableWithoutFooter * mmToPx;
      const safeCutPx = findSafeBreak(breakpointsPx, maxPx, offsetPx);
      const safeCutMm = safeCutPx * pxToMm;

      // Usa il taglio sicuro, ma non superare lo spazio disponibile
      const actualCutMm = Math.min(safeCutMm, maxCutMm);
      const sliceMm = actualCutMm - offsetMm;

      if (sliceMm <= 0) {
        // Fallback: se il blocco è più grande della pagina, taglia comunque
        slices.push({ offsetMm, sliceMm: availableWithoutFooter });
        offsetMm += availableWithoutFooter;
      } else {
        slices.push({ offsetMm, sliceMm });
        offsetMm += sliceMm;
      }
    }
  }

  const totalPages = slices.length;

  // 4) Disegna ogni pagina
  for (let i = 0; i < totalPages; i++) {
    if (i > 0) {
      pdf.addPage();
    }

    const { offsetMm, sliceMm } = slices[i];
    const isLastPage = i === totalPages - 1;
    const startY = headerHeightMm;

    // Header su tutte le pagine
    drawHeader();

    // Footer solo sull'ultima pagina
    if (isLastPage) {
      drawFooter();
    }

    // Coordinate sorgente in pixel canvas
    const srcY = offsetMm * canvasPxPerMm;
    const srcH = sliceMm * canvasPxPerMm;

    // Canvas con solo la porzione necessaria
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = contentImg.width;
    sliceCanvas.height = Math.max(1, Math.round(srcH));
    const ctx = sliceCanvas.getContext('2d')!;

    ctx.drawImage(
      contentImg,
      0, srcY, contentImg.width, srcH,
      0, 0, contentImg.width, Math.round(srcH),
    );

    const sliceDataUrl = sliceCanvas.toDataURL('image/png');
    pdf.addImage(sliceDataUrl, 'PNG', 0, startY, pageWidth, sliceMm);
  }

  pdf.save(`Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`);
}
