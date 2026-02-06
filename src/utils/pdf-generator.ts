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
  // Spazio massimo per contenuto: tra header e footer
  const maxContentHeightMm = pageHeight - headerHeightMm - footerHeightMm;

  const contentWidthMm = pageWidth;
  const contentHeightMm = (contentImg.height * pageWidth) / contentImg.width;

  const addHeader = () => {
    pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeightMm);
  };

  const addFooter = (afterContentY: number) => {
    // Posiziona il footer subito dopo il contenuto, oppure in fondo alla pagina
    // (quello che viene dopo, per evitare che il footer sovrasti il contenuto)
    const footerAtBottom = pageHeight - footerHeightMm;
    const footerAfterContent = afterContentY;
    const footerY = Math.max(footerAfterContent, footerAtBottom);
    // Se il footer dopo il contenuto sfora la pagina, mettilo in fondo
    pdf.addImage(footerDataUrl, 'PNG', 0, Math.min(footerY, footerAtBottom), pageWidth, footerHeightMm);
  };

  // 2) Se il contenuto sta in una pagina, semplice
  if (contentHeightMm <= maxContentHeightMm) {
    addHeader();
    pdf.addImage(contentDataUrl, 'PNG', 0, contentTopY, contentWidthMm, contentHeightMm);
    addFooter(contentTopY + contentHeightMm);
    pdf.save(`Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`);
    return;
  }

  // 3) Calcola punti di taglio sicuri dai blocchi [data-pdf-block]
  const contentRect = contentElement.getBoundingClientRect();
  const blockElements = contentElement.querySelectorAll<HTMLElement>('[data-pdf-block]');
  const pxPerMm = contentImg.width / contentWidthMm;
  const pixelRatio = contentImg.width / contentRect.width;

  const safeBreakPointsPx: number[] = [];
  for (const el of blockElements) {
    const elRect = el.getBoundingClientRect();
    const bottomPx = (elRect.bottom - contentRect.top) * pixelRatio;
    safeBreakPointsPx.push(bottomPx);
  }

  // 4) Prepara il canvas sorgente
  const canvas = document.createElement('canvas');
  canvas.width = contentImg.width;
  canvas.height = contentImg.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossibile creare canvas context');
  ctx.drawImage(contentImg, 0, 0);

  const maxContentHeightPx = maxContentHeightMm * pxPerMm;

  // 5) Calcola tutte le fette PRIMA di creare le pagine
  const slices: { srcY: number; height: number }[] = [];
  let srcY = 0;

  while (srcY < contentImg.height) {
    const remaining = contentImg.height - srcY;

    // Se il contenuto restante sta nello spazio disponibile, prendilo tutto
    if (remaining <= maxContentHeightPx) {
      slices.push({ srcY, height: remaining });
      break;
    }

    // Trova l'ultimo breakpoint che sta nello spazio disponibile
    const maxEndPx = srcY + maxContentHeightPx;
    let bestBreak = -1;

    for (let i = safeBreakPointsPx.length - 1; i >= 0; i--) {
      const bp = safeBreakPointsPx[i]!;
      if (bp > srcY && bp <= maxEndPx) {
        bestBreak = bp;
        break;
      }
    }

    // Se nessun breakpoint trovato, forza il taglio al limite
    if (bestBreak <= srcY) {
      bestBreak = Math.min(srcY + maxContentHeightPx, contentImg.height);
    }

    slices.push({ srcY, height: bestBreak - srcY });
    srcY = bestBreak;
  }

  // 6) Crea le pagine
  for (let pageIdx = 0; pageIdx < slices.length; pageIdx++) {
    if (pageIdx > 0) {
      pdf.addPage();
    }

    const slice = slices[pageIdx]!;
    const sliceHeightMm = slice.height / pxPerMm;
    const isLastPage = pageIdx === slices.length - 1;

    // Header su ogni pagina
    addHeader();

    // Ritaglia e inserisci la fetta di contenuto
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = contentImg.width;
    sliceCanvas.height = Math.max(1, Math.round(slice.height));
    const sliceCtx = sliceCanvas.getContext('2d');
    if (sliceCtx) {
      sliceCtx.fillStyle = '#ffffff';
      sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sliceCtx.drawImage(
        canvas,
        0, slice.srcY, contentImg.width, slice.height,
        0, 0, contentImg.width, slice.height,
      );
      const sliceUrl = sliceCanvas.toDataURL('image/png');
      pdf.addImage(sliceUrl, 'PNG', 0, contentTopY, contentWidthMm, sliceHeightMm);
    }

    // Footer: sull'ultima pagina subito dopo il contenuto,
    // sulle pagine intermedie in fondo alla pagina
    if (isLastPage) {
      const footerY = contentTopY + sliceHeightMm;
      pdf.addImage(footerDataUrl, 'PNG', 0, footerY, pageWidth, footerHeightMm);
    } else {
      pdf.addImage(footerDataUrl, 'PNG', 0, pageHeight - footerHeightMm, pageWidth, footerHeightMm);
    }
  }

  pdf.save(`Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`);
}
