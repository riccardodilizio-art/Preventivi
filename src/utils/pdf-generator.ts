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

interface GeneratePdfParams {
  subject: string;
  headerElement: HTMLElement;
  footerElement: HTMLElement;
  descriptionElement: HTMLElement | null;
  servicesElement: HTMLElement | null;
  totalsElement: HTMLElement | null;
}

export async function generateQuotePdf({
  subject,
  headerElement,
  footerElement,
  descriptionElement,
  servicesElement,
  totalsElement,
}: GeneratePdfParams): Promise<void> {
  // 1) Cattura immagini di tutti gli elementi
  const headerDataUrl = await captureElement(headerElement);
  const footerDataUrl = await captureElement(footerElement);
  const descriptionDataUrl = descriptionElement
    ? await captureElement(descriptionElement)
    : null;
  const servicesDataUrl = servicesElement
    ? await captureElement(servicesElement)
    : null;
  const totalsDataUrl = totalsElement
    ? await captureElement(totalsElement)
    : null;

  const headerImg = await loadImage(headerDataUrl);
  const footerImg = await loadImage(footerDataUrl);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 10;
  const contentWidth = pageWidth - marginX * 2;

  const headerHeightMm = (headerImg.height * pageWidth) / headerImg.width;
  const footerHeightMm = (footerImg.height * pageWidth) / footerImg.width;

  const contentStartY = headerHeightMm;
  const contentEndY = pageHeight - footerHeightMm;
  const availableHeight = contentEndY - contentStartY;

  const drawHeader = () => {
    pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeightMm);
  };

  const drawFooter = () => {
    pdf.addImage(footerDataUrl, 'PNG', 0, pageHeight - footerHeightMm, pageWidth, footerHeightMm);
  };

  // Funzione per piazzare un'immagine con gestione automatica di page-break
  // Se l'immagine è più alta dello spazio disponibile, la spezza su più pagine
  const placeImage = (
    dataUrl: string,
    imgWidth: number,
    imgHeight: number,
    targetWidthMm: number,
    xOffset: number,
    cursor: number,
  ): number => {
    const targetHeightMm = (imgHeight * targetWidthMm) / imgWidth;

    // Se entra nella pagina corrente, piazzala normalmente
    if (cursor + targetHeightMm <= contentEndY) {
      pdf.addImage(dataUrl, 'PNG', xOffset, cursor, targetWidthMm, targetHeightMm);
      return cursor + targetHeightMm;
    }

    // Se è più piccola dello spazio disponibile su una pagina intera, vai a pagina nuova
    if (targetHeightMm <= availableHeight) {
      pdf.addPage();
      drawHeader();
      drawFooter();
      pdf.addImage(dataUrl, 'PNG', xOffset, contentStartY, targetWidthMm, targetHeightMm);
      return contentStartY + targetHeightMm;
    }

    // Se è più grande di una pagina, spezzala su più pagine usando clipping
    let remainingHeight = targetHeightMm;
    let sourceYOffset = 0;
    let currentCursor = cursor;

    while (remainingHeight > 0) {
      const spaceOnPage = contentEndY - currentCursor;

      if (spaceOnPage <= 0) {
        pdf.addPage();
        drawHeader();
        drawFooter();
        currentCursor = contentStartY;
        continue;
      }

      const sliceHeight = Math.min(remainingHeight, spaceOnPage);

      // Calcola la porzione sorgente in pixel
      const scaleY = imgHeight / targetHeightMm;
      const srcY = sourceYOffset * scaleY;
      const srcH = sliceHeight * scaleY;

      // Crea un canvas temporaneo per la porzione
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = imgWidth;
      tempCanvas.height = Math.ceil(srcH);
      const ctx = tempCanvas.getContext('2d')!;

      const img = new Image();
      img.src = dataUrl;

      // Disegna solo la porzione necessaria
      ctx.drawImage(img, 0, srcY, imgWidth, srcH, 0, 0, imgWidth, Math.ceil(srcH));

      const sliceDataUrl = tempCanvas.toDataURL('image/png');
      pdf.addImage(sliceDataUrl, 'PNG', xOffset, currentCursor, targetWidthMm, sliceHeight);

      sourceYOffset += sliceHeight;
      remainingHeight -= sliceHeight;
      currentCursor += sliceHeight;

      if (remainingHeight > 0) {
        pdf.addPage();
        drawHeader();
        drawFooter();
        currentCursor = contentStartY;
      }
    }

    return currentCursor;
  };

  // 2) Prima pagina: header + footer
  drawHeader();
  drawFooter();

  let cursorY = contentStartY;

  // 3) Descrizione come immagine (full width, ha px-10 interno)
  if (descriptionDataUrl && descriptionElement) {
    const descImg = await loadImage(descriptionDataUrl);
    cursorY = placeImage(descriptionDataUrl, descImg.width, descImg.height, pageWidth, 0, cursorY);
    cursorY += 2;
  }

  // 4) Tabella servizi come immagine
  if (servicesDataUrl && servicesElement) {
    const svcImg = await loadImage(servicesDataUrl);
    // La tabella ha px-10 dal contenitore padre, quindi usiamo contentWidth con marginX
    cursorY = placeImage(servicesDataUrl, svcImg.width, svcImg.height, contentWidth, marginX, cursorY);
    cursorY += 4;
  }

  // 5) Totali come immagine
  if (totalsDataUrl && totalsElement) {
    const totImg = await loadImage(totalsDataUrl);
    cursorY = placeImage(totalsDataUrl, totImg.width, totImg.height, contentWidth, marginX, cursorY);
  }

  pdf.save(`Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`);
}
