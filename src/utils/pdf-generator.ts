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
  descriptionElement: HTMLElement | null;
}

export async function generateQuotePdf({
  data,
  calculations,
  headerElement,
  footerElement,
  descriptionElement,
}: GeneratePdfParams): Promise<void> {
  const captures = [
    captureElement(headerElement),
    captureElement(footerElement),
  ];
  if (descriptionElement) {
    captures.push(captureElement(descriptionElement));
  }
  const [headerDataUrl, footerDataUrl, descriptionDataUrl] = await Promise.all(captures);

  if (!headerDataUrl || !footerDataUrl) {
    throw new Error('Impossibile catturare header o footer');
  }

  const headerImg = await loadImage(headerDataUrl);
  const footerImg = await loadImage(footerDataUrl);
  const descriptionImg = descriptionDataUrl ? await loadImage(descriptionDataUrl) : null;

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

  // 1) Descrizione (catturata come immagine per preservare stili: colori, evidenziazioni, etc.)
  if (descriptionDataUrl && descriptionImg) {
    const contentWidth = pageWidth - paddingX * 2;
    const descHeight = (descriptionImg.height * contentWidth) / descriptionImg.width;
    const availableHeight = bottomY - currentY;

    if (descHeight <= availableHeight) {
      pdf.addImage(descriptionDataUrl, 'PNG', paddingX, currentY, contentWidth, descHeight);
      currentY += descHeight + 6;
    } else {
      // Descrizione troppo alta: splitta su più pagine usando un canvas temporaneo
      const canvas = document.createElement('canvas');
      canvas.width = descriptionImg.width;
      canvas.height = descriptionImg.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(descriptionImg, 0, 0);
        const pxPerMm = descriptionImg.width / contentWidth;
        let srcY = 0;

        while (srcY < descriptionImg.height) {
          const sliceAvailMm = bottomY - currentY;
          const sliceAvailPx = sliceAvailMm * pxPerMm;
          const sliceHeightPx = Math.min(sliceAvailPx, descriptionImg.height - srcY);
          const sliceHeightMm = sliceHeightPx / pxPerMm;

          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = descriptionImg.width;
          sliceCanvas.height = sliceHeightPx;
          const sliceCtx = sliceCanvas.getContext('2d');
          if (sliceCtx) {
            sliceCtx.fillStyle = '#ffffff';
            sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            sliceCtx.drawImage(
              canvas, 0, srcY, descriptionImg.width, sliceHeightPx,
              0, 0, descriptionImg.width, sliceHeightPx,
            );
            const sliceUrl = sliceCanvas.toDataURL('image/png');
            pdf.addImage(sliceUrl, 'PNG', paddingX, currentY, contentWidth, sliceHeightMm);
          }

          srcY += sliceHeightPx;
          currentY += sliceHeightMm;

          if (srcY < descriptionImg.height) {
            currentY = newPage();
          }
        }
      }
      currentY += 6;
    }
  } else if (data.serviceDescription?.trim()) {
    // Fallback: testo plain se la cattura immagine non è disponibile
    const plainText = data.serviceDescription.replace(/<[^>]*>/g, '');
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const lineHeight = 5;
    const lines: string[] = pdf.splitTextToSize(plainText, pageWidth - paddingX * 2);
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
