import { ArrowLeft, Download, FileText, Loader } from 'lucide-react';

export type GeneratingState = 'idle' | 'pdf' | 'word';

interface PreviewToolbarProps {
  generatingState: GeneratingState;
  onBack: () => void;
  onDownloadPdf: () => void;
  onDownloadWord: () => void;
}

export function PreviewToolbar({ generatingState, onBack, onDownloadPdf, onDownloadWord }: PreviewToolbarProps) {
  const isGenerating = generatingState !== 'idle';

  return (
    <div className="bg-white shadow-md p-4 print:hidden sticky top-0 z-10">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <button
          onClick={onBack}
          disabled={isGenerating}
          aria-label="Torna alla modifica del preventivo"
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300
                     disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Modifica Preventivo
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onDownloadPdf}
            disabled={isGenerating}
            aria-label="Scarica preventivo in formato PDF"
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white
                       hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait
                       rounded-lg transition-colors"
          >
            {generatingState === 'pdf' ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Generazione PDF...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Scarica PDF
              </>
            )}
          </button>

          <button
            onClick={onDownloadWord}
            disabled={isGenerating}
            aria-label="Scarica preventivo in formato Word"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-wait
                       rounded-lg transition-colors"
          >
            {generatingState === 'word' ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Generazione Word...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Scarica Word
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
