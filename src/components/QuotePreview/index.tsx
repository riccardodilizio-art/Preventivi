import { useRef, useState, useCallback } from 'react';
import type { QuoteData } from '@/types/quote';
import { useQuoteCalculations } from '@/hooks/useQuoteCalculations';
import { generateQuotePdf } from '@/utils/pdf-generator';
import { PreviewToolbar } from './PreviewToolbar';
import { QuoteHeader } from './QuoteHeader';
import { QuoteContent } from './QuoteContent';
import { QuoteFooter } from './QuoteFooter';

interface QuotePreviewProps {
  data: QuoteData;
  onBack: () => void;
}

export function QuotePreview({ data, onBack }: QuotePreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const calculations = useQuoteCalculations(data.services);

  const handleDownloadPdf = useCallback(async () => {
    if (!headerRef.current || !footerRef.current) {
      setError('Elementi non pronti per la generazione del PDF.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      await generateQuotePdf({
        data,
        calculations,
        headerElement: headerRef.current,
        footerElement: footerRef.current,
      });
    } catch (err) {
      console.error('Errore generazione PDF:', err);
      setError('Si è verificato un errore durante la generazione del PDF. Riprova.');
    } finally {
      setIsGenerating(false);
    }
  }, [data, calculations]);

  return (
    <div className="min-h-screen bg-gray-100">
      <PreviewToolbar
        isGenerating={isGenerating}
        onBack={onBack}
        onDownload={handleDownloadPdf}
      />

      {error && (
        <div className="max-w-4xl mx-auto mt-4 px-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white shadow-lg">
          <div ref={headerRef}>
            <QuoteHeader data={data} />
          </div>

          <QuoteContent data={data} calculations={calculations} />

          <div ref={footerRef}>
            <QuoteFooter data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
