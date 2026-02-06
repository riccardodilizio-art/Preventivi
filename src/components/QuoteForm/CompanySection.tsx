import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { QuoteData } from '@/types/quote';

interface CompanySectionProps {
  register: UseFormRegister<QuoteData>;
  errors: FieldErrors<QuoteData>;
}

const INPUT_CLASS =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export function CompanySection({ register, errors }: CompanySectionProps) {
  return (
    <section>
      <h2 className="mb-4 text-blue-600 border-b pb-2">Dati Azienda</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="companyName" className="block mb-2">Nome Azienda *</label>
          <input
            id="companyName"
            {...register('companyName', { required: 'Campo obbligatorio' })}
            className={INPUT_CLASS}
            placeholder="es. Timingrun di Riccardo Di Lizio"
          />
          {errors.companyName && (
            <p className="text-red-500 mt-1">{errors.companyName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="companyAddress" className="block mb-2">Indirizzo *</label>
          <input
            id="companyAddress"
            {...register('companyAddress', { required: 'Campo obbligatorio' })}
            className={INPUT_CLASS}
            placeholder="es. Via Arenile 26"
          />
          {errors.companyAddress && (
            <p className="text-red-500 mt-1">{errors.companyAddress.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="companyCity" className="block mb-2">Città e CAP *</label>
          <input
            id="companyCity"
            {...register('companyCity', { required: 'Campo obbligatorio' })}
            className={INPUT_CLASS}
            placeholder="es. 66010 Ripa Teatina (CH), IT"
          />
          {errors.companyCity && (
            <p className="text-red-500 mt-1">{errors.companyCity.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="taxCode" className="block mb-2">Codice Fiscale *</label>
          <input
            id="taxCode"
            {...register('taxCode', { required: 'Campo obbligatorio' })}
            className={INPUT_CLASS}
            placeholder="es. DLZRCR04P18C632D"
          />
          {errors.taxCode && (
            <p className="text-red-500 mt-1">{errors.taxCode.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="vatNumber" className="block mb-2">Partita IVA *</label>
          <input
            id="vatNumber"
            {...register('vatNumber', { required: 'Campo obbligatorio' })}
            className={INPUT_CLASS}
            placeholder="es. 02798780694"
          />
          {errors.vatNumber && (
            <p className="text-red-500 mt-1">{errors.vatNumber.message}</p>
          )}
        </div>
      </div>
    </section>
  );
}
