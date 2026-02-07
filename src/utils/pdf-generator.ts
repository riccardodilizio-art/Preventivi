import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PDF_CONFIG } from '@/constants';
import { loadImage } from '@/utils/image';

/**
 * Converte un elemento HTML in PNG (dataURL) usando html2canvas.
 *
 * Obiettivo: ottenere un'immagine “stampabile” (testo nero, bordi visibili)
 * anche quando il CSS del progetto usa funzioni colore non supportate da html2canvas
 * (es. Tailwind v4 usa spesso oklch()).
 *
 * NOTE IMPORTANTI:
 * - html2canvas crea un "clone" del DOM per renderizzare. La callback `onclone`
 *   ti permette di modificare il clone prima del rendering.
 * - Qui cerchiamo di evitare che html2canvas provi a parsare `oklch(...)`,
 *   che altrimenti genera errori e può produrre render incompleti/bianco.
 */
const captureElement = async (element: HTMLElement): Promise<string> => {
    const canvas = await html2canvas(element, {
        // Aumenta la risoluzione dell'immagine (più nitida ma più pesante)
        scale: PDF_CONFIG.PIXEL_RATIO,

        // Sfondo bianco (evita trasparenze nel PNG finale)
        backgroundColor: '#ffffff',

        // Permette di includere immagini esterne (logo/firma) se CORS è configurato
        useCORS: true,

        // Disattiva log verbose
        logging: false,

        // Evita che la posizione di scroll influenzi la cattura
        scrollY: 0,
        scrollX: 0,

        /**
         * Forza la dimensione catturata: fondamentale se l'elemento è scrollabile
         * o più grande della viewport.
         *
         * - scrollWidth/scrollHeight = dimensioni complete del contenuto
         * - windowWidth/windowHeight = dimensioni della “finestra virtuale” che html2canvas usa
         */
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,

        /**
         * Modifica il DOM CLONATO prima che html2canvas lo renderizzi.
         * Qui:
         * 1) rimuoviamo custom properties in :root contenenti "oklch"
         * 2) forziamo colori "safe" (rgb/hex) per testo, sfondi e bordi
         * 3) rimuoviamo filtri/ombre che spesso degradano la resa su canvas
         */
        onclone: (_doc, clonedEl) => {
            const root = clonedEl as HTMLElement;

            // ------------------------------------------------------------
            // 1) Rimuove custom properties contenenti "oklch" dal :root clonato
            // ------------------------------------------------------------
            // Motivo:
            // - html2canvas 1.x non gestisce sempre le funzioni colore moderne (oklch()).
            // - Tailwind v4 usa variabili CSS e spesso oklch() nelle custom properties.
            // - Se html2canvas incontra oklch() può fallire o renderizzare male.
            //
            // Strategia:
            // - scansioniamo i fogli di stile nel documento clonato
            // - cerchiamo la regola :root
            // - rimuoviamo tutte le proprietà che nel value contengono "oklch"
            //
            // Nota:
            // - alcuni stylesheet possono essere cross-origin -> leggere cssRules lancia eccezione
            //   (per questo c'è il try/catch).
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
                } catch {
                    /* stylesheet cross-origin, lo ignoriamo */
                }
            }

            // ------------------------------------------------------------
            // 2) Forza colori "sicuri" sul root (testo nero, sfondo bianco)
            // ------------------------------------------------------------
            // Questo stabilizza la resa del PDF (soprattutto su temi scuri o variabili).
            root.style.setProperty('color', '#000', 'important');
            root.style.setProperty('background', '#fff', 'important');
            root.style.setProperty('background-color', '#fff', 'important');

            // ------------------------------------------------------------
            // 3) Normalizza i colori di TUTTI i nodi nel clone
            // ------------------------------------------------------------
            // Scopo:
            // - html2canvas ha problemi quando deve interpretare funzioni colore moderne.
            // - Il browser, invece, converte le variabili/oklch in colori "computed"
            //   in formato rgb/rgba.
            //
            // ATTENZIONE:
            // Qui stai chiamando getComputedStyle SUL CLONE (el).
            // Spesso funziona comunque, ma se vuoi essere più rigoroso dovresti leggere
            // dal DOM originale e applicare al clone in parallelo.
            const allElements = root.querySelectorAll<HTMLElement>('*');

            allElements.forEach((el) => {
                const computed = window.getComputedStyle(el);

                // ---------- BACKGROUND ----------
                // Manteniamo background "veri" (grigi/colored) e rendiamo trasparenti
                // quelli bianchi o trasparenti per evitare “blocchi” bianchi inutili.
                const bgColor = computed.backgroundColor;

                const isWhiteOrTransparent =
                    !bgColor ||
                    bgColor === 'transparent' ||
                    bgColor === 'rgba(0, 0, 0, 0)' ||
                    bgColor === 'rgb(255, 255, 255)';

                if (isWhiteOrTransparent) {
                    el.style.setProperty('background-color', 'transparent', 'important');
                } else if (bgColor.startsWith('rgb')) {
                    // Forza un rgb esplicito (html2canvas lo digerisce bene)
                    el.style.setProperty('background-color', bgColor, 'important');
                } else {
                    // Se non è rgb (caso raro), fallback trasparente
                    el.style.setProperty('background-color', 'transparent', 'important');
                }

                // ---------- TEXT COLOR ----------
                // Preserviamo i grigi (utile per testo secondario).
                // Se non è un grigio "sensato", forziamo nero per leggibilità.
                const textColor = computed.color;

                const isGray =
                    textColor.startsWith('rgb(') &&
                    textColor !== 'rgb(0, 0, 0)' &&
                    textColor !== 'rgb(255, 255, 255)';

                if (isGray) {
                    el.style.setProperty('color', textColor, 'important');
                } else {
                    el.style.setProperty('color', '#000', 'important');
                }

                // ---------- BORDERS ----------
                // Forziamo bordi neri per garantire separazioni visibili nel PDF.
                el.style.setProperty('border-color', '#000', 'important');

                // ---------- CLEANUP EFFECTS ----------
                // Filtri e ombre possono degradare l'immagine o creare artefatti.
                el.style.setProperty('filter', 'none', 'important');
                el.style.setProperty('text-shadow', 'none', 'important');
            });
        },
    });

    // Converte il canvas in PNG (base64 data URL)
    return canvas.toDataURL('image/png');
};

