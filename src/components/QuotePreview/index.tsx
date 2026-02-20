import { useRef, useState, useCallback } from 'react';
import type { QuoteData } from '@/types/quote';
import { useQuoteCalculations } from '@/hooks/useQuoteCalculations';
import { generateQuotePdf } from '@/utils/pdf-generator';
import { generateQuoteWord } from '@/utils/word-generator';
import { PreviewToolbar } from './PreviewToolbar';
import type { GeneratingState } from './PreviewToolbar';
import { QuoteHeader } from './QuoteHeader';
import { QuoteContent } from './QuoteContent';
import { QuoteFooter } from './QuoteFooter';
import logo from '@/image/logo.png';
import firma from '@/image/firma.png';

interface QuotePreviewProps {
  data: QuoteData;
  onBack: () => void;
}

export function QuotePreview({ data, onBack }: QuotePreviewProps) {
  const [generatingState, setGeneratingState] = useState<GeneratingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const calculations = useQuoteCalculations(data.services);

  const handleDownloadPdf = useCallback(async () => {
    if (!contentRef.current) {
      setError('Elementi non pronti per la generazione del PDF.');
      return;
    }

    setGeneratingState('pdf');
    setError(null);

    try {
      await generateQuotePdf({
        data,
        calculations,
        contentElement: contentRef.current,
        logoSrc: logo,
        firmaSrc: firma,
      });
    } catch (err) {
      console.error('Errore generazione PDF:', err);
      setError('Si è verificato un errore durante la generazione del PDF. Riprova.');
    } finally {
      setGeneratingState('idle');
    }
  }, [data, calculations]);

  const handleDownloadWord = useCallback(async () => {
    setGeneratingState('word');
    setError(null);

    try {
      await generateQuoteWord({
        data,
        calculations,
        logoSrc: logo,
        firmaSrc: firma,
      });
    } catch (err) {
      console.error('Errore generazione Word:', err);
      setError('Si è verificato un errore durante la generazione del documento Word. Riprova.');
    } finally {
      setGeneratingState('idle');
    }
  }, [data, calculations]);

  return (
    <div className="min-h-screen bg-gray-100">
      <PreviewToolbar
        generatingState={generatingState}
        onBack={onBack}
        onDownloadPdf={handleDownloadPdf}
        onDownloadWord={handleDownloadWord}
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
          <QuoteHeader data={data} />

          <QuoteContent
            data={data}
            calculations={calculations}
            contentRef={contentRef}
          />

          <QuoteFooter data={data} />
        </div>
      </div>
    </div>
  );
}
