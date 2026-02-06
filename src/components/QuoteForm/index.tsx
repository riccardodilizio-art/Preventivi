import { useForm } from 'react-hook-form';
import { FileText } from 'lucide-react';
import type { QuoteData } from '@/types/quote';
import { CompanySection } from './CompanySection';
import { ServicesSection } from './ServicesSection';
import { FooterSection } from './FooterSection';

interface QuoteFormProps {
  onSubmit: (data: QuoteData) => void;
  initialData?: QuoteData | null;
}

const DEFAULT_VALUES: QuoteData = {
  companyName: '',
  companyAddress: '',
  companyCity: '',
  taxCode: '',
  vatNumber: '',
  subject: '',
  serviceDescription: '',
  services: [{ description: '', cost: '', vat: true, subservices: [] }],
  totalCost: '',
  location: '',
  date: new Date().toISOString().split('T')[0] ?? '',
  signature: '',
};

export function QuoteForm({ onSubmit, initialData }: QuoteFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<QuoteData>({
    defaultValues: initialData ?? DEFAULT_VALUES,
  });

  const onFormSubmit = (data: QuoteData) => {
    const services = data.services
      .map((s) => ({
        ...s,
        subservices: (s.subservices ?? []).filter((x) => x.description.trim() !== ''),
      }))
      .filter(
        (s) =>
          s.description.trim() !== '' ||
          (s.cost?.trim() ?? '') !== '' ||
          (s.subservices?.length ?? 0) > 0,
      );

    onSubmit({ ...data, services });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="w-8 h-8 text-blue-600" />
          <h1>Generatore di Preventivi</h1>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-8">
          <CompanySection register={register} errors={errors} />

          <section>
            <h2 className="mb-4 text-blue-600 border-b pb-2">Oggetto del Preventivo</h2>
            <div>
              <label htmlFor="subject" className="block mb-2">Oggetto *</label>
              <input
                id="subject"
                {...register('subject', { required: 'Campo obbligatorio' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="es. Proposta preventivo Cronometraggio per rilevazione tempi..."
              />
              {errors.subject && (
                <p className="text-red-500 mt-1">{errors.subject.message}</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-blue-600 border-b pb-2">Descrizione Servizio</h2>
            <div>
              <label htmlFor="serviceDescription" className="block mb-2">Descrizione *</label>
              <textarea
                id="serviceDescription"
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

          <ServicesSection control={control} register={register} />

          <FooterSection register={register} errors={errors} />

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
