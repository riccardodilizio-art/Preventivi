import { useMemo } from 'react';
import { VAT_RATE } from '@/constants';
import { parseItalianNumber } from '@/utils/formatting';
import type { ServiceItem } from '@/types/quote';

export interface Calculations {
  taxable: number;
  nonTaxable: number;
  iva: number;
  total: number;
}

export const useQuoteCalculations = (services: ServiceItem[] = []): Calculations =>
  useMemo(() => {
    const sums = services.reduce(
      (acc, s) => {
        const amount = parseItalianNumber(s.cost) ?? 0;
        if (s.vat) {
          acc.taxable += amount;
        } else {
          acc.nonTaxable += amount;
        }
        return acc;
      },
      { taxable: 0, nonTaxable: 0 },
    );

    const iva = sums.taxable * VAT_RATE;
    const total = sums.taxable + sums.nonTaxable + iva;

    return { taxable: sums.taxable, nonTaxable: sums.nonTaxable, iva, total };
  }, [services]);
