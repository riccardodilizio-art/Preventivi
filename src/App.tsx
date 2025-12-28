import React, { useState } from 'react';
import { QuoteForm } from './components/QuoteForm';
import { QuotePreview } from './components/QuotePreview';
import { QuoteData } from './types/quote';

export default function App() {
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleQuoteSubmit = (data: QuoteData) => {
    setQuoteData(data);
    setShowPreview(true);
  };

  const handleBackToForm = () => {
    setShowPreview(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {!showPreview ? (
        <QuoteForm onSubmit={handleQuoteSubmit} initialData={quoteData} />
      ) : (
        <QuotePreview data={quoteData!} onBack={handleBackToForm} />
      )}
    </div>
  );
}
