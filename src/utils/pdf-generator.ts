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

interface BlockImage {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
}

export async function generateQuotePdf({
  subject,
  headerElement,
  contentElement,
  footerElement,
}: GeneratePdfParams): Promise<void> {
  // 1) Cattura header e footer
  const [headerDataUrl, footerDataUrl] = await Promise.all([
    captureElement(headerElement),
    captureElement(footerElement),
  ]);

  const [headerImg, footerImg] = await Promise.all([
    loadImage(headerDataUrl),
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

  const addHeaderFooter = () => {
    pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeightMm);
    pdf.addImage(footerDataUrl, 'PNG', 0, pageHeight - footerHeightMm, pageWidth, footerHeightMm);
  };

  // 2) Trova tutti i blocchi logici [data-pdf-block] nel contenuto
  const blockElements = contentElement.querySelectorAll<HTMLElement>('[data-pdf-block]');

  // 3) Cattura ogni blocco come immagine separata
  const blockImages: BlockImage[] = [];
  for (const el of blockElements) {
    const dataUrl = await captureElement(el);
    const img = await loadImage(dataUrl);
    blockImages.push({
      dataUrl,
      widthMm: pageWidth,
      heightMm: (img.height * pageWidth) / img.width,
    });
  }

  // 4) Posiziona i blocchi nel PDF, con page break intelligenti
  addHeaderFooter();
  let currentY = contentTopY;

  for (const block of blockImages) {
    // Se il blocco non entra nella pagina corrente, nuova pagina
    if (currentY + block.heightMm > contentBottomY && currentY > contentTopY) {
      pdf.addPage();
      addHeaderFooter();
      currentY = contentTopY;
    }

    // Se un singolo blocco è più alto dello spazio disponibile,
    // lo splitta su più pagine (caso raro: descrizione molto lunga)
    if (block.heightMm > availableHeightMm) {
      const blockImg = await loadImage(block.dataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = blockImg.width;
      canvas.height = blockImg.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(blockImg, 0, 0);

      const pxPerMm = blockImg.width / pageWidth;
      let srcY = 0;

      while (srcY < blockImg.height) {
        const sliceAvailMm = contentBottomY - currentY;
        const sliceAvailPx = sliceAvailMm * pxPerMm;
        const sliceHeightPx = Math.min(sliceAvailPx, blockImg.height - srcY);
        const sliceHeightMm = sliceHeightPx / pxPerMm;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = blockImg.width;
        sliceCanvas.height = sliceHeightPx;
        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          sliceCtx.fillStyle = '#ffffff';
          sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sliceCtx.drawImage(
            canvas,
            0, srcY, blockImg.width, sliceHeightPx,
            0, 0, blockImg.width, sliceHeightPx,
          );
          const sliceUrl = sliceCanvas.toDataURL('image/png');
          pdf.addImage(sliceUrl, 'PNG', 0, currentY, pageWidth, sliceHeightMm);
        }

        srcY += sliceHeightPx;
        currentY += sliceHeightMm;

        if (srcY < blockImg.height) {
          pdf.addPage();
          addHeaderFooter();
          currentY = contentTopY;
        }
      }
    } else {
      // Blocco normale: inserisci nella pagina corrente
      pdf.addImage(block.dataUrl, 'PNG', 0, currentY, block.widthMm, block.heightMm);
      currentY += block.heightMm;
    }
  }

  const filename = `Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`;
  pdf.save(filename);
}
