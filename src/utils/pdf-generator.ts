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
  previewElement: HTMLElement;
}

export async function generateQuotePdf({
  subject,
  previewElement,
}: GeneratePdfParams): Promise<void> {
  const dataUrl = await captureElement(previewElement);
  const img = await loadImage(dataUrl);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Calcola le dimensioni dell'immagine scalata alla larghezza della pagina
  const imgWidthMm = pageWidth;
  const imgHeightMm = (img.height * pageWidth) / img.width;

  if (imgHeightMm <= pageHeight) {
    // Tutto in una pagina
    pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidthMm, imgHeightMm);
  } else {
    // Split su più pagine: ritaglia l'immagine in strisce
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Impossibile creare canvas context');

    ctx.drawImage(img, 0, 0);
    const pxPerMm = img.width / pageWidth;
    const pageHeightPx = pageHeight * pxPerMm;

    let srcY = 0;
    let isFirstPage = true;

    while (srcY < img.height) {
      if (!isFirstPage) {
        pdf.addPage();
      }

      const sliceHeightPx = Math.min(pageHeightPx, img.height - srcY);
      const sliceHeightMm = sliceHeightPx / pxPerMm;

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = img.width;
      sliceCanvas.height = sliceHeightPx;
      const sliceCtx = sliceCanvas.getContext('2d');
      if (sliceCtx) {
        sliceCtx.fillStyle = '#ffffff';
        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sliceCtx.drawImage(
          canvas,
          0, srcY, img.width, sliceHeightPx,
          0, 0, img.width, sliceHeightPx,
        );
        const sliceUrl = sliceCanvas.toDataURL('image/png');
        pdf.addImage(sliceUrl, 'PNG', 0, 0, imgWidthMm, sliceHeightMm);
      }

      srcY += sliceHeightPx;
      isFirstPage = false;
    }
  }

  const filename = `Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`;
  pdf.save(filename);
}
