import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { QuoteData } from '@/types/quote';

interface FooterSectionProps {
  register: UseFormRegister<QuoteData>;
  errors: FieldErrors<QuoteData>;
}

const INPUT_CLASS =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export function FooterSection({ register, errors }: FooterSectionProps) {
  return (
    <section>
      <h2 className="mb-4 text-blue-600 border-b pb-2">Informazioni Finali</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="location" className="block mb-2">Località *</label>
          <input
            id="location"
            {...register('location', { required: 'Campo obbligatorio' })}
            className={INPUT_CLASS}
            placeholder="es. Ripa Teatina"
          />
          {errors.location && (
            <p className="text-red-500 mt-1">{errors.location.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="date" className="block mb-2">Data *</label>
          <input
            id="date"
            type="date"
            {...register('date', { required: 'Campo obbligatorio' })}
            className={INPUT_CLASS}
          />
          {errors.date && (
            <p className="text-red-500 mt-1">{errors.date.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="signature" className="block mb-2">Firma *</label>
          <input
            id="signature"
            {...register('signature', { required: 'Campo obbligatorio' })}
            className={INPUT_CLASS}
            placeholder="es. Di Lizio Riccardo"
          />
          {errors.signature && (
            <p className="text-red-500 mt-1">{errors.signature.message}</p>
          )}
        </div>
      </div>
    </section>
  );
}
