import { useForm, useFieldArray } from 'react-hook-form';
import { QuoteData } from '../types/quote';
import { Plus, Trash2, FileText } from 'lucide-react';

interface QuoteFormProps {
  onSubmit: (data: QuoteData) => void;
  initialData?: QuoteData | null;
}

export function QuoteForm({ onSubmit, initialData }: QuoteFormProps) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<QuoteData>({
    defaultValues: initialData || {
      companyName: '',
      companyAddress: '',
      companyCity: '',
      taxCode: '',
      vatNumber: '',
      subject: '',
      serviceDescription: '',
      services: [{ description: '', cost: '' }],
      totalCost: '',
      location: '',
      date: new Date().toISOString().split('T')[0],
      signature: ''
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'services'
  });

  const onFormSubmit = (data: QuoteData) => {
    // Filtra i servizi vuoti
    const filteredData = {
      ...data,
      services: data.services.filter(service => service.description.trim() !== '')
    };
    onSubmit(filteredData);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="w-8 h-8 text-blue-600" />
          <h1>Generatore di Preventivi</h1>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-8">
          {/* Dati Azienda */}
          <section>
            <h2 className="mb-4 text-blue-600 border-b pb-2">Dati Azienda</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block mb-2">Nome Azienda *</label>
                <input
                  {...register('companyName', { required: 'Campo obbligatorio' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="es. Timingrun di Riccardo Di Lizio"
                />
                {errors.companyName && (
                  <p className="text-red-500 mt-1">{errors.companyName.message}</p>
                )}
              </div>

              <div>
                <label className="block mb-2">Indirizzo *</label>
                <input
                  {...register('companyAddress', { required: 'Campo obbligatorio' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="es. Via Arenile 26"
                />
                {errors.companyAddress && (
                  <p className="text-red-500 mt-1">{errors.companyAddress.message}</p>
                )}
              </div>

              <div>
                <label className="block mb-2">Città e CAP *</label>
                <input
                  {...register('companyCity', { required: 'Campo obbligatorio' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="es. 66010 Ripa Teatina (CH), IT"
                />
                {errors.companyCity && (
                  <p className="text-red-500 mt-1">{errors.companyCity.message}</p>
                )}
              </div>

              <div>
                <label className="block mb-2">Codice Fiscale *</label>
                <input
                  {...register('taxCode', { required: 'Campo obbligatorio' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="es. DLZRCR04P18C632D"
                />
                {errors.taxCode && (
                  <p className="text-red-500 mt-1">{errors.taxCode.message}</p>
                )}
              </div>

              <div>
                <label className="block mb-2">Partita IVA *</label>
                <input
                  {...register('vatNumber', { required: 'Campo obbligatorio' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="es. 02798780694"
                />
                {errors.vatNumber && (
                  <p className="text-red-500 mt-1">{errors.vatNumber.message}</p>
                )}
              </div>
            </div>
          </section>

          {/* Oggetto del Preventivo */}
          <section>
            <h2 className="mb-4 text-blue-600 border-b pb-2">Oggetto del Preventivo</h2>
            <div>
              <label className="block mb-2">Oggetto *</label>
              <input
                {...register('subject', { required: 'Campo obbligatorio' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="es. Proposta preventivo Cronometraggio per rilevazione tempi per Prova selettiva Polizia Locale"
              />
              {errors.subject && (
                <p className="text-red-500 mt-1">{errors.subject.message}</p>
              )}
            </div>
          </section>

          {/* Descrizione Servizio */}
          <section>
            <h2 className="mb-4 text-blue-600 border-b pb-2">Descrizione Servizio</h2>
            <div>
              <label className="block mb-2">Descrizione *</label>
              <textarea
                {...register('serviceDescription', { required: 'Campo obbligatorio' })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Descrivi il servizio offerto..."
              />
              {errors.serviceDescription && (
                <p className="text-red-500 mt-1">{errors.serviceDescription.message}</p>
              )}
            </div>
          </section>

          {/* Elenco Servizi */}
          <section>
            <h2 className="mb-4 text-blue-600 border-b pb-2">Elenco Servizi Dettagliati</h2>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <input
                    {...register(`services.${index}.description` as const)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`Descrizione servizio ${index + 1}`}
                  />
                  <input
                    {...register(`services.${index}.cost` as const)}
                    className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Costo (€)"
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => append({ description: '', cost: '' })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Aggiungi Servizio
              </button>
            </div>
          </section>

          {/* Costo */}
          <section>
            <h2 className="mb-4 text-blue-600 border-b pb-2">Costo Totale Fatturato</h2>
            <div>
              <label className="block mb-2">Costo Totale *</label>
              <input
                {...register('totalCost', { required: 'Campo obbligatorio' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="es. Costo totale con Regolare Fattura 1000€"
              />
              {errors.totalCost && (
                <p className="text-red-500 mt-1">{errors.totalCost.message}</p>
              )}
            </div>
          </section>

          {/* Footer */}
          <section>
            <h2 className="mb-4 text-blue-600 border-b pb-2">Informazioni Finali</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block mb-2">Località *</label>
                <input
                  {...register('location', { required: 'Campo obbligatorio' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="es. Ripa Teatina"
                />
                {errors.location && (
                  <p className="text-red-500 mt-1">{errors.location.message}</p>
                )}
              </div>

              <div>
                <label className="block mb-2">Data *</label>
                <input
                  type="date"
                  {...register('date', { required: 'Campo obbligatorio' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.date && (
                  <p className="text-red-500 mt-1">{errors.date.message}</p>
                )}
              </div>

              <div>
                <label className="block mb-2">Firma *</label>
                <input
                  {...register('signature', { required: 'Campo obbligatorio' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="es. Di Lizio Riccardo"
                />
                {errors.signature && (
                  <p className="text-red-500 mt-1">{errors.signature.message}</p>
                )}
              </div>
            </div>
          </section>

          {/* Submit Button */}
          <div className="flex justify-end pt-6">
            <button
              type="submit"
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Genera Anteprima Preventivo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}