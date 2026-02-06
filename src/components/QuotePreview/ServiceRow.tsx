import { memo } from 'react';
import { formatEuro } from '@/utils/formatting';
import type { ServiceItem } from '@/types/quote';

interface ServiceRowProps {
  service: ServiceItem;
}

export const ServiceRow = memo(function ServiceRow({ service }: ServiceRowProps) {
  return (
    <div className="py-3 border-t border-black">
      <div className="flex justify-between items-start gap-6">
        <p className="font-bold flex-1 text-black">{service.description}</p>
        <div className="w-40 text-right whitespace-nowrap">
          <p className="font-bold text-black">{formatEuro(service.cost)}</p>
          <p className="text-xs text-black">
            {service.vat ? 'Soggetto a Tasse' : 'Non soggetto a Tasse'}
          </p>
        </div>
      </div>

      {service.subservices && service.subservices.length > 0 && (
        <ul className="ml-6 mt-2 list-disc text-sm text-black space-y-1">
          {service.subservices.map((sub, i) => (
            <li key={i}>{sub.description}</li>
          ))}
        </ul>
      )}
    </div>
  );
});
