import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PDF_CONFIG } from '@/constants';
import { loadImage } from '@/utils/image';

/**
 * Cattura un elemento HTML come PNG (dataURL) via html2canvas.
 *
 * Normalizza i colori (oklch → rgb) e rimuove effetti che html2canvas
 * non sa gestire, per ottenere un render fedele e senza artefatti.
 */
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

            // 1) Rimuove custom properties oklch dal :root del clone
            for (const sheet of Array.from(_doc.styleSheets)) {
                try {
                    for (const rule of Array.from(sheet.cssRules)) {
                        if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
                            for (let i = rule.style.length - 1; i >= 0; i--) {
                                const prop = rule.style.item(i);
                                if (rule.style.getPropertyValue(prop).includes('oklch')) {
                                    rule.style.removeProperty(prop);
                                }
                            }
                        }
                    }
                } catch {
                    /* stylesheet cross-origin */
                }
            }

            // 2) Forza sfondo bianco sul root
            root.style.setProperty('color', '#000', 'important');
            root.style.setProperty('background', '#fff', 'important');
            root.style.setProperty('background-color', '#fff', 'important');

            // 3) Normalizza colori di tutti i nodi
            root.querySelectorAll<HTMLElement>('*').forEach((el) => {
                const computed = window.getComputedStyle(el);

                // Sfondo: preserva colori reali (grigi/colorati), rende trasparenti quelli bianchi
                const bgColor = computed.backgroundColor;
                const isWhiteOrTransparent =
                    !bgColor ||
                    bgColor === 'transparent' ||
                    bgColor === 'rgba(0, 0, 0, 0)' ||
                    bgColor === 'rgb(255, 255, 255)';

                if (isWhiteOrTransparent) {
                    el.style.setProperty('background-color', 'transparent', 'important');
                } else if (bgColor.startsWith('rgb')) {
                    el.style.setProperty('background-color', bgColor, 'important');
                } else {
                    el.style.setProperty('background-color', 'transparent', 'important');
                }

                // Testo: preserva il colore computato (è già rgb), forza nero solo se non-rgb
                const textColor = computed.color;
                if (textColor.startsWith('rgb')) {
                    el.style.setProperty('color', textColor, 'important');
                } else {
                    el.style.setProperty('color', '#000', 'important');
                }

                // Bordi neri per visibilità garantita
                el.style.setProperty('border-color', '#000', 'important');

                // Rimuove filtri e ombre che degradano il render
                el.style.setProperty('filter', 'none', 'important');
                el.style.setProperty('box-shadow', 'none', 'important');
                el.style.setProperty('text-shadow', 'none', 'important');
            });
        },
    });

    return canvas.toDataURL('image/png');
};

/**
 * Legge le posizioni Y (px CSS) dei bordi inferiori di ogni [data-pdf-block],
 * relative al TOP del containerElement.
 */
function getBlockBreakpoints(containerElement: HTMLElement, referenceElement: HTMLElement): number[] {
    const blocks = containerElement.querySelectorAll<HTMLElement>('[data-pdf-block]');
    const refTop = referenceElement.getBoundingClientRect().top;
    const breakpoints: number[] = [];

    blocks.forEach((block) => {
        const rect = block.getBoundingClientRect();
        breakpoints.push(rect.bottom - refTop);
    });

    return breakpoints;
}

/**
 * Trova il punto di taglio "sicuro" più vicino che non supera maxPx,
 * partendo da offsetPx. Valori in pixel omogenei (DOM o canvas, purché consistenti).
 */
function findSafeBreak(breakpoints: number[], maxPx: number, offsetPx: number): number {
    let bestBreak = offsetPx;

    for (const bp of breakpoints) {
        if (bp <= offsetPx) continue;
        if (bp - offsetPx <= maxPx) {
            bestBreak = bp;
        } else {
            break;
        }
    }

    return bestBreak <= offsetPx ? offsetPx + maxPx : bestBreak;
}

/**
 * Ritaglia una porzione rettangolare da un HTMLImageElement e la restituisce
 * come canvas. Usato per estrarre header, content-slice e footer dalla
 * singola immagine del documento.
 */
function cropImage(
    img: HTMLImageElement,
    srcX: number,
    srcY: number,
    srcW: number,
    srcH: number,
): HTMLCanvasElement {
    const h = Math.max(1, Math.round(srcH));
    const canvas = document.createElement('canvas');
    canvas.width = srcW;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, h);
    return canvas;
}

