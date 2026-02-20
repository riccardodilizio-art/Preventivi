import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, BorderStyle, WidthType, HeadingLevel,
  ShadingType, TableLayoutType,
} from 'docx';
import { saveAs } from 'file-saver';
import { formatEuroFromNumber, formatDate, parseItalianNumber } from '@/utils/formatting';
import { VAT_RATE } from '@/constants';
import type { QuoteData } from '@/types/quote';
import type { Calculations } from '@/hooks/useQuoteCalculations';

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */
const FONT = 'Calibri';
const PT = (n: number) => n * 2; // half-points per docx

/** Converte un URL/import in ArrayBuffer per ImageRun */
async function toArrayBuffer(src: string): Promise<ArrayBuffer> {
  if (src.startsWith('data:')) {
    const base64 = src.split(',')[1]!;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  const res = await fetch(src);
  return res.arrayBuffer();
}

/** Calcola dimensioni immagine mantenendo aspect ratio */
async function getImageDimensions(
  src: string, maxW: number, maxH: number,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const aspect = img.naturalWidth / img.naturalHeight;
      let w = maxW;
      let h = w / aspect;
      if (h > maxH) { h = maxH; w = h * aspect; }
      resolve({ width: Math.round(w), height: Math.round(h) });
    };
    img.onerror = () => resolve({ width: maxW, height: maxH });
    img.src = src;
  });
}

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
} as const;

const thinBorder = {
  style: BorderStyle.SINGLE, size: 1, color: '000000',
} as const;

/* ------------------------------------------------------------------ */
/*  Parsifica l'HTML della descrizione in TextRun[]                    */
/* ------------------------------------------------------------------ */
function parseHtmlToRuns(html: string): Paragraph[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  const paragraphs: Paragraph[] = [];

  function processNode(node: Node): TextRun[] {
    const runs: TextRun[] = [];
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        runs.push(new TextRun({ text, font: FONT, size: PT(10) }));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const childRuns: TextRun[] = [];
      el.childNodes.forEach(child => childRuns.push(...processNode(child)));

      for (const run of childRuns) {
        const props: Record<string, unknown> = {};
        if (tag === 'strong' || tag === 'b') props.bold = true;
        if (tag === 'em' || tag === 'i') props.italics = true;
        if (tag === 'u') props.underline = {};
        // Re-create run with additional formatting
        const text = (run as unknown as { options?: { text?: string } }).options?.text
          ?? (run as unknown as { root?: unknown[] }).root?.[1] as string ?? '';
        if (text) {
          runs.push(new TextRun({
            text,
            font: FONT,
            size: PT(10),
            bold: props.bold as boolean | undefined,
            italics: props.italics as boolean | undefined,
            underline: props.underline as Record<string, unknown> | undefined,
          }));
        }
      }
    }
    return runs;
  }

  // Process top-level children as separate paragraphs
  div.childNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') {
        el.querySelectorAll('li').forEach(li => {
          const runs = processNode(li);
          if (runs.length > 0) {
            paragraphs.push(new Paragraph({
              children: [new TextRun({ text: '• ', font: FONT, size: PT(10) }), ...runs],
              spacing: { after: 60 },
            }));
          }
        });
        return;
      }
    }
    const runs = processNode(node);
    if (runs.length > 0) {
      paragraphs.push(new Paragraph({ children: runs, spacing: { after: 100 } }));
    }
  });

  return paragraphs.length > 0
    ? paragraphs
    : [new Paragraph({ children: [new TextRun({ text: '', font: FONT })] })];
}

/* ------------------------------------------------------------------ */
/*  Interfaccia pubblica                                               */
/* ------------------------------------------------------------------ */
export interface GenerateWordParams {
  data: QuoteData;
  calculations: Calculations;
  logoSrc: string;
  firmaSrc: string;
}

