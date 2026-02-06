import type { QuoteData } from '@/types/quote';
import { formatDate } from '@/utils/formatting';
import firma from '@/image/firma.png';

interface QuoteFooterProps {
  data: QuoteData;
}

export function QuoteFooter({ data }: QuoteFooterProps) {
  return (
    <div className="px-10 pt-10 pb-10">
      <div className="flex justify-between items-end">
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
  );
}
