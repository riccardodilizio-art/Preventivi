import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { PDF_CONFIG } from '@/constants';
import { loadImage } from '@/utils/image';
import { formatEuro } from '@/utils/formatting';
import type { ServiceItem } from '@/types/quote';
import type { Calculations } from '@/hooks/useQuoteCalculations';

const captureElement = async (element: HTMLElement): Promise<string> => {
  const canvas = await html2canvas(element, {
    scale: PDF_CONFIG.PIXEL_RATIO,
    backgroundColor: PDF_CONFIG.BACKGROUND_COLOR,
    useCORS: true,
    logging: false,
    onclone: (clonedDoc) => {
      // html2canvas 1.4.1 non supporta oklch() (Tailwind CSS 4).
      // 1) Sostituisci oklch() in tutti i <style> del clone con un fallback sicuro
      clonedDoc.querySelectorAll('style').forEach((style) => {
        if (style.textContent?.includes('oklch')) {
          style.textContent = style.textContent.replace(
            /oklch\([^)]*\)/g,
            'rgb(0, 0, 0)',
          );
        }
      });

      // 2) Imposta colori rgb inline su tutti gli elementi del clone
      //    (calcolati dal browser originale che supporta oklch)
      const clonedEl = clonedDoc.body;
      const origEls = [element, ...element.querySelectorAll<HTMLElement>('*')];
      const clonedEls = [
        clonedDoc.querySelector(`[data-html2canvas-clone]`) as HTMLElement || clonedEl,
        ...clonedEl.querySelectorAll<HTMLElement>('*'),
      ];

      // Match by index between original and cloned elements
      origEls.forEach((origEl, i) => {
        const cloneEl = clonedEls[i];
        if (!cloneEl) return;
        const cs = window.getComputedStyle(origEl);
        cloneEl.style.color = cs.color;
        cloneEl.style.backgroundColor = cs.backgroundColor;
        cloneEl.style.borderTopColor = cs.borderTopColor;
        cloneEl.style.borderRightColor = cs.borderRightColor;
        cloneEl.style.borderBottomColor = cs.borderBottomColor;
        cloneEl.style.borderLeftColor = cs.borderLeftColor;
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
  totalsElement: HTMLElement | null;
  services: ServiceItem[];
  calculations: Calculations;
}

export async function generateQuotePdf({
  subject,
  headerElement,
  footerElement,
  descriptionElement,
  totalsElement,
  services,
  calculations: _calculations,
}: GeneratePdfParams): Promise<void> {
  // 1) Cattura immagini di header, footer, descrizione e totali
  const headerDataUrl = await captureElement(headerElement);
  const footerDataUrl = await captureElement(footerElement);
  const descriptionDataUrl = descriptionElement
    ? await captureElement(descriptionElement)
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

  const headerHeightMm = (headerImg.height * pageWidth) / headerImg.width;
  const footerHeightMm = (footerImg.height * pageWidth) / footerImg.width;

  const contentStartY = headerHeightMm;
  const contentEndY = pageHeight - footerHeightMm;

  const drawHeader = () => {
    pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeightMm);
  };

  const drawFooter = () => {
    pdf.addImage(footerDataUrl, 'PNG', 0, pageHeight - footerHeightMm, pageWidth, footerHeightMm);
  };

  // 2) Prima pagina: header + footer
  drawHeader();
  drawFooter();

  let cursorY = contentStartY;

  // 3) Descrizione come immagine (ha il proprio px-10 quindi usa pageWidth)
  if (descriptionDataUrl && descriptionElement) {
    const descImg = await loadImage(descriptionDataUrl);
    const descHeightMm = (descImg.height * pageWidth) / descImg.width;

    if (cursorY + descHeightMm > contentEndY) {
      pdf.addPage();
      drawHeader();
      drawFooter();
      cursorY = contentStartY;
    }

    pdf.addImage(descriptionDataUrl, 'PNG', 0, cursorY, pageWidth, descHeightMm);
    cursorY += descHeightMm + 4;
  }

  // 4) Tabella servizi con jspdf-autotable
  if (services.length > 0) {
    const subserviceRows = new Set<number>();
    const tableBody: (string | { content: string; styles: Record<string, unknown> })[][] = [];
    let rowIdx = 0;

    for (const service of services) {
      tableBody.push([
        { content: service.description, styles: { fontStyle: 'bold' } },
        {
          content: formatEuro(service.cost),
          styles: { fontStyle: 'bold', halign: 'right' as const },
        },
      ]);
      rowIdx++;

      if (service.subservices && service.subservices.length > 0) {
        for (const sub of service.subservices) {
          subserviceRows.add(rowIdx);
          tableBody.push([
            { content: sub.description, styles: { fontStyle: 'normal', fontSize: 9, textColor: [0, 0, 0] } },
            { content: '', styles: {} },
          ]);
          rowIdx++;
        }
      }
    }

    autoTable(pdf, {
      startY: cursorY,
      margin: { left: marginX, right: marginX, top: contentStartY, bottom: footerHeightMm + 2 },
      head: [['Servizio', 'Costo']],
      body: tableBody,
      theme: 'plain',
      styles: {
        fontSize: 10,
        cellPadding: { top: 2.5, bottom: 2.5, left: 1.5, right: 1.5 },
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
        overflow: 'linebreak',
      },
      headStyles: {
        fontStyle: 'bold',
        fontSize: 10,
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineWidth: { bottom: 0.5, top: 0, left: 0, right: 0 },
        lineColor: [0, 0, 0],
        cellPadding: { top: 2, bottom: 3, left: 1.5, right: 1.5 },
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 40, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const isLastRow = data.row.index === tableBody.length - 1;
          data.cell.styles.lineWidth = {
            top: 0.15,
            bottom: isLastRow ? 0.3 : 0,
            left: 0,
            right: 0,
          };
          data.cell.styles.lineColor = [0, 0, 0];

          if (subserviceRows.has(data.row.index) && data.column.index === 0) {
            data.cell.styles.cellPadding = { top: 2, bottom: 2, left: 10, right: 1.5 };
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0 && subserviceRows.has(data.row.index)) {
          pdf.setFontSize(9);
          pdf.setTextColor(0, 0, 0);
          pdf.text('•', data.cell.x + 5, data.cell.y + data.cell.contentHeight / 2 + data.cell.padding('top'));
        }
      },
      didDrawPage: () => {
        drawHeader();
        drawFooter();
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (pdf as any).lastAutoTable?.finalY ?? cursorY + 20;
  }

  // 5) Totali come immagine
  if (totalsDataUrl && totalsElement) {
    const totImg = await loadImage(totalsDataUrl);
    const totWidthMm = pageWidth - marginX * 2;
    const totHeightMm = (totImg.height * totWidthMm) / totImg.width;

    if (cursorY + totHeightMm + 4 > contentEndY) {
      pdf.addPage();
      drawHeader();
      drawFooter();
      cursorY = contentStartY;
    }

    pdf.addImage(totalsDataUrl, 'PNG', marginX, cursorY + 2, totWidthMm, totHeightMm);
    cursorY += totHeightMm + 4;
  }

  pdf.save(`Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`);
}
