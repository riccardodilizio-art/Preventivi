import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { PDF_CONFIG } from '@/constants';
import { loadImage } from '@/utils/image';

const captureElement = (element: HTMLElement): Promise<string> =>
  toPng(element, {
    cacheBust: true,
    pixelRatio: PDF_CONFIG.PIXEL_RATIO,
    backgroundColor: PDF_CONFIG.BACKGROUND_COLOR,
  });

interface GeneratePdfParams {
  subject: string;
  headerElement: HTMLElement;
  contentElement: HTMLElement;
  footerElement: HTMLElement;
}

export async function generateQuotePdf({
  subject,
  headerElement,
  contentElement,
  footerElement,
}: GeneratePdfParams): Promise<void> {
  // 1) Cattura header, contenuto intero e footer come immagini
  const [headerDataUrl, contentDataUrl, footerDataUrl] = await Promise.all([
    captureElement(headerElement),
    captureElement(contentElement),
    captureElement(footerElement),
  ]);

  const [headerImg, contentImg, footerImg] = await Promise.all([
    loadImage(headerDataUrl),
    loadImage(contentDataUrl),
    loadImage(footerDataUrl),
  ]);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const headerHeightMm = (headerImg.height * pageWidth) / headerImg.width;
  const footerHeightMm = (footerImg.height * pageWidth) / footerImg.width;

  const contentTopY = headerHeightMm;
  const contentBottomY = pageHeight - footerHeightMm;
  const availableHeightMm = contentBottomY - contentTopY;

  const contentWidthMm = pageWidth;
  const contentHeightMm = (contentImg.height * pageWidth) / contentImg.width;

  const addHeaderFooter = () => {
    pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeightMm);
    pdf.addImage(footerDataUrl, 'PNG', 0, pageHeight - footerHeightMm, pageWidth, footerHeightMm);
  };

  // 2) Se il contenuto sta in una pagina, semplice
  if (contentHeightMm <= availableHeightMm) {
    addHeaderFooter();
    pdf.addImage(contentDataUrl, 'PNG', 0, contentTopY, contentWidthMm, contentHeightMm);
    const filename = `Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`;
    pdf.save(filename);
    return;
  }

  // 3) Calcola punti di taglio sicuri dalle posizioni Y dei blocchi [data-pdf-block]
  //    I tagli avvengono al BORDO INFERIORE di ogni blocco (fine del blocco)
  const contentRect = contentElement.getBoundingClientRect();
  const blockElements = contentElement.querySelectorAll<HTMLElement>('[data-pdf-block]');
  const pxPerMm = contentImg.width / contentWidthMm;
  const pixelRatio = contentImg.width / contentRect.width;

  // Calcola le posizioni Y di fine blocco in pixel dell'immagine
  const safeBreakPointsPx: number[] = [];
  for (const el of blockElements) {
    const elRect = el.getBoundingClientRect();
    const bottomRelative = elRect.bottom - contentRect.top;
    const bottomPx = bottomRelative * pixelRatio;
    safeBreakPointsPx.push(bottomPx);
  }

  // 4) Taglia l'immagine ai punti sicuri, rispettando lo spazio disponibile
  const canvas = document.createElement('canvas');
  canvas.width = contentImg.width;
  canvas.height = contentImg.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossibile creare canvas context');
  ctx.drawImage(contentImg, 0, 0);

  const availableHeightPx = availableHeightMm * pxPerMm;
  let srcY = 0;
  let isFirstPage = true;

  while (srcY < contentImg.height) {
    if (!isFirstPage) {
      pdf.addPage();
    }
    addHeaderFooter();

    // Trova il punto di taglio sicuro migliore che sta dentro lo spazio disponibile
    const maxEndPx = srcY + availableHeightPx;
    let bestBreak = srcY + availableHeightPx; // fallback: taglia al limite

    // Cerca l'ultimo breakpoint che sta dentro lo spazio disponibile
    let foundBreak = false;
    for (let i = safeBreakPointsPx.length - 1; i >= 0; i--) {
      const bp = safeBreakPointsPx[i]!;
      if (bp > srcY && bp <= maxEndPx) {
        bestBreak = bp;
        foundBreak = true;
        break;
      }
    }

    // Se non troviamo un breakpoint valido e il contenuto restante è poco,
    // prendi tutto il contenuto restante
    if (!foundBreak && contentImg.height - srcY <= availableHeightPx) {
      bestBreak = contentImg.height;
    }

    // Se il primo breakpoint è già oltre lo spazio disponibile,
    // dobbiamo forzare il taglio (blocco singolo troppo alto)
    if (!foundBreak && bestBreak > contentImg.height) {
      bestBreak = Math.min(srcY + availableHeightPx, contentImg.height);
    }

    const sliceHeightPx = bestBreak - srcY;
    const sliceHeightMm = sliceHeightPx / pxPerMm;

    // Ritaglia e inserisci la fetta
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = contentImg.width;
    sliceCanvas.height = Math.max(1, Math.round(sliceHeightPx));
    const sliceCtx = sliceCanvas.getContext('2d');
    if (sliceCtx) {
      sliceCtx.fillStyle = '#ffffff';
      sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sliceCtx.drawImage(
        canvas,
        0, srcY, contentImg.width, sliceHeightPx,
        0, 0, contentImg.width, sliceHeightPx,
      );
      const sliceUrl = sliceCanvas.toDataURL('image/png');
      pdf.addImage(sliceUrl, 'PNG', 0, contentTopY, contentWidthMm, sliceHeightMm);
    }

    srcY = bestBreak;
    isFirstPage = false;
  }

  const filename = `Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`;
  pdf.save(filename);
}
