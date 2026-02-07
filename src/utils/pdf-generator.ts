import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';
import { PDF_CONFIG } from '@/constants';
import { loadImage } from '@/utils/image';
import { formatEuro } from '@/utils/formatting';
import type { ServiceItem } from '@/types/quote';
import type { Calculations } from '@/hooks/useQuoteCalculations';

const captureElement = async (element: HTMLElement): Promise<string> => {
  // Salva stili originali
  const saved = {
    width: element.style.width,
    maxWidth: element.style.maxWidth,
    wordBreak: element.style.wordBreak,
    overflowWrap: element.style.overflowWrap,
    boxSizing: element.style.boxSizing,
  };

  // Forza larghezza e word-wrap inline - il clone di html-to-image
  // non ha il contesto del padre e @layer CSS potrebbe non essere risolto
  const rect = element.getBoundingClientRect();
  element.style.width = `${rect.width}px`;
  element.style.maxWidth = `${rect.width}px`;
  element.style.wordBreak = 'break-word';
  element.style.overflowWrap = 'break-word';
  element.style.boxSizing = 'border-box';

  // Forza gli stessi stili anche su tutti i figli diretti
  const children = element.querySelectorAll<HTMLElement>('*');
  const childSaved: { el: HTMLElement; ow: string; wb: string }[] = [];
  children.forEach((child) => {
    childSaved.push({ el: child, ow: child.style.overflowWrap, wb: child.style.wordBreak });
    child.style.overflowWrap = 'break-word';
    child.style.wordBreak = 'break-word';
  });

  try {
    const dataUrl = await toPng(element, {
      cacheBust: true,
      pixelRatio: PDF_CONFIG.PIXEL_RATIO,
      backgroundColor: PDF_CONFIG.BACKGROUND_COLOR,
    });
    return dataUrl;
  } finally {
    // Ripristina stili originali
    element.style.width = saved.width;
    element.style.maxWidth = saved.maxWidth;
    element.style.wordBreak = saved.wordBreak;
    element.style.overflowWrap = saved.overflowWrap;
    element.style.boxSizing = saved.boxSizing;
    childSaved.forEach(({ el, ow, wb }) => {
      el.style.overflowWrap = ow;
      el.style.wordBreak = wb;
    });
  }
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
  const marginX = 10; // margine laterale per il contenuto

  const headerHeightMm = (headerImg.height * pageWidth) / headerImg.width;
  const footerHeightMm = (footerImg.height * pageWidth) / footerImg.width;

  const contentStartY = headerHeightMm;
  const contentEndY = pageHeight - footerHeightMm;

  // Funzioni per disegnare header e footer
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

    // Se la descrizione non sta nella pagina corrente, nuova pagina
    if (cursorY + descHeightMm > contentEndY) {
      pdf.addPage();
      drawHeader();
      drawFooter();
      cursorY = contentStartY;
    }

    pdf.addImage(descriptionDataUrl, 'PNG', 0, cursorY, pageWidth, descHeightMm);
    cursorY += descHeightMm + 4; // 4mm spacing
  }

  // 4) Tabella servizi con jspdf-autotable
  if (services.length > 0) {
    // Prepara i dati della tabella
    // Traccia quali righe sono sotto-servizi per il rendering custom
    const subserviceRows = new Set<number>();
    const tableBody: (string | { content: string; styles: Record<string, unknown> })[][] = [];
    let rowIdx = 0;

    for (const service of services) {
      // Riga servizio principale
      tableBody.push([
        { content: service.description, styles: { fontStyle: 'bold' } },
        {
          content: formatEuro(service.cost),
          styles: { fontStyle: 'bold', halign: 'right' as const },
        },
      ]);
      rowIdx++;

      // Sotto-servizi come righe indentate
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

          // Sotto-servizi: indentazione left per allineare il testo dopo il bullet
          if (subserviceRows.has(data.row.index) && data.column.index === 0) {
            data.cell.styles.cellPadding = { top: 2, bottom: 2, left: 10, right: 1.5 };
          }
        }
      },
      didDrawCell: (data) => {
        // Disegna il bullet • manualmente per i sotto-servizi
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

    // Aggiorna il cursore dopo la tabella
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = (pdf as any).lastAutoTable?.finalY ?? cursorY + 20;
  }

  // 5) Totali come immagine
  if (totalsDataUrl && totalsElement) {
    const totImg = await loadImage(totalsDataUrl);
    const totWidthMm = pageWidth - marginX * 2;
    const totHeightMm = (totImg.height * totWidthMm) / totImg.width;

    // Se i totali non stanno nella pagina corrente, nuova pagina
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