/**
 * Legge le posizioni Y (in px) dei bordi inferiori di ogni [data-pdf-block]
 * relative al contentElement.
 *
 * Idea:
 * - Se devi “spezzare” un contenuto lungo su più pagine,
 *   non vuoi tagliare a metà un blocco (es: una riga tabella o un box totali).
 * - Quindi marchi nel DOM dei blocchi “atomici” con `data-pdf-block`
 * - Qui calcoli i “punti sicuri” dove puoi interrompere.
 */
function getBlockBreakpoints(contentElement: HTMLElement): number[] {
    const blocks = contentElement.querySelectorAll<HTMLElement>('[data-pdf-block]');
    const containerTop = contentElement.getBoundingClientRect().top;
    const breakpoints: number[] = [];

    blocks.forEach((block) => {
        const rect = block.getBoundingClientRect();

        // bottom relativo al contenitore (in px)
        const bottomPx = rect.bottom - containerTop;
        breakpoints.push(bottomPx);
    });

    return breakpoints;
}

/**
 * Dato un limite massimo in px (maxPx), trova il breakpoint “sicuro” più vicino
 * che non supera quel limite, a partire da un offset iniziale (offsetPx).
 *
 * - breakpointsPx: lista di y-bottom “sicuri” (ordinati in base al DOM)
 * - maxPx: quanto contenuto possiamo mettere nella pagina (in px)
 * - offsetPx: dove siamo arrivati con il taglio precedente (in px)
 */
