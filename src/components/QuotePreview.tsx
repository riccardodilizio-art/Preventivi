import { useRef } from 'react';
import { QuoteData } from '../types/quote';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import logo from '../image/logo.png';
import firma from '../image/firma.png';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface QuotePreviewProps {
    data: QuoteData;
    onBack: () => void;
}
//genero preventivo
export function QuotePreview({ data, onBack }: QuotePreviewProps) {
    const previewRef = useRef<HTMLDivElement>(null);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

    // IVA 20% solo su servizi spuntati
    const VAT_RATE = 0.2;
    const sums = (data.services ?? []).reduce(
        (acc, s) => {
            const amount = parseItalianNumber(s.cost || '') ?? 0;
            const applyVat = s.vat === true; // ✅ solo se spuntato
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

    // generazione PDF
    const handleDownloadPdf = async () => {
        if (!previewRef.current) return;

        const node = previewRef.current;

        // 🔥 forza stile PDF
        node.classList.add('pdf-export');

        const dataUrl = await toPng(node, {
            cacheBust: true,
            pixelRatio: 2.5, // importantissimo
            backgroundColor: '#ffffff'
        });

        node.classList.remove('pdf-export');

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const img = new Image();
        img.src = dataUrl;
        await new Promise((res) => (img.onload = res));

        const imgWidth = pageWidth;
        const imgHeight = (img.height * imgWidth) / img.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
            pdf.addPage();
            position = heightLeft - imgHeight;
            pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save('Preventivo.pdf');
    };


    return (
        <div className="min-h-screen bg-gray-100">
            {/* Toolbar */}
            <div className="bg-white shadow-md p-4 print:hidden sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    {/* sezione modifica preventivo */}
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Modifica Preventivo
                    </button>

                    <div className="flex gap-3">

                        {/* Scarico PDF */}
                        <button
                            onClick={handleDownloadPdf}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
                        >
                            <Download className="w-5 h-5" />
                            Scarica PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview */}
            <div className="max-w-4xl mx-auto p-6">
                <div
                    ref={previewRef}
                    className="bg-white shadow-lg p-10"
                >
                    {/*  Generazione preventivo */}

                    <div className="flex justify-between items-start gap-6 mb-10  ">
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

                    <div className="my-8 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <p className="font-bold uppercase tracking-wide">
                            OGGETTO: <span className="normal-case">{data.subject}</span>
                        </p>
                    </div>

                    <div className="my-6">
                        <p className="whitespace-pre-line">{data.serviceDescription}</p>
                    </div>

                    {data.services?.length > 0 && (
                        <div className="my-8">
                            {/* header tabella */}
                            <div className="flex justify-between text-sm font-medium text-black border-b-2 border-black pb-2">
                                <p>Servizio</p>
                                <p className="w-40 text-right">Costo</p>
                            </div>

                            {/* righe */}
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
                                                {service.vat ? 'Soggetto IVA' : 'Non soggetto IVA'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}


                    <div className="mt-10 flex justify-end">
                        <div className="rounded-lg border border-gray-300 px-5 py-4 min-w-[360px]">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Imponibile (Tasse)</span>
                                <span className="font-medium">{formatEuroFromNumber(imponibileIva)}</span>
                            </div>

                            <div className="flex justify-between text-sm mt-2">
                                <span className="text-gray-600">Imponibile (non soggetto a Tasse)</span>
                                <span className="font-medium">{formatEuroFromNumber(imponibileNoIva)}</span>
                            </div>

                            <div className="flex justify-between text-sm mt-2">
                                <span className="text-gray-600">Tasse (20%)</span>
                                <span className="font-medium">{formatEuroFromNumber(iva)}</span>
                            </div>

                            <div className="flex justify-between mt-3 pt-3 border-t border-gray-200">
                                <span className="font-bold">Totale</span>
                                <span className="font-bold">{formatEuroFromNumber(totaleConIva)}</span>
                            </div>

                            <p className="text-xs text-gray-500 mt-3">Importi espressi in Euro.</p>
                        </div>
                    </div>

                    <div className="mt-16 flex justify-between items-end">
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
    );
}