function releaseCanvas(canvas: HTMLCanvasElement) {
    canvas.width = 0;
    canvas.height = 0;
}

export interface GeneratePdfParams {
    subject: string;
    /** Wrapper che contiene TUTTO il documento (header + content + footer). */
    documentElement: HTMLElement;
    /** Primo elemento di contenuto: il suo top definisce dove finisce l'header (margini inclusi). */
    contentElement: HTMLElement;
    /** Elemento footer: il suo top definisce dove inizia il footer. */
    footerElement: HTMLElement;
}

/**
 * Genera il PDF del preventivo.
 *
 * Strategia:
 * - Cattura l'intero documento (header + content + footer) come UNA SOLA immagine.
 *   Questo garantisce coerenza di scala e colori su tutti gli elementi.
 * - Ritaglia da quest'unica immagine le tre zone: header, content, footer.
 * - Divide il content in slice (una per pagina) rispettando i [data-pdf-block]
 *   per evitare tagli a metà riga.
 * - PAGINA 1: header + content-slice.
 * - PAGINE SUCCESSIVE: solo content-slice (senza header ripetuto), più spazio utile.
 * - ULTIMA PAGINA: aggiunge il footer ancorato al fondo.
 */
export async function generateQuotePdf({
    subject,
    documentElement,
    contentElement,
    footerElement,
}: GeneratePdfParams): Promise<void> {

    // ------------------------------------------------------------------
    // 1) Misura le posizioni DOM usando i TOP degli elementi adiacenti,
    //    così margini collassati e gap tra siblings sono inclusi.
    //    - header "finisce" dove inizia il contentElement (include mb-10 del box OGGETTO)
    //    - footer "inizia" dove inizia il footerElement
    // ------------------------------------------------------------------
    const docRect     = documentElement.getBoundingClientRect();
    const contentRect = contentElement.getBoundingClientRect();
    const footerRect  = footerElement.getBoundingClientRect();
    const docDomH     = documentElement.scrollHeight;

    const headerEndDomPx   = contentRect.top - docRect.top;
    const footerStartDomPx = footerRect.top  - docRect.top;

    // ------------------------------------------------------------------
    // 2) Breakpoint sicuri relativi al TOP del documentElement (px CSS)
    // ------------------------------------------------------------------
    const breakpointsDomPx = getBlockBreakpoints(contentElement, documentElement);

    // ------------------------------------------------------------------
    // 3) Cattura unica dell'intero documento
    // ------------------------------------------------------------------
    const docDataUrl = await captureElement(documentElement);
    const docImg     = await loadImage(docDataUrl);

    // Fattore di scala canvas px ÷ DOM px
    const scaleY = docImg.height / docDomH;

    // ------------------------------------------------------------------
    // 4) Zone dell'immagine in canvas px
    // ------------------------------------------------------------------
    const headerEndCpx   = Math.round(headerEndDomPx   * scaleY);
    const footerStartCpx = Math.round(footerStartDomPx * scaleY);
    const contentStartCpx = headerEndCpx;
    const contentEndCpx   = footerStartCpx;
    const contentTotalCpx = contentEndCpx - contentStartCpx;

    // Breakpoint del content in canvas px (relativi al contentStartCpx)
    const breakpointsCpx = breakpointsDomPx
        .map(bp => Math.round(bp * scaleY) - contentStartCpx)
        .filter(bp => bp > 0 && bp < contentTotalCpx);

    // ------------------------------------------------------------------
    // 5) Inizializza PDF A4
    // ------------------------------------------------------------------
    const pdf       = new jsPDF('p', 'mm', 'a4');
    const pageW     = pdf.internal.pageSize.getWidth();   // 210 mm
    const pageH     = pdf.internal.pageSize.getHeight();  // 297 mm

    // mm per canvas-pixel (asse X e Y condividono la stessa scala perché
    // l'immagine riempie tutta la larghezza della pagina)
    const mmPerCpx = pageW / docImg.width;

    const headerMm      = headerEndCpx   * mmPerCpx;
    const footerMm      = (docImg.height - footerStartCpx) * mmPerCpx;
    const footerYonPage = pageH - footerMm;     // posizione Y del footer nell'ultima pagina
    const topMargin     = 10;                   // mm di margine superiore sulle pagine senza header
    const bottomMargin  = 8;                    // mm di respiro sulle pagine intermedie

    // ------------------------------------------------------------------
    // 6) Calcola le slice del content (in canvas px)
    //
    //    Pagina 1:       header + content               → spazio = pageH - headerMm - bottomMargin
    //    Pagine 2..N-1:  solo content (no header)        → spazio = pageH - topMargin - bottomMargin
    //    Ultima pagina:  content + footer                → spazio = footerYonPage - topMargin
    //                    (se è anche la prima: footerYonPage - headerMm)
    // ------------------------------------------------------------------
    const slices: { offsetCpx: number; heightCpx: number }[] = [];
    {
        let offsetCpx = 0;

        while (offsetCpx < contentTotalCpx) {
            const remaining  = contentTotalCpx - offsetCpx;
            const isFirstSlice = slices.length === 0;

            // Margine superiore: header sulla prima pagina, topMargin sulle successive
            const sliceTopMm = isFirstSlice ? headerMm : topMargin;

            // Spazio che resterebbe se questa fosse l'ultima pagina (con footer)
            const availLastMm  = footerYonPage - sliceTopMm;
            const availLastCpx = Math.round(availLastMm / mmPerCpx);

            // Se il contenuto rimanente entra nell'ultima pagina (con footer), chiudi
            if (remaining <= availLastCpx) {
                slices.push({ offsetCpx, heightCpx: remaining });
                break;
            }

            // Pagina intermedia: spazio fino al fondo meno margine
            const availMidMm  = pageH - sliceTopMm - bottomMargin;
            const availMidCpx = Math.round(availMidMm / mmPerCpx);

            const safeCutCpx   = findSafeBreak(breakpointsCpx, availMidCpx, offsetCpx);
            let actualCutCpx   = Math.min(safeCutCpx, offsetCpx + availMidCpx);

            // Se questa slice consumerebbe TUTTO il contenuto rimanente,
            // la pagina diventerebbe l'ultima e servirebbe spazio per il footer.
            // Ricalcola il taglio con lo spazio dell'ultima pagina.
            if (actualCutCpx >= contentTotalCpx) {
                const safeLastCut = findSafeBreak(breakpointsCpx, availLastCpx, offsetCpx);
                actualCutCpx      = Math.min(safeLastCut, offsetCpx + availLastCpx);
            }

            const sliceHeightCpx = actualCutCpx - offsetCpx;

            if (sliceHeightCpx <= 0) {
                slices.push({ offsetCpx, heightCpx: availMidCpx });
                offsetCpx += availMidCpx;
            } else {
                slices.push({ offsetCpx, heightCpx: sliceHeightCpx });
                offsetCpx += sliceHeightCpx;
            }
        }
    }

    const totalPages = slices.length;

    // ------------------------------------------------------------------
    // 7) Render pagina per pagina
    //    - Pagina 1: header + content
    //    - Pagine successive: solo content (con topMargin)
    //    - Ultima pagina: + footer ancorato al fondo
    // ------------------------------------------------------------------
    for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();

        const { offsetCpx, heightCpx } = slices[i]!;
        const isFirstPage = i === 0;
        const isLastPage  = i === totalPages - 1;

        // Y dove inizia il contenuto su questa pagina
        let contentYmm: number;

        if (isFirstPage) {
            // --- Header solo sulla prima pagina ---
            const headerCanvas = cropImage(docImg, 0, 0, docImg.width, headerEndCpx);
            pdf.addImage(headerCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, headerMm);
            releaseCanvas(headerCanvas);
            contentYmm = headerMm;
        } else {
            contentYmm = topMargin;
        }

        // --- Content slice ---
        const srcY         = contentStartCpx + offsetCpx;
        const sliceMm      = heightCpx * mmPerCpx;
        const sliceCanvas  = cropImage(docImg, 0, srcY, docImg.width, heightCpx);
        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, contentYmm, pageW, sliceMm);
        releaseCanvas(sliceCanvas);

        // --- Footer (solo sull'ultima pagina, ancorato al fondo) ---
        if (isLastPage) {
            const footerHeightCpx = docImg.height - footerStartCpx;
            const footerCanvas    = cropImage(docImg, 0, footerStartCpx, docImg.width, footerHeightCpx);
            pdf.addImage(footerCanvas.toDataURL('image/png'), 'PNG', 0, footerYonPage, pageW, footerMm);
            releaseCanvas(footerCanvas);
        }
    }

    // ------------------------------------------------------------------
    // 8) Salva il PDF
    // ------------------------------------------------------------------
    pdf.save(`Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`);
}
