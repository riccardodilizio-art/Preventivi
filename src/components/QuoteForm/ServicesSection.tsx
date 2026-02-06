import { useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import type { Control, UseFormRegister } from 'react-hook-form';
import type { QuoteData } from '@/types/quote';
import { SubservicesEditor } from './SubservicesEditor';

interface ServicesSectionProps {
  control: Control<QuoteData>;
  register: UseFormRegister<QuoteData>;
}

const INPUT_CLASS =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export function ServicesSection({ control, register }: ServicesSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'services',
  });

  return (
    <section>
      <h2 className="mb-4 text-blue-600 border-b pb-2">Elenco Servizi Dettagliati</h2>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="space-y-2">
            <div className="flex gap-3 items-start">
              <input
                {...register(`services.${index}.description` as const)}
                className={`flex-1 ${INPUT_CLASS}`}
                placeholder={`Servizio principale ${index + 1}`}
              />

              <div className="relative w-36">
                <input
                  {...register(`services.${index}.cost` as const, {
                    setValueAs: (v: unknown) => String(v ?? '').replace(/[^\d.,-]/g, ''),
                    pattern: {
                      value: /^[0-9.,-]*$/,
                      message: 'Inserisci solo numeri',
                    },
                  })}
                  inputMode="decimal"
                  className="w-full px-4 py-2 text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0,00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 select-none">
                  &euro;
                </span>
              </div>

              <label className="flex items-center gap-2 mt-1 select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  {...register(`services.${index}.vat` as const)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-700">Tasse</span>
              </label>

              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  aria-label="Rimuovi servizio"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <SubservicesEditor serviceIndex={index} control={control} register={register} />
          </div>
        ))}

        <button
          type="button"
          onClick={() => append({ description: '', cost: '', vat: true, subservices: [] })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Aggiungi Servizio
        </button>
      </div>
    </section>
  );
}