function findSafeBreak(breakpointsPx: number[], maxPx: number, offsetPx: number): number {
    // fallback: se non troviamo breakpoint useremo un taglio grezzo
    let bestBreak = offsetPx;

    for (const bp of breakpointsPx) {
        if (bp <= offsetPx) continue; // breakpoint già superato
        if (bp - offsetPx <= maxPx) {
            // questo breakpoint entra nella pagina corrente
            bestBreak = bp;
        } else {
            // il prossimo non entra -> stop
            break;
        }
    }

    // Se non abbiamo trovato un breakpoint utile, taglia “a misura”
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

/**
 * Genera il PDF:
 * - cattura header/footer/content come immagini PNG (via html2canvas)
 * - calcola come spezzare il content su più pagine evitando tagli brutti
 * - disegna le porzioni del content su ogni pagina del PDF
 */
export async function generateQuotePdf({
                                           subject,
                                           headerElement,
                                           footerElement,
                                           contentElement,
                                       }: GeneratePdfParams): Promise<void> {
    // ------------------------------------------------------------
    // 1) breakpoint “sicuri” PRIMA della cattura (servono le posizioni reali nel DOM)
    // ------------------------------------------------------------
    const breakpointsPx = getBlockBreakpoints(contentElement);

    // ------------------------------------------------------------
    // 2) cattura gli elementi come PNG (dataUrl)
    // ------------------------------------------------------------
    const headerDataUrl = await captureElement(headerElement);
    const footerDataUrl = await captureElement(footerElement);
    const contentDataUrl = await captureElement(contentElement);

    // Converti dataUrl in oggetti Image per leggere width/height
    const headerImg = await loadImage(headerDataUrl);
    const footerImg = await loadImage(footerDataUrl);
    const contentImg = await loadImage(contentDataUrl);

    // ------------------------------------------------------------
    // 3) inizializza PDF A4 verticale in millimetri
    // ------------------------------------------------------------
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // ------------------------------------------------------------
    // 4) calcola altezze in mm (manteniamo proporzioni)
    // ------------------------------------------------------------
    const headerHeightMm = (headerImg.height * pageWidth) / headerImg.width;
    const footerHeightMm = (footerImg.height * pageWidth) / footerImg.width;
    const contentHeightMm = (contentImg.height * pageWidth) / contentImg.width;

    // posizione Y dove inizia il footer
    const footerY = pageHeight - footerHeightMm;

    // margine inferiore “di respiro” sulle pagine intermedie (dove non metti il footer)
    const bottomMargin = 8;

    // ------------------------------------------------------------
    // 5) conversioni px<->mm per allineare tagli DOM e tagli immagine
    // ------------------------------------------------------------
    // Altezza del contenuto nel DOM (px)
    const contentDomHeight = contentElement.scrollHeight;

    // pxToMm: quanti mm corrispondono a 1px (in base al contenuto catturato)
    const pxToMm = contentHeightMm / contentDomHeight;

    // mmToPx: quanti px corrispondono a 1mm
    const mmToPx = contentDomHeight / contentHeightMm;

    // canvasPxPerMm: quanti pixel di immagine (contentImg.height) corrispondono a 1mm
    const canvasPxPerMm = contentImg.height / contentHeightMm;

    // helper: disegna header/footer su una pagina
    const drawHeader = () => {
        pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeightMm);
    };

    const drawFooter = () => {
        pdf.addImage(footerDataUrl, 'PNG', 0, footerY, pageWidth, footerHeightMm);
    };

    // ------------------------------------------------------------
    // 6) pre-calcola le “slice” (porzioni del content) da mettere per pagina
    // ------------------------------------------------------------
    // slices = lista di (offsetMm, sliceMm) cioè:
    // - offsetMm: quanto contenuto (in mm) abbiamo già “consumato” dall’inizio
    // - sliceMm: quanto contenuto (in mm) mettiamo in questa pagina
    const slices: { offsetMm: number; sliceMm: number }[] = [];
    {
        let offsetMm = 0;
        const totalMm = contentHeightMm;

        while (offsetMm < totalMm) {
            // Il contenuto parte sempre sotto l'header
            const startY = headerHeightMm;
            const remaining = totalMm - offsetMm;

            // Caso 1: siamo nell'ultima pagina -> consideriamo spazio fino al footer
            const availableWithFooter = footerY - startY;
            if (remaining <= availableWithFooter) {
                slices.push({ offsetMm, sliceMm: remaining });
                break;
            }

            // Caso 2: pagina intermedia -> spazio fino al fondo pagina (meno un margine)
            const availableIntermediate = pageHeight - startY - bottomMargin;

            // Converti offset e capienza pagina in px DOM per cercare breakpoint sicuro
            const offsetPx = offsetMm * mmToPx;
            const maxPx = availableIntermediate * mmToPx;

            const safeCutPx = findSafeBreak(breakpointsPx, maxPx, offsetPx);
            const safeCutMm = safeCutPx * pxToMm;

            // Evita di superare la capienza della pagina intermedia
            const actualCutMm = Math.min(safeCutMm, offsetMm + availableIntermediate);
            const sliceMm = actualCutMm - offsetMm;

            if (sliceMm <= 0) {
                // Fallback: se un blocco è più alto di una pagina, taglia comunque “a misura”
                slices.push({ offsetMm, sliceMm: availableIntermediate });
                offsetMm += availableIntermediate;
            } else {
                slices.push({ offsetMm, sliceMm });
                offsetMm += sliceMm;
            }
        }
    }

    const totalPages = slices.length;

    // ------------------------------------------------------------
    // 7) render pagina per pagina: disegna header/footer e la porzione corretta del content
    // ------------------------------------------------------------
    for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();

        const { offsetMm, sliceMm } = slices[i]!;
        const isLastPage = i === totalPages - 1;
        const startY = headerHeightMm;

        // Header sempre
        drawHeader();

        // Footer SOLO nell'ultima pagina (scelta progettuale)
        // Se vuoi footer su tutte le pagine, basta chiamare drawFooter() sempre.
        if (isLastPage) {
            drawFooter();
        }

        // offsetMm/sliceMm (mm) -> srcY/srcH (pixel dell'immagine contentImg)
        const srcY = offsetMm * canvasPxPerMm;
        const srcH = sliceMm * canvasPxPerMm;

        // Crea canvas temporaneo per estrarre solo la porzione (crop) dell'immagine grande
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = contentImg.width;
        sliceCanvas.height = Math.max(1, Math.round(srcH));

        const ctx = sliceCanvas.getContext('2d')!;

        // Copia la porzione (0,srcY)-(width,srcY+srcH) dentro sliceCanvas
        ctx.drawImage(
            contentImg,
            0,
            srcY,
            contentImg.width,
            srcH,
            0,
            0,
            contentImg.width,
            Math.round(srcH),
        );

        // Converte la porzione in PNG e la disegna nel PDF
        const sliceDataUrl = sliceCanvas.toDataURL('image/png');
        pdf.addImage(sliceDataUrl, 'PNG', 0, startY, pageWidth, sliceMm);

        // Cleanup (facoltativo, ma aiuta a ridurre memoria)
        sliceCanvas.width = 0;
        sliceCanvas.height = 0;
    }

    // ------------------------------------------------------------
    // 8) salva il PDF
    // ------------------------------------------------------------
    pdf.save(`Preventivo_${subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`);
}
