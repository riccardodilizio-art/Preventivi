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

            // Rimuovi tutte le custom properties oklch dal :root clonato
            // per evitare che html2canvas tenti di parsare oklch()
            const rootStyle = _doc.documentElement.style;
            const rootComputed = _doc.documentElement;
            for (const sheet of Array.from(_doc.styleSheets)) {
              try {
                for (const rule of Array.from(sheet.cssRules)) {
                  if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
                    for (let i = rule.style.length - 1; i >= 0; i--) {
                      const prop = rule.style.item(i);
                      const val = rule.style.getPropertyValue(prop);
                      if (val.includes('oklch')) {
                        rule.style.removeProperty(prop);
                      }
                    }
                  }
                }
              } catch { /* cross-origin sheets, skip */ }
            }

            // Forza colori safe (rgb) sul root
            root.style.setProperty('color', '#000', 'important');
            root.style.setProperty('background', '#fff', 'important');
            root.style.setProperty('background-color', '#fff', 'important');

            // Converte computed style di ogni elemento in valori rgb safe
            const allElements = root.querySelectorAll<HTMLElement>('*');
            allElements.forEach((el) => {
                // getComputedStyle sul documento ORIGINALE per avere valori rgb
                // (il browser converte oklch → rgb automaticamente nel computed)
                const computed = window.getComputedStyle(el);

                // Background: preserva grigi/colorati, rimuovi bianchi
                const bgColor = computed.backgroundColor;
                const isWhiteOrTransparent =
                  !bgColor ||
                  bgColor === 'transparent' ||
                  bgColor === 'rgba(0, 0, 0, 0)' ||
                  bgColor === 'rgb(255, 255, 255)';

                if (isWhiteOrTransparent) {
                  el.style.setProperty('background-color', 'transparent', 'important');
                } else if (bgColor.startsWith('rgb')) {
                  // Forza il valore rgb esplicito (no oklch)
                  el.style.setProperty('background-color', bgColor, 'important');
                } else {
                  el.style.setProperty('background-color', 'transparent', 'important');
                }

                // Testo: preserva grigi, forza nero per il resto
                const textColor = computed.color;
                const isGray = textColor.startsWith('rgb(') &&
                  textColor !== 'rgb(0, 0, 0)' &&
                  textColor !== 'rgb(255, 255, 255)';

                if (isGray) {
                  el.style.setProperty('color', textColor, 'important');
                } else {
                  el.style.setProperty('color', '#000', 'important');
                }

                // Bordi: forza nero con rgb
                el.style.setProperty('border-color', '#000', 'important');
                el.style.setProperty('filter', 'none', 'important');
                el.style.setProperty('text-shadow', 'none', 'important');
            });
        },
    });

    return canvas.toDataURL('image/png');
};

/**
 * Legge le posizioni Y (in px) dei bordi inferiori di ogni [data-pdf-block]
 * relative al contentElement. Questi sono i punti "sicuri" dove tagliare.
 */
function getBlockBreakpoints(contentElement: HTMLElement): number[] {
  const blocks = contentElement.querySelectorAll<HTMLElement>('[data-pdf-block]');
  const containerTop = contentElement.getBoundingClientRect().top;
  const breakpoints: number[] = [];

  blocks.forEach((block) => {
    const rect = block.getBoundingClientRect();
    const bottomPx = rect.bottom - containerTop;
    breakpoints.push(bottomPx);
  });

  return breakpoints;
}

/**
 * Dato un limite massimo in px, trova il breakpoint sicuro più vicino
 * che non supera quel limite. Se nessun breakpoint entra, usa il limite grezzo.
 */
