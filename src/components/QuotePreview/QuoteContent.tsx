import type { Ref } from 'react';
import type { QuoteData } from '@/types/quote';
import type { Calculations } from '@/hooks/useQuoteCalculations';
import { ServiceRow } from './ServiceRow';
import { TotalsSummary } from './TotalsSummary';

interface QuoteContentProps {
  data: QuoteData;
  calculations: Calculations;
  contentRef: Ref<HTMLDivElement>;
}

export function QuoteContent({ data, calculations, contentRef }: QuoteContentProps) {
  return (
    <div ref={contentRef} className="px-10 py-6">
      {/* Descrizione */}
      <div className="rich-text-content mb-6" style={{ overflow: 'visible' }}>
        <div dangerouslySetInnerHTML={{ __html: data.serviceDescription }} />
      </div>

      {/* Tabella servizi */}
      {data.services.length > 0 && (
        <div className="mb-6">
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
      <TotalsSummary calculations={calculations} />
    </div>
  );
}
