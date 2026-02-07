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
    <div className="px-10">
      {/* Descrizione */}
      <div ref={descriptionRef} className="my-6 rich-text-content">
        <div dangerouslySetInnerHTML={{ __html: data.serviceDescription }} />
      </div>

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
      <div ref={totalsRef} className="pb-4">
        <TotalsSummary calculations={calculations} />
      </div>
    </div>
  );
}
