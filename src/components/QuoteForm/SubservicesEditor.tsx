import { useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import type { Control, UseFormRegister } from 'react-hook-form';
import type { QuoteData } from '@/types/quote';

interface SubservicesEditorProps {
  serviceIndex: number;
  control: Control<QuoteData>;
  register: UseFormRegister<QuoteData>;
}

export function SubservicesEditor({ serviceIndex, control, register }: SubservicesEditorProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `services.${serviceIndex}.subservices` as const,
  });

  return (
    <div className="mt-2 ml-6 pl-4 border-l border-gray-200 space-y-2">
      {fields.map((f, subIndex) => (
        <div key={f.id} className="flex items-start gap-2">
          <input
            {...register(
              `services.${serviceIndex}.subservices.${subIndex}.description` as const,
            )}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={`Sottoservizio ${subIndex + 1} (senza costo)`}
          />
          <button
            type="button"
            onClick={() => remove(subIndex)}
            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            aria-label="Rimuovi sottoservizio"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => append({ description: '' })}
        className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Aggiungi sottoservizio
      </button>
    </div>
  );
}
