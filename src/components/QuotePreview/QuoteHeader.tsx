import type { QuoteData } from '@/types/quote';
import logo from '@/image/logo.png';

interface QuoteHeaderProps {
  data: QuoteData;
}

export function QuoteHeader({ data }: QuoteHeaderProps) {
  return (
    <div className="p-10 pb-0">
      <div className="flex justify-between items-start gap-6 mb-10">
        <img src={logo} alt="Logo azienda" className="w-56 max-h-24 object-contain" />

        <div className="text-right space-y-1 text-[15px] leading-relaxed">
          <p className="font-semibold text-base">{data.companyName}</p>
          <p>{data.companyAddress}</p>
          <p>{data.companyCity}</p>
          <p className="text-sm">C.F. {data.taxCode}</p>
          <p className="text-sm">P. IVA {data.vatNumber}</p>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xl font-bold tracking-wide">PREVENTIVO</p>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="font-bold uppercase tracking-wide">
          OGGETTO: <span className="normal-case">{data.subject}</span>
        </p>
      </div>
    </div>
  );
}
