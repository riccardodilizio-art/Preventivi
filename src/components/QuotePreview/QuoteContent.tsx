import { forwardRef } from 'react';
import type { QuoteData } from '@/types/quote';
import type { Calculations } from '@/hooks/useQuoteCalculations';
import { ServiceRow } from './ServiceRow';
import { TotalsSummary } from './TotalsSummary';

interface QuoteContentProps {
  data: QuoteData;
  calculations: Calculations;
}

export const QuoteContent = forwardRef<HTMLDivElement, QuoteContentProps>(
  function QuoteContent({ data, calculations }, ref) {
    return (
      <div className="px-10">
        <div ref={ref} className="my-6 rich-text-content">
          <div dangerouslySetInnerHTML={{ __html: data.serviceDescription }} />
        </div>

        {data.services.length > 0 && (
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
  },
);
