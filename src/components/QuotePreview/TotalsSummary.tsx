import { memo } from 'react';
import { formatEuroFromNumber } from '@/utils/formatting';
import type { Calculations } from '@/hooks/useQuoteCalculations';

interface TotalsSummaryProps {
  calculations: Calculations;
}

export const TotalsSummary = memo(function TotalsSummary({ calculations }: TotalsSummaryProps) {
  return (
    <div className="mt-7 flex justify-end">
      <div className="rounded-lg border border-black px-5 py-10 min-w-[350px]">
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
});
