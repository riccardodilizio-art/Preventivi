import { useRef, useState, useMemo } from 'react';
import { QuoteData } from '../types/quote';
import { ArrowLeft, Download, Loader } from 'lucide-react';
import logo from '../image/logo.png';
import firma from '../image/firma.png';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ========== COSTANTI ==========
const PDF_CONFIG = {
    PIXEL_RATIO: 2.5,
    BACKGROUND_COLOR: '#ffffff',
    PAGE_MARGIN: 15,
    HEADER_HEIGHT: 60, // Altezza header in mm
    FOOTER_HEIGHT: 40, // Altezza footer in mm
} as const;

const LOCALE_CONFIG = {
    DATE: 'it-IT',
    CURRENCY: 'EUR',
} as const;

const VAT_RATE = 0.2;

// ========== TYPES ==========
interface QuotePreviewProps {
    data: QuoteData;
    onBack: () => void;
}

interface Service {
    description: string;
    cost?: string;
    vat?: boolean;
    subservices?: { description: string }[];
}


interface Calculations {
    taxable: number;
    nonTaxable: number;
    iva: number;
    total: number;
}

// ========== UTILITY FUNCTIONS ==========
const parseItalianNumber = (raw?: string): number | null => {
    if (!raw) return null;
    const cleaned = String(raw).replace(/[^\d.,-]/g, '').trim();
    if (!cleaned) return null;

    // se ci sono più "-" tieni solo il primo all'inizio
    const sign = cleaned.startsWith('-') ? '-' : '';
    const unsigned = cleaned.replace(/-/g, '');

    const normalized = unsigned.replace(/\./g, '').replace(',', '.');
    const n = Number(sign + normalized);
    return Number.isFinite(n) ? n : null;
};




const formatEuroFromNumber = (n: number): string =>
    n.toLocaleString('it-IT', {
        style: 'currency',
        currency: 'EUR',
    });



const formatEuro = (raw?: string): string => {
    if (!raw?.trim()) return ''; // invece di € 0,00
    const n = parseItalianNumber(raw);
    return n !== null ? formatEuroFromNumber(n) : raw;
};


const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(LOCALE_CONFIG.DATE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

const loadImage = (dataUrl: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Errore caricamento immagine'));
        img.src = dataUrl;
    });
};

// ========== CUSTOM HOOK ==========
const useQuoteCalculations = (services: Service[] = []): Calculations => {
    return useMemo(() => {
        const sums = services.reduce(
            (acc, s) => {
                const amount = parseItalianNumber(s.cost) ?? 0;
                s.vat ? (acc.taxable += amount) : (acc.nonTaxable += amount);
                return acc;
            },
            { taxable: 0, nonTaxable: 0 }
        );

        const iva = sums.taxable * VAT_RATE;
        const total = sums.taxable + sums.nonTaxable + iva;

        return {
            taxable: sums.taxable,
            nonTaxable: sums.nonTaxable,
            iva,
            total,
        };
    }, [services]);
};

// ========== SUB-COMPONENTS ==========
const ServiceRow = ({ service }: { service: Service }) => (
    <div className="py-3 border-t border-black">
        <div className="flex justify-between items-start gap-6">
            <p className="font-bold flex-1 text-black">{service.description}</p>

            <div className="w-40 text-right whitespace-nowrap">
                <p className="font-bold text-black">{formatEuro(service.cost)}</p>
                <p className="text-xs text-black">
                    {service.vat ? 'Soggetto a Tasse' : 'Non soggetto a Tasse'}
                </p>
            </div>
        </div>

        {service.subservices?.length ? (
            <ul className="ml-6 mt-2 list-disc text-sm text-black space-y-1">
                {service.subservices.map((sub, i) => (
                    <li key={i}>{sub.description}</li>
                ))}
            </ul>
        ) : null}
    </div>
);


