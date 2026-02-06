import type { QuoteData } from '@/types/quote';
import type { Calculations } from '@/hooks/useQuoteCalculations';
import { ServiceRow } from './ServiceRow';
import { TotalsSummary } from './TotalsSummary';

interface QuoteContentProps {
  data: QuoteData;
  calculations: Calculations;
}

export function QuoteContent({ data, calculations }: QuoteContentProps) {
  return (
    <div className="px-10">
      {/* Blocco: descrizione */}
      <div data-pdf-block className="my-6 rich-text-content">
        <div dangerouslySetInnerHTML={{ __html: data.serviceDescription }} />
      </div>

      {data.services.length > 0 && (
        <div className="my-8">
          {/* Blocco: intestazione tabella */}
          <div data-pdf-block className="flex justify-between text-sm font-medium text-black border-b-2 border-black pb-2">
            <p>Servizio</p>
            <p className="w-40 text-right">Costo</p>
          </div>

          {/* Blocco: ogni riga servizio */}
          <div className="border-b border-black">
            {data.services.map((service, index) => (
              <div key={index} data-pdf-block>
                <ServiceRow service={service} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocco: totali */}
      <div data-pdf-block>
        <TotalsSummary calculations={calculations} />
      </div>
    </div>
  );
}