export async function generateQuoteWord({
  data,
  calculations,
  logoSrc,
  firmaSrc,
}: GenerateWordParams): Promise<void> {

  // 1) Carica immagini
  const [logoBuf, firmaBuf, logoDims, firmaDims] = await Promise.all([
    toArrayBuffer(logoSrc),
    toArrayBuffer(firmaSrc),
    getImageDimensions(logoSrc, 180, 80),
    getImageDimensions(firmaSrc, 120, 80),
  ]);

  // 2) Header: logo + company info (tabella senza bordi a 2 colonne)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: logoBuf,
                    transformation: logoDims,
                    type: 'png',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: data.companyName, font: FONT, size: PT(11), bold: true })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: data.companyAddress, font: FONT, size: PT(9.5) })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: data.companyCity, font: FONT, size: PT(9.5) })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `C.F. ${data.taxCode}`, font: FONT, size: PT(8.5) })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `P. IVA ${data.vatNumber}`, font: FONT, size: PT(8.5) })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 3) Titolo PREVENTIVO
  const titleParagraph = new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 200 },
    children: [new TextRun({ text: 'PREVENTIVO', font: FONT, size: PT(16), bold: true })],
  });

  // 4) Box oggetto (sfondo grigio)
  const subjectTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
            },
            shading: { type: ShadingType.SOLID, color: 'F5F5F5', fill: 'F5F5F5' },
            margins: { top: 100, bottom: 100, left: 150, right: 150 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'OGGETTO: ', font: FONT, size: PT(10), bold: true }),
                  new TextRun({ text: data.subject, font: FONT, size: PT(10), bold: true }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 5) Descrizione servizio (parsifica HTML)
  const descriptionParagraphs = parseHtmlToRuns(data.serviceDescription);

  // 6) Tabella servizi
  const serviceRows: TableRow[] = [];

  // Intestazione
  serviceRows.push(
    new TableRow({
      children: [
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          borders: { top: thinBorder, bottom: { style: BorderStyle.SINGLE, size: 2, color: '000000' }, left: noBorders.left, right: noBorders.right },
          children: [new Paragraph({
            children: [new TextRun({ text: 'Servizio', font: FONT, size: PT(9), bold: true })],
          })],
        }),
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          borders: { top: thinBorder, bottom: { style: BorderStyle.SINGLE, size: 2, color: '000000' }, left: noBorders.left, right: noBorders.right },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Costo', font: FONT, size: PT(9), bold: true })],
          })],
        }),
      ],
    }),
  );

  // Righe servizi
  for (const service of data.services) {
    const costText = service.cost
      ? formatEuroFromNumber(parseItalianNumber(service.cost) ?? 0)
      : '';
    const vatText = service.vat ? 'Soggetto a Tasse' : 'Non soggetto a Tasse';

    const descChildren: Paragraph[] = [
      new Paragraph({
        children: [new TextRun({ text: service.description, font: FONT, size: PT(10), bold: true })],
      }),
    ];

    // Subservices
    if (service.subservices && service.subservices.length > 0) {
      for (const sub of service.subservices) {
        descChildren.push(new Paragraph({
          spacing: { before: 40 },
          indent: { left: 360 },
          children: [new TextRun({ text: `• ${sub.description}`, font: FONT, size: PT(9) })],
        }));
      }
    }

    serviceRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: { top: thinBorder, bottom: thinBorder, left: noBorders.left, right: noBorders.right },
            margins: { top: 60, bottom: 60 },
            children: descChildren,
          }),
          new TableCell({
            borders: { top: thinBorder, bottom: thinBorder, left: noBorders.left, right: noBorders.right },
            margins: { top: 60, bottom: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: costText, font: FONT, size: PT(10), bold: true })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: vatText, font: FONT, size: PT(8) })],
              }),
            ],
          }),
        ],
      }),
    );
  }

  const servicesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: serviceRows,
  });

  // 7) Totali box (tabella allineata a destra)
  const summaryBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
  } as const;

  function summaryRow(label: string, value: string, isBold = false, topBorder = false): TableRow {
    const borders = topBorder
      ? { top: { style: BorderStyle.SINGLE, size: 2, color: '000000' }, bottom: summaryBorder.bottom, left: summaryBorder.left, right: summaryBorder.right }
      : { top: noBorders.top, bottom: noBorders.bottom, left: summaryBorder.left, right: summaryBorder.right };
    return new TableRow({
      children: [
        new TableCell({
          borders,
          margins: { left: 100, right: 100, top: 40, bottom: 40 },
          children: [new Paragraph({
            children: [new TextRun({ text: label, font: FONT, size: PT(9), bold: isBold })],
          })],
        }),
        new TableCell({
          borders,
          margins: { left: 100, right: 100, top: 40, bottom: 40 },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: value, font: FONT, size: PT(9), bold: isBold })],
          })],
        }),
      ],
    });
  }

  const totalsTable = new Table({
    width: { size: 45, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      summaryRow('Imponibile (Tasse)', formatEuroFromNumber(calculations.taxable)),
      summaryRow('Imponibile (non sogg. a Tasse)', formatEuroFromNumber(calculations.nonTaxable)),
      summaryRow(`Tasse (${VAT_RATE * 100}%)`, formatEuroFromNumber(calculations.iva)),
      summaryRow('Totale', formatEuroFromNumber(calculations.total), true, true),
    ],
  });

  // 8) Footer: location/data + firma
  const footerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                spacing: { before: 200 },
                children: [new TextRun({ text: data.location, font: FONT, size: PT(13) })],
              }),
              new Paragraph({
                children: [new TextRun({ text: formatDate(data.date), font: FONT, size: PT(9) })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: firmaBuf,
                    transformation: firmaDims,
                    type: 'png',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } },
                children: [new TextRun({
                  text: data.signature,
                  font: FONT, size: PT(8), italics: true, color: '888888',
                })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 9) Componi il documento
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 600, bottom: 500, left: 700, right: 700 },
        },
      },
      children: [
        headerTable,
        titleParagraph,
        subjectTable,
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        ...descriptionParagraphs,
        new Paragraph({ spacing: { after: 100 }, children: [] }),
        servicesTable,
        new Paragraph({ spacing: { after: 100 }, children: [] }),
        // Paragrafo vuoto per spingere totali a destra
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 60 },
          children: [],
        }),
        totalsTable,
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: 'Importi espressi in Euro.', font: FONT, size: PT(8) })],
          alignment: AlignmentType.RIGHT,
        }),
        new Paragraph({ spacing: { after: 400 }, children: [] }),
        footerTable,
      ],
    }],
  });

  // 10) Genera e scarica
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Preventivo_${data.subject?.replace(/\s+/g, '_') || 'Documento'}.docx`);
}