const TotalsSummary = ({ calculations }: { calculations: Calculations }) => (
    <div className="mt-7 flex justify-end">
        <div className="rounded-lg border border-black px-5 py-10 min-w-[350px] overflow-hidden">
            <div className="flex justify-between text-sm">
                <span>Imponibile (Tasse)</span>
                <span className="font-medium">{formatEuroFromNumber(calculations.taxable)}</span>
            </div>

            <div className="flex justify-between text-sm mt-2">
                <span>Imponibile (non soggetto a Tasse)</span>
                <span className="font-medium">{formatEuroFromNumber(calculations.nonTaxable)}</span>
            </div>

            <div className="flex justify-between text-sm mt-2">
                <span>Tasse (20%)</span>
                <span className="font-medium">{formatEuroFromNumber(calculations.iva)}</span>
            </div>

            <div className="flex justify-between mt-3 pt-3 border-t border-black">
                <span className="font-bold">Totale</span>
                <span className="font-bold">{formatEuroFromNumber(calculations.total)}</span>
            </div>

            <p className="text-xs mt-3">Importi espressi in Euro.</p>
        </div>
    </div>
);

const QuoteHeader = ({ data }: { data: QuoteData }) => (
    <div className="p-10 pb-0">
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
);

const QuoteContent = ({
                          data,
                          calculations,
                      }: {
    data: QuoteData;
    calculations: Calculations;
}) => (
    <div className="px-10">
        <div className="my-6">
            <p className="whitespace-pre-line">{data.serviceDescription}</p>
        </div>

        {data.services?.length > 0 && (
            <div className="my-8">
                <div className="flex justify-between text-sm font-medium text-black border-b-2 border-black pb-2">
                    <p>Servizio</p>
                    <p className="w-40 text-right">Costo</p>
                </div>

                <div className="border-b border-black">
                    {data.services.map((service, index) => (
                        <ServiceRow key={index} service={service} />
                    ))}
                </div>
            </div>
        )}

        <TotalsSummary calculations={calculations} />
    </div>
);

const QuoteFooter = ({ data }: { data: QuoteData }) => (
    <div className="px-10 pt-10 pb-10">
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
);

