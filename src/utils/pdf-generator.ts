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
  // Cattura header, contenuto e footer come immagini (preserva lo stile CSS)
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

  // Calcola altezze header e footer in mm (scalati alla larghezza pagina)
  const headerHeightMm = (headerImg.height * pageWidth) / headerImg.width;
  const footerHeightMm = (footerImg.height * pageWidth) / footerImg.width;

  // Area utile per il contenuto su ogni pagina
  const contentTopY = headerHeightMm;
  const contentBottomY = pageHeight - footerHeightMm;
  const availableHeightMm = contentBottomY - contentTopY;

  // Dimensioni del contenuto scalato
  const contentWidthMm = pageWidth;
  const contentHeightMm = (contentImg.height * pageWidth) / contentImg.width;

  // Funzione per disegnare header e footer sulla pagina corrente
  const addHeaderFooter = () => {
    pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeightMm);
    pdf.addImage(footerDataUrl, 'PNG', 0, pageHeight - footerHeightMm, pageWidth, footerHeightMm);
  };

  // Se il contenuto sta in una pagina
  if (contentHeightMm <= availableHeightMm) {
    addHeaderFooter();
    pdf.addImage(contentDataUrl, 'PNG', 0, contentTopY, contentWidthMm, contentHeightMm);
  } else {
    // Contenuto troppo alto: splitta su più pagine con header/footer ripetuti
    const canvas = document.createElement('canvas');
    canvas.width = contentImg.width;
    canvas.height = contentImg.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Impossibile creare canvas context');
    ctx.drawImage(contentImg, 0, 0);

    const pxPerMm = contentImg.width / contentWidthMm;
    const availableHeightPx = availableHeightMm * pxPerMm;

    let srcY = 0;
    let isFirstPage = true;

    while (srcY < contentImg.height) {
      if (!isFirstPage) {
        pdf.addPage();
      }

      // Header e footer su ogni pagina
      addHeaderFooter();

      // Ritaglia la fetta di contenuto per questa pagina
      const sliceHeightPx = Math.min(availableHeightPx, contentImg.height - srcY);
      const sliceHeightMm = sliceHeightPx / pxPerMm;

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = contentImg.width;
      sliceCanvas.height = sliceHeightPx;
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

      srcY += sliceHeightPx;
      isFirstPage = false;
    }
  }

  const filename = `Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`;
  pdf.save(filename);
}
