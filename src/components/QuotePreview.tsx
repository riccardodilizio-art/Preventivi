import { useRef } from 'react';
import { QuoteData } from '../types/quote';
import { ArrowLeft, Printer } from 'lucide-react';
import logo from '../image/logo.png';
import firma from '../image/firma.png';

interface QuotePreviewProps {
    data: QuoteData;
    onBack: () => void;
}

export function QuotePreview({ data, onBack }: QuotePreviewProps) {
    const previewRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => window.print();

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
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

    // IVA 21%: imponibile + IVA + totale (somma dei servizi)
    const imponibile =
        data.services?.reduce((acc, s) => acc + (parseItalianNumber(s.cost || '') ?? 0), 0) ?? 0;

    const iva = imponibile * 0.21;
    const totaleConIva = imponibile + iva;

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Toolbar - nascosto in stampa */}
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
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                    >
                        <Printer className="w-5 h-5" />
                        Stampa
                    </button>
                </div>
            </div>

            {/* Preview */}
            <div className="max-w-4xl mx-auto p-6 print:p-0">
                <div
                    ref={previewRef}
                    className="bg-white shadow-lg print:shadow-none p-12 print:p-8"
                    style={{ minHeight: '297mm' }}
                >
                    {/* Header: logo + dati azienda */}
                    <div className="flex justify-between items-start gap-6 mb-10">
                        <img
                            src={logo}
                            alt="Logo azienda"
                            className="w-56 max-h-24 object-contain print:w-40"
                        />

                        <div className="text-right space-y-1 text-[15px] leading-relaxed">
                            <p className="font-semibold text-base">{data.companyName}</p>
                            <p>{data.companyAddress}</p>
                            <p>{data.companyCity}</p>
                            <p className="text-sm">C.F. {data.taxCode}</p>
                            <p className="text-sm">P. IVA {data.vatNumber}</p>
                        </div>
                    </div>

                    {/* Titolo documento */}
                    <div className="mb-6">
                        <p className="text-xl font-bold tracking-wide">PREVENTIVO</p>
                    </div>

                    {/* Oggetto (grassetto) */}
                    <div className="my-8 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <p className="font-bold uppercase tracking-wide">
                            OGGETTO: <span className="normal-case">{data.subject}</span>
                        </p>
                    </div>

                    {/* Descrizione servizio (normale) */}
                    <div className="my-6">
                        <p className="whitespace-pre-line">{data.serviceDescription}</p>
                    </div>

                    {/* Tabella servizi */}
                    {data.services?.length > 0 && (
                        <div className="my-8">
                            <div className="flex justify-between text-sm font-medium text-gray-600 border-b border-gray-300 pb-2">
                                <p>Servizio</p>
                                <p className="w-40 text-right">Costo</p>
                            </div>

                            <div className="divide-y divide-gray-200">
                                {data.services.map((service, index) => (
                                    <div key={index} className="flex justify-between items-start gap-6 py-3">
                                        <p className="font-bold flex-1">{service.description}</p>
                                        <p className="font-bold w-40 text-right whitespace-nowrap">
                                            {service.cost?.trim() ? formatEuro(service.cost) : ''}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Totali: imponibile + IVA 21% + totale */}
                    <div className="mt-10 flex justify-end">
                        <div className="rounded-lg border border-gray-300 px-5 py-4 min-w-[320px]">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Imponibile</span>
                                <span className="font-medium">{formatEuroFromNumber(imponibile)}</span>
                            </div>

                            <div className="flex justify-between text-sm mt-2">
                                <span className="text-gray-600">IVA (21%)</span>
                                <span className="font-medium">{formatEuroFromNumber(iva)}</span>
                            </div>

                            <div className="flex justify-between mt-3 pt-3 border-t border-gray-200">
                                <span className="font-bold">Totale</span>
                                <span className="font-bold">{formatEuroFromNumber(totaleConIva)}</span>
                            </div>

                            <p className="text-xs text-gray-500 mt-3">Importi espressi in Euro.</p>
                        </div>
                    </div>

                    {/* Footer: luogo/data + firma (FLEX sistemato) */}
                    <div className="mt-16 flex justify-between items-end">
                        <div className="text-base leading-relaxed">
                            <p className="font-medium">{data.location}</p>
                            <p className="text-sm">{formatDate(data.date)}</p>
                        </div>

                        <div className="min-w-[240px] text-center">
                            <img
                                src={firma}
                                alt="Firma"
                                className="mx-auto max-h-16 w-auto object-contain mb-2"
                            />
                            <div className="border-t-2 border-black pt-1">
                                <span className="italic">{data.signature}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stili stampa */}
            <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          @page { size: A4; margin: 2cm; }
        }
      `}</style>
        </div>
    );
}
