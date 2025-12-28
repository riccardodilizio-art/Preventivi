import  { useRef } from 'react';
import { QuoteData } from '../types/quote';
import { ArrowLeft, Printer } from 'lucide-react';
import logo from '../image/logo.png';

interface QuotePreviewProps {
  data: QuoteData;
  onBack: () => void;
}

export function QuotePreview({ data, onBack }: QuotePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

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
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Printer className="w-5 h-5" />
              Stampa
            </button>
          </div>
        </div>
      </div>

      {/* Preview del preventivo */}
      <div className="max-w-4xl mx-auto p-6 print:p-0">
        <div 
          ref={previewRef}
          className="bg-white shadow-lg print:shadow-none p-12 print:p-8"
          style={{ minHeight: '297mm' }}
        >
          {/* Logo placeholder */}
            {/* Logo */}
            <div className="mb-10">
                <img
                    src={logo}
                    alt="Logo azienda"
                    className="
      w-56          /* larghezza logo */
      max-h-24      /* altezza massima */
      object-contain
      print:w-48    /* leggermente più piccolo in stampa */
    "
                />
            </div>


            {/* Dati azienda */}
          <div className="mb-8">
            <div className="space-y-1">
              <p>{data.companyName}</p>
              <p>{data.companyAddress}</p>
              <p>{data.companyCity}</p>
              <p>COD.FISCALE {data.taxCode}</p>
              <p>P.IVA {data.vatNumber}</p>
            </div>
          </div>

          {/* Oggetto */}
          <div className="my-8">
            <p>
              <span>OGGETTO: </span>
              <span>{data.subject}</span>
            </p>
          </div>

          {/* Descrizione servizio */}
          <div className="my-6">
            <p className="whitespace-pre-line">{data.serviceDescription}</p>
          </div>

            {/* Elenco servizi */}
            {data.services && data.services.length > 0 && (
                <div className="my-8">
                    <div className="space-y-3">
                        {data.services.map((service, index) => (
                            <div
                                key={index}
                                className="flex justify-between items-start gap-6"
                            >
                                {/* Descrizione */}
                                <div className="flex-1">
                                    <p>{service.description}</p>
                                </div>

                                {/* Costo */}
                                {service.cost && service.cost.trim() !== '' && (
                                    <div className="w-32 text-right whitespace-nowrap">
                                        <p>{service.cost}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}


            {/* Costo */}
          <div className="my-8">
            <p>{data.totalCost}</p>
          </div>

          {/* Footer */}
          <div className="mt-16 flex justify-between items-end">
            <div>
              <p>{data.location}</p>
              <p>{formatDate(data.date)}</p>
            </div>
            <div className="text-right">
              <div className="border-b-2 border-black pb-1 min-w-[200px] text-center mb-2">
                <span className="italic">{data.signature}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stili per la stampa */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          @page {
            size: A4;
            margin: 2cm;
          }
        }
      `}</style>
    </div>
  );
}
