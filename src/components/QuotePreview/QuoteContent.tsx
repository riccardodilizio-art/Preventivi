import type { Ref } from 'react';
import type { QuoteData } from '@/types/quote';
import type { Calculations } from '@/hooks/useQuoteCalculations';
import { ServiceRow } from './ServiceRow';
import { TotalsSummary } from './TotalsSummary';

interface QuoteContentProps {
  data: QuoteData;
  calculations: Calculations;
  descriptionRef: Ref<HTMLDivElement>;
  totalsRef: Ref<HTMLDivElement>;
}

export function QuoteContent({ data, calculations, descriptionRef, totalsRef }: QuoteContentProps) {
  return (
    <>
      {/* Descrizione - wrapper con px-10 proprio così html-to-image cattura con la larghezza corretta */}
      <div ref={descriptionRef} className="px-10 py-6 rich-text-content" style={{ overflow: 'visible' }}>
        <div dangerouslySetInnerHTML={{ __html: data.serviceDescription }} />
      </div>

      <div className="px-10">
        {data.services.length > 0 && (
          <div className="my-8">
            {/* Intestazione tabella */}
            <div className="flex justify-between text-sm font-medium text-black border-b-2 border-black pb-2">
              <p>Servizio</p>
              <p className="w-40 text-right">Costo</p>
            </div>

            {/* Righe servizi */}
            <div className="border-b border-black">
              {data.services.map((service, index) => (
                <div key={index}>
                  <ServiceRow service={service} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totali */}
        <div ref={totalsRef} className="pb-10">
          <TotalsSummary calculations={calculations} />
        </div>
      </div>
    </>
  );
}
