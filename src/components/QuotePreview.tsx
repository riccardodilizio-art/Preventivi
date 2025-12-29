import { useRef } from 'react';
import { QuoteData } from '../types/quote';
import { ArrowLeft, Download } from 'lucide-react';
import logo from '../image/logo.png';
import firma from '../image/firma.png';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface QuotePreviewProps {
    data: QuoteData;
    onBack: () => void;
}

export function QuotePreview({ data, onBack }: QuotePreviewProps) {
    const previewRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const parseItalianNumber = (raw: string) => {
        const cleaned = String(raw ?? '').replace(/[^\d.,]/g, '').trim();
        if (!cleaned) return null;
        const normalized = cleaned.replace(/\./g, '').replace(',', '.');
        const n = Number(normalized);
        return Number.isFinite(n) ? n : null;
    };

    const formatEuroFromNumber = (n: number) =>
        n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

    const formatEuro = (raw: string) => {
        const n = parseItalianNumber(raw);
        if (n === null) return raw;
        return formatEuroFromNumber(n);
    };

    const VAT_RATE = 0.2;
    const sums = (data.services ?? []).reduce(
        (acc, s) => {
            const amount = parseItalianNumber(s.cost || '') ?? 0;
            const applyVat = s.vat === true;
            if (applyVat) acc.taxable += amount;
            else acc.nonTaxable += amount;
            return acc;
        },
        { taxable: 0, nonTaxable: 0 }
    );

    const imponibileIva = sums.taxable;
    const imponibileNoIva = sums.nonTaxable;
    const iva = imponibileIva * VAT_RATE;
    const totaleConIva = imponibileIva + imponibileNoIva + iva;

    const handleDownloadPdf = async () => {
        if (!headerRef.current || !contentRef.current || !footerRef.current) return;

        const header = headerRef.current;
        const content = contentRef.current;
        const footer = footerRef.current;

        // Cattura intestazione separatamente
        const headerDataUrl = await toPng(header, {
            cacheBust: true,
            pixelRatio: 2.5,
            backgroundColor: '#ffffff',
        });

        // Cattura contenuto
        content.classList.add('pdf-export');
        const contentDataUrl = await toPng(content, {
            cacheBust: true,
            pixelRatio: 2.5,
            backgroundColor: '#ffffff',
        });
        content.classList.remove('pdf-export');

        // Cattura footer
        const footerDataUrl = await toPng(footer, {
            cacheBust: true,
            pixelRatio: 2.5,
            backgroundColor: '#ffffff',
        });

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // Carica le immagini
            const headerImg = new Image();
            headerImg.src = headerDataUrl;
            await new Promise((res, rej) => {
                headerImg.onload = () => res(true);
                headerImg.onerror = rej;
            });

            const contentImg = new Image();
            contentImg.src = contentDataUrl;
            await new Promise((res, rej) => {
                contentImg.onload = () => res(true);
                contentImg.onerror = rej;
            });

            const footerImg = new Image();
            footerImg.src = footerDataUrl;
            await new Promise((res, rej) => {
                footerImg.onload = () => res(true);
                footerImg.onerror = rej;
            });

            // Calcola dimensioni in mm
            const headerHeight = (headerImg.height * pageWidth) / headerImg.width;
            const contentHeight = (contentImg.height * pageWidth) / contentImg.width;
            const footerHeight = (footerImg.height * pageWidth) / footerImg.width;

            // Spazio disponibile per contenuto per pagina (escludendo header)
            const availableContentHeight = pageHeight - headerHeight - 10; // 10mm di margine

            let currentContentY = 0;
            let isFirstPage = true;

            while (currentContentY < contentHeight) {
                if (!isFirstPage) {
                    pdf.addPage();
                }

                // Aggiungi header in ogni pagina
                pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeight);

                // Calcola quanto contenuto mostrare in questa pagina
                const remainingContent = contentHeight - currentContentY;
                const contentHeightInThisPage = Math.min(remainingContent, availableContentHeight);

                // Aggiungi porzione di contenuto
                if (remainingContent > 0) {
                    pdf.addImage(
                        contentDataUrl,
                        'PNG',
                        0,
                        headerHeight + 5,
                        pageWidth,
                        contentHeight,
                        undefined,
                        'NONE',
                        -currentContentY
                    );
                }

                currentContentY += availableContentHeight;
                isFirstPage = false;

                // Se siamo all'ultima pagina e c'è spazio, aggiungi il footer
                if (currentContentY >= contentHeight) {
                    const footerY = headerHeight + 5 + contentHeightInThisPage + 5;

                    // Controlla se il footer ci sta in questa pagina
                    if (footerY + footerHeight > pageHeight) {
                        // Footer non ci sta, crea nuova pagina
                        pdf.addPage();
                        pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeight);
                        pdf.addImage(footerDataUrl, 'PNG', 0, headerHeight + 5, pageWidth, footerHeight);
                    } else {
                        // Footer ci sta in questa pagina
                        pdf.addImage(footerDataUrl, 'PNG', 0, footerY, pageWidth, footerHeight);
                    }
                }
            }

            pdf.save('Preventivo.pdf');
            console.log('✅ PDF salvato con successo');
        } catch (error) {
            console.error('❌ Errore durante la generazione del PDF:', error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Toolbar */}
            <div className="bg-white shadow-md p-4 print:hidden sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Modifica Preventivo
                    </button>

                    <button
                        onClick={handleDownloadPdf}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
                    >
                        <Download className="w-5 h-5" />
                        Scarica PDF
                    </button>
                </div>
            </div>

            {/* Preview */}
            <div className="max-w-4xl mx-auto p-6">
                <div ref={previewRef} className="bg-white shadow-lg">
                    {/* ✅ HEADER - Verrà ripetuto su ogni pagina */}
                    <div ref={headerRef} className="p-10 pb-0">
                        <div className="flex justify-between items-start gap-6 mb-10">
                            <img src={logo} alt="Logo azienda" className="w-56 max-h-24 object-contain" />

                            <div className="text-right space-y-1 text-[15px] leading-relaxed">
                                <p className="font-semibold text-base">{data.companyName}</p>
                                <p>{data.companyAddress}</p>
                                <p>{data.companyCity}</p>
                                <p className="text-sm">C.F. {data.taxCode}</p>
                                <p className="text-sm">P. IVA {data.vatNumber}</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-xl font-bold tracking-wide">PREVENTIVO</p>
                        </div>

                        <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                            <p className="font-bold uppercase tracking-wide">
                                OGGETTO: <span className="normal-case">{data.subject}</span>
                            </p>
                        </div>
                    </div>

                    {/* ✅ CONTENUTO - Può estendersi su più pagine */}
                    <div ref={contentRef} className="px-10">
                        <div className="my-6">
                            <p className="whitespace-pre-line">{data.serviceDescription}</p>
                        </div>

                        {/* Tabella servizi */}
                        {data.services?.length > 0 && (
                            <div className="my-8">
                                <div className="flex justify-between text-sm font-medium text-black border-b-2 border-black pb-2">
                                    <p>Servizio</p>
                                    <p className="w-40 text-right">Costo</p>
                                </div>

                                <div className="border-b border-black">
                                    {data.services.map((service, index) => (
                                        <div
                                            key={index}
                                            className="flex justify-between items-start gap-6 py-3 border-t border-black"
                                        >
                                            <p className="font-bold flex-1 text-black">{service.description}</p>

                                            <div className="w-40 text-right whitespace-nowrap">
                                                <p className="font-bold text-black">
                                                    {service.cost?.trim() ? formatEuro(service.cost) : ''}
                                                </p>
                                                <p className="text-xs text-black">
                                                    {service.vat ? 'Soggetto a Tasse' : 'Non soggetto a Tasse'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Totali */}
                        <div className="mt-7 flex justify-end">
                            <div className="rounded-lg border border-black px-5 py-10 min-w-[350px] overflow-hidden">
                                <div className="flex justify-between text-sm">
                                    <span>Imponibile (Tasse)</span>
                                    <span className="font-medium">{formatEuroFromNumber(imponibileIva)}</span>
                                </div>

                                <div className="flex justify-between text-sm mt-2">
                                    <span>Imponibile (non soggetto a Tasse)</span>
                                    <span className="font-medium">{formatEuroFromNumber(imponibileNoIva)}</span>
                                </div>

                                <div className="flex justify-between text-sm mt-2">
                                    <span>Tasse (20%)</span>
                                    <span className="font-medium">{formatEuroFromNumber(iva)}</span>
                                </div>

                                <div className="flex justify-between mt-3 pt-3 border-t border-black">
                                    <span className="font-bold">Totale</span>
                                    <span className="font-bold">{formatEuroFromNumber(totaleConIva)}</span>
                                </div>

                                <p className="text-xs mt-3">Importi espressi in Euro.</p>

                                {/* forza chiusura box nel PDF */}
                                <div className="h-px bg-black mt-1 opacity-0" />
                            </div>
                        </div>
                        {/* spacer SOLO per export PDF (fuori dal box) */}
                        <div className="pdf-bottom-space" />

                    </div>



                    {/* ✅ FOOTER - Sempre alla fine */}
                    <div ref={footerRef} className="px-10 pt-10 pb-10">
                        <div className="flex justify-between items-end">
                            <div className="text-xl leading-relaxed">
                                <p className="font-medium">{data.location}</p>
                                <p className="text-sm">{formatDate(data.date)}</p>
                            </div>

                            <div className="relative min-w-[240px] h-[110px] text-center">
                                <div className="absolute bottom-0 left-0 right-0 border-t-2 border-black" />
                                <span className="absolute inset-0 flex items-center justify-center translate-y-6 text-sm italic text-gray-600 z-10">
                                    {data.signature}
                                </span>
                                <img
                                    src={firma}
                                    alt="Firma"
                                    className="absolute inset-0 m-auto max-h-20 w-auto object-contain z-20"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