// ========== MAIN COMPONENT ==========
export function QuotePreview({ data, onBack }: QuotePreviewProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const headerRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);

    const calculations = useQuoteCalculations(data.services);

    const captureElement = async (element: HTMLElement): Promise<string> => {
        return await toPng(element, {
            cacheBust: true,
            pixelRatio: PDF_CONFIG.PIXEL_RATIO,
            backgroundColor: PDF_CONFIG.BACKGROUND_COLOR,
        });
    };

    const handleDownloadPdf = async () => {
        if (!headerRef.current || !footerRef.current) {
            alert('Errore: elementi non pronti per la generazione del PDF');
            return;
        }

        setIsGenerating(true);

        try {
            const [headerDataUrl, footerDataUrl] = await Promise.all([
                captureElement(headerRef.current),
                captureElement(footerRef.current),
            ]);

            const [headerImg, footerImg] = await Promise.all([
                loadImage(headerDataUrl),
                loadImage(footerDataUrl),
            ]);

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // Header/footer heights (mm)
            const maxHeaderHeight = 60;
            const computedHeaderHeight = (headerImg.height * pageWidth) / headerImg.width;
            const headerHeight = Math.min(computedHeaderHeight, maxHeaderHeight);
            const footerHeight = (footerImg.height * pageWidth) / footerImg.width;

            const paddingX = 20;
            const paddingY = 10;

            const topY = headerHeight + paddingY;
            const bottomY = pageHeight - footerHeight - paddingY;

            const addHeaderFooter = () => {
                pdf.addImage(headerDataUrl, 'PNG', 0, 0, pageWidth, headerHeight);
                const footerY = pageHeight - footerHeight;
                pdf.addImage(footerDataUrl, 'PNG', 0, footerY, pageWidth, footerHeight);
            };

            const newPage = () => {
                pdf.addPage();
                addHeaderFooter();
                return topY;
            };

            // Prima pagina
            addHeaderFooter();
            let currentY = topY;

            // ====== 1) DESCRIZIONE MULTI-PAGINA ======
            if (data.serviceDescription?.trim()) {
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');

                const lineHeight = 5; // mm
                const lines = pdf.splitTextToSize(
                    data.serviceDescription,
                    pageWidth - paddingX * 2
                );

                for (const line of lines) {
                    if (currentY + lineHeight > bottomY) {
                        currentY = newPage();
                    }
                    pdf.text(String(line), paddingX, currentY);
                    currentY += lineHeight;
                }

                currentY += 6; // spazio dopo descrizione
            }

            // ====== 2) TABELLA SERVIZI (AUTO-SPLIT) ======
            if (data.services?.length) {
                const tableData = (data.services || []).flatMap((service) => {
                    const mainRow = [
                        service.description,
                        formatEuro(service.cost),
                        service.vat ? 'Soggetto a Tasse' : 'Non soggetto a Tasse',
                    ];

                    const subRows = (service.subservices || [])
                        .filter((s) => s.description.trim() !== '')
                        .map((sub) => [
                            `   • ${sub.description}`, // indent “visivo”
                            '',                        // costo vuoto
                            '',                        // tasse vuoto
                        ]);

                    return [mainRow, ...subRows];
                });


                autoTable(pdf, {
                    head: [['Servizio', 'Costo', 'Tasse']],
                    body: tableData,

                    startY: currentY,

                    // IMPORTANTISSIMO: margini che rispettano header/footer
                    margin: {
                        left: paddingX,
                        right: paddingX,
                        top: topY,
                        bottom: pageHeight - bottomY, // spazio riservato al footer + padding
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

                    // ridisegna header/footer su OGNI pagina generata
                    didDrawPage: () => {
                        addHeaderFooter();
                    },

                    didParseCell: (hook) => {
                        const text = String(hook.cell.text?.[0] ?? '');
                        const isSub = text.trim().startsWith('•');
                        if (isSub) {
                            hook.cell.styles.fontSize = 8;
                            hook.cell.styles.fontStyle = 'normal';
                        }

                    },
                });

                currentY = (pdf as any).lastAutoTable.finalY + 10;
            }

            // ====== 3) BOX TOTALI (SE NON C'È SPAZIO, NUOVA PAGINA) ======
            const summaryHeight = 50;
            if (currentY + summaryHeight > bottomY) {
                currentY = newPage();
            }

            const boxWidth = 80;
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

            pdf.save(`Preventivo_${data.subject?.replace(/\s+/g, '_') || 'Documento'}.pdf`);
        } catch (error) {
            console.error(error);
            alert('Si è verificato un errore durante la generazione del PDF. Riprova.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Toolbar */}
            <div className="bg-white shadow-md p-4 print:hidden sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <button
                        onClick={onBack}
                        disabled={isGenerating}
                        aria-label="Torna alla modifica del preventivo"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300
                                 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Modifica Preventivo
                    </button>

                    <button
                        onClick={handleDownloadPdf}
                        disabled={isGenerating}
                        aria-label="Scarica preventivo in formato PDF"
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white
                                 hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait
                                 rounded-lg transition-colors"
                    >
                        {isGenerating ? (
                            <>
                                <Loader className="w-5 h-5 animate-spin" />
                                Generazione PDF...
                            </>
                        ) : (
                            <>
                                <Download className="w-5 h-5" />
                                Scarica PDF
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Preview */}
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-white shadow-lg">
                    <div ref={headerRef}>
                        <QuoteHeader data={data} />
                    </div>

                    <QuoteContent data={data} calculations={calculations} />

                    <div ref={footerRef}>
                        <QuoteFooter data={data} />
                    </div>
                </div>
            </div>
        </div>
    );
}