function findSafeBreak(breakpointsPx: number[], maxPx: number, offsetPx: number): number {
  let bestBreak = offsetPx; // fallback: nessun contenuto (non dovrebbe succedere)

  for (const bp of breakpointsPx) {
    if (bp <= offsetPx) continue; // già passato
    if (bp - offsetPx <= maxPx) {
      bestBreak = bp; // questo blocco entra, aggiorna il miglior taglio
    } else {
      break; // il prossimo non entra, fermati
    }
  }

  // Se nessun breakpoint valido trovato, usa il taglio grezzo (fallback sicuro)
  if (bestBreak <= offsetPx) {
    return offsetPx + maxPx;
  }

  return bestBreak;
}

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
  // 1) Leggi i breakpoint PRIMA della cattura (servono le posizioni DOM reali)
  const breakpointsPx = getBlockBreakpoints(contentElement);

  // 2) Cattura immagini
  const headerDataUrl = await captureElement(headerElement);
  const footerDataUrl = await captureElement(footerElement);
  const contentDataUrl = await captureElement(contentElement);

  const headerImg = await loadImage(headerDataUrl);
  const footerImg = await loadImage(footerDataUrl);
  const contentImg = await loadImage(contentDataUrl);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Altezze in mm
  const headerHeightMm = (headerImg.height * pageWidth) / headerImg.width;
  const footerHeightMm = (footerImg.height * pageWidth) / footerImg.width;
  const contentHeightMm = (contentImg.height * pageWidth) / contentImg.width;
  const footerY = pageHeight - footerHeightMm;
  const bottomMargin = 8; // margine inferiore su pagine intermedie

  // Rapporto px DOM → mm e viceversa
  const contentDomHeight = contentElement.scrollHeight;
  const pxToMm = contentHeightMm / contentDomHeight;
  const mmToPx = contentDomHeight / contentHeightMm;

  // Rapporto px canvas → mm (per il taglio dell'immagine)
  const canvasPxPerMm = contentImg.height / contentHeightMm;

  const drawHeader = () => {
    pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeightMm);
  };

  const drawFooter = () => {
    pdf.addImage(footerDataUrl, 'PNG', 0, footerY, pageWidth, footerHeightMm);
  };

  // 3) Pre-calcola le fette usando breakpoint intelligenti
  const slices: { offsetMm: number; sliceMm: number }[] = [];
  {
    let offsetMm = 0;
    const totalMm = contentHeightMm;

    while (offsetMm < totalMm) {
      const startY = headerHeightMm;
      const remaining = totalMm - offsetMm;

      // Spazio con footer (ultima pagina)
      const availableWithFooter = footerY - startY;
      if (remaining <= availableWithFooter) {
        slices.push({ offsetMm, sliceMm: remaining });
        break;
      }

      // Pagina intermedia: spazio senza footer, con margine inferiore per respiro
      const availableIntermediate = pageHeight - startY - bottomMargin;

      // Trova il breakpoint sicuro più vicino
      const offsetPx = offsetMm * mmToPx;
      const maxPx = availableIntermediate * mmToPx;
      const safeCutPx = findSafeBreak(breakpointsPx, maxPx, offsetPx);
      const safeCutMm = safeCutPx * pxToMm;

      // Usa il taglio sicuro, senza superare lo spazio disponibile
      const actualCutMm = Math.min(safeCutMm, offsetMm + availableIntermediate);
      const sliceMm = actualCutMm - offsetMm;

      if (sliceMm <= 0) {
        // Fallback: blocco più grande della pagina, taglia comunque
        slices.push({ offsetMm, sliceMm: availableIntermediate });
        offsetMm += availableIntermediate;
      } else {
        slices.push({ offsetMm, sliceMm });
        offsetMm += sliceMm;
      }
    }
  }

  const totalPages = slices.length;

  // 4) Disegna ogni pagina
  for (let i = 0; i < totalPages; i++) {
    if (i > 0) {
      pdf.addPage();
    }

    const { offsetMm, sliceMm } = slices[i]!;
    const isLastPage = i === totalPages - 1;
    const startY = headerHeightMm;

    drawHeader();
    if (isLastPage) {
      drawFooter();
    }

    // Coordinate sorgente in pixel canvas
    const srcY = offsetMm * canvasPxPerMm;
    const srcH = sliceMm * canvasPxPerMm;

    // Canvas temporaneo per la porzione
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
    pdf.addImage(sliceDataUrl, 'PNG', 0, startY, pageWidth, sliceMm);

    // Cleanup canvas temporaneo
    sliceCanvas.width = 0;
    sliceCanvas.height = 0;
  }

  pdf.save(`Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`);
}
