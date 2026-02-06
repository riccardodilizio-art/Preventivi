import { ArrowLeft, Download, Loader } from 'lucide-react';

interface PreviewToolbarProps {
  isGenerating: boolean;
  onBack: () => void;
  onDownload: () => void;
}

export function PreviewToolbar({ isGenerating, onBack, onDownload }: PreviewToolbarProps) {
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

        <button
          onClick={onDownload}
          disabled={isGenerating}
          aria-label="Scarica preventivo in formato PDF"
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white
                     hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait
                     rounded-lg transition-colors"
        >
          {isGenerating ? (
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
      </div>
    </div>
  );
}
