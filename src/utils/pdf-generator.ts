import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';
import { PDF_CONFIG } from '@/constants';
import { formatEuro, formatEuroFromNumber } from '@/utils/formatting';
import { loadImage } from '@/utils/image';
import type { QuoteData } from '@/types/quote';
import type { Calculations } from '@/hooks/useQuoteCalculations';

const captureElement = (element: HTMLElement): Promise<string> =>
  toPng(element, {
    cacheBust: true,
    pixelRatio: PDF_CONFIG.PIXEL_RATIO,
    backgroundColor: PDF_CONFIG.BACKGROUND_COLOR,
  });

interface GeneratePdfParams {
  data: QuoteData;
  calculations: Calculations;
  headerElement: HTMLElement;
  footerElement: HTMLElement;
}

export async function generateQuotePdf({
  data,
  calculations,
  headerElement,
  footerElement,
}: GeneratePdfParams): Promise<void> {
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

  const { PADDING_X: paddingX, PADDING_Y: paddingY, HEADER_HEIGHT: maxHeaderHeight } = PDF_CONFIG;

  const computedHeaderHeight = (headerImg.height * pageWidth) / headerImg.width;
  const headerHeight = Math.min(computedHeaderHeight, maxHeaderHeight);
  const footerHeight = (footerImg.height * pageWidth) / footerImg.width;

  const topY = headerHeight + paddingY;
  const bottomY = pageHeight - footerHeight - paddingY;

  const addHeaderFooter = () => {
    pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeight);
    pdf.addImage(footerDataUrl, 'PNG', 0, pageHeight - footerHeight, pageWidth, footerHeight);
  };

  const newPage = () => {
    pdf.addPage();
    addHeaderFooter();
    return topY;
  };

  // Prima pagina
  addHeaderFooter();
  let currentY = topY;

  // 1) Descrizione multi-pagina
  if (data.serviceDescription?.trim()) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const lineHeight = 5;
    const lines: string[] = pdf.splitTextToSize(
      data.serviceDescription,
      pageWidth - paddingX * 2,
    );

    for (const line of lines) {
      if (currentY + lineHeight > bottomY) {
        currentY = newPage();
      }
      pdf.text(String(line), paddingX, currentY);
      currentY += lineHeight;
    }

    currentY += 6;
  }

  // 2) Tabella servizi
  if (data.services.length > 0) {
    const tableData = data.services.flatMap((service) => {
      const mainRow = [
        service.description,
        formatEuro(service.cost),
        service.vat ? 'Soggetto a Tasse' : 'Non soggetto a Tasse',
      ];

      const subRows = (service.subservices ?? [])
        .filter((s) => s.description.trim() !== '')
        .map((sub) => [`   \u2022 ${sub.description}`, '', '']);

      return [mainRow, ...subRows];
    });

    autoTable(pdf, {
      head: [['Servizio', 'Costo', 'Tasse']],
      body: tableData,
      startY: currentY,
      margin: {
        left: paddingX,
        right: paddingX,
        top: topY,
        bottom: pageHeight - bottomY,
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 40, halign: 'right' },
        2: { cellWidth: 50, fontSize: 8, halign: 'center' },
      },
      didDrawPage: () => addHeaderFooter(),
      didParseCell: (hook) => {
        const text = String(hook.cell.text?.[0] ?? '');
        if (text.trim().startsWith('\u2022')) {
          hook.cell.styles.fontSize = 8;
          hook.cell.styles.fontStyle = 'normal';
        }
      },
    });

    currentY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // 3) Box totali
  const { SUMMARY_BOX_WIDTH: boxWidth, SUMMARY_BOX_HEIGHT: summaryHeight } = PDF_CONFIG;
  if (currentY + summaryHeight > bottomY) {
    currentY = newPage();
  }

  const boxX = pageWidth - boxWidth - paddingX;
  const boxY = currentY;
  const lineHeight = 6;

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.rect(boxX, boxY, boxWidth, summaryHeight);

  pdf.setFontSize(9);
  let summaryY = boxY + 8;

  pdf.setFont('helvetica', 'normal');
  pdf.text('Imponibile (Tasse)', boxX + 5, summaryY);
  pdf.text(formatEuroFromNumber(calculations.taxable), boxX + boxWidth - 5, summaryY, { align: 'right' });
  summaryY += lineHeight;

  pdf.text('Imponibile (non soggetto a Tasse)', boxX + 5, summaryY);
  pdf.text(formatEuroFromNumber(calculations.nonTaxable), boxX + boxWidth - 5, summaryY, { align: 'right' });
  summaryY += lineHeight;

  pdf.text('Tasse (20%)', boxX + 5, summaryY);
  pdf.text(formatEuroFromNumber(calculations.iva), boxX + boxWidth - 5, summaryY, { align: 'right' });
  summaryY += lineHeight + 2;

  pdf.line(boxX + 5, summaryY, boxX + boxWidth - 5, summaryY);
  summaryY += 5;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Totale', boxX + 5, summaryY);
  pdf.text(formatEuroFromNumber(calculations.total), boxX + boxWidth - 5, summaryY, { align: 'right' });

  const filename = `Preventivo_${data.subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`;
  pdf.save(filename);
}
