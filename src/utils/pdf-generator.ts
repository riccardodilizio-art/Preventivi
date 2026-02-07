import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';
import { PDF_CONFIG } from '@/constants';
import { loadImage } from '@/utils/image';
import { formatEuro } from '@/utils/formatting';
import type { ServiceItem } from '@/types/quote';
import type { Calculations } from '@/hooks/useQuoteCalculations';

const captureElement = (element: HTMLElement): Promise<string> =>
  toPng(element, {
    cacheBust: true,
    pixelRatio: PDF_CONFIG.PIXEL_RATIO,
    backgroundColor: PDF_CONFIG.BACKGROUND_COLOR,
  });

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
  const descriptionDataUrl = descriptionElement ? await captureElement(descriptionElement) : null;
  const totalsDataUrl = totalsElement ? await captureElement(totalsElement) : null;

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

  // 3) Descrizione come immagine
  if (descriptionDataUrl && descriptionElement) {
    const descImg = await loadImage(descriptionDataUrl);
    const descWidthMm = pageWidth - marginX * 2;
    const descHeightMm = (descImg.height * descWidthMm) / descImg.width;

    // Se la descrizione non sta nella pagina corrente, nuova pagina
    if (cursorY + descHeightMm > contentEndY) {
      pdf.addPage();
      drawHeader();
      drawFooter();
      cursorY = contentStartY;
    }

    pdf.addImage(descriptionDataUrl, 'PNG', marginX, cursorY, descWidthMm, descHeightMm);
    cursorY += descHeightMm + 4; // 4mm spacing
  }

  // 4) Tabella servizi con jspdf-autotable
  if (services.length > 0) {
    // Prepara i dati della tabella
    const tableBody: (string | { content: string; styles: Record<string, unknown> })[][] = [];

    for (const service of services) {
      // Riga servizio principale
      tableBody.push([
        { content: service.description, styles: { fontStyle: 'bold' } },
        {
          content: formatEuro(service.cost),
          styles: { fontStyle: 'bold', halign: 'right' as const },
        },
      ]);

      // Sotto-servizi come righe indentate
      if (service.subservices && service.subservices.length > 0) {
        for (const sub of service.subservices) {
          tableBody.push([
            { content: `  •  ${sub.description}`, styles: { fontStyle: 'normal', fontSize: 9, textColor: [0, 0, 0] } },
            { content: '', styles: {} },
          ]);
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
      // Bordi: solo top su ogni riga body, bottom sull'ultima
      didParseCell: (data) => {
        if (data.section === 'body') {
          // Bordo top sottile su ogni riga del body
          data.cell.styles.lineWidth = { top: 0.15, bottom: 0, left: 0, right: 0 };
          data.cell.styles.lineColor = [0, 0, 0];
        }
      },
      // Disegna bordo inferiore della tabella e header/footer su ogni pagina
      didDrawPage: (data) => {
        // Header e footer su ogni nuova pagina
        drawHeader();
        drawFooter();

        // Bordo inferiore della tabella (sotto l'ultima riga visibile su questa pagina)
        if (data.cursor) {
          const tableLeft = marginX;
          const tableRight = pageWidth - marginX;
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.2);
          pdf.line(tableLeft, data.cursor.y, tableRight, data.cursor.y);
        }
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
