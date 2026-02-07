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
  contentElement: HTMLElement;
}

export async function generateQuotePdf({
  subject,
  headerElement,
  footerElement,
  contentElement,
}: GeneratePdfParams): Promise<void> {
  // 1) Cattura immagini
  const headerDataUrl = await captureElement(headerElement);
  const footerDataUrl = await captureElement(footerElement);
  const contentDataUrl = await captureElement(contentElement);

  const headerImg = await loadImage(headerDataUrl);
  const footerImg = await loadImage(footerDataUrl);
  const contentImg = await loadImage(contentDataUrl);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Altezze in mm proporzionali alla larghezza della pagina
  const headerHeightMm = (headerImg.height * pageWidth) / headerImg.width;
  const footerHeightMm = (footerImg.height * pageWidth) / footerImg.width;
  const contentHeightMm = (contentImg.height * pageWidth) / contentImg.width;

  const topMargin = 10; // margine superiore pagine di continuazione
  const footerY = pageHeight - footerHeightMm;

  const drawHeader = () => {
    pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeightMm);
  };

  const drawFooter = () => {
    pdf.addImage(footerDataUrl, 'PNG', 0, footerY, pageWidth, footerHeightMm);
  };

  // 2) Spezza il contenuto su più pagine
  // Pagina 1: header completo + contenuto + footer
  // Pagine 2+: solo contenuto (con margine top) + footer
  const pxPerMm = contentImg.height / contentHeightMm;
  let remainingMm = contentHeightMm;
  let offsetMm = 0;
  let pageNum = 0;

  while (remainingMm > 0) {
    if (pageNum > 0) {
      pdf.addPage();
    }

    // Header completo solo sulla prima pagina
    const pageStartY = pageNum === 0 ? headerHeightMm : topMargin;

    if (pageNum === 0) {
      drawHeader();
    }
    drawFooter();

    const availableOnPage = footerY - pageStartY;
    const sliceMm = Math.min(remainingMm, availableOnPage);

    // Coordinate sorgente in pixel
    const srcY = offsetMm * pxPerMm;
    const srcH = sliceMm * pxPerMm;

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
    pdf.addImage(sliceDataUrl, 'PNG', 0, pageStartY, pageWidth, sliceMm);

    offsetMm += sliceMm;
    remainingMm -= sliceMm;
    pageNum++;
  }

  pdf.save(`Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`);
}
