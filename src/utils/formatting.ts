import { LOCALE_CONFIG } from '@/constants';

/**
 * Converte una stringa numerica italiana (es. "1.234,56") in un number.
 * Restituisce null se il valore non è un numero valido.
 */
export const parseItalianNumber = (raw?: string): number | null => {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return null;

  const sign = cleaned.startsWith('-') ? '-' : '';
  const unsigned = cleaned.replace(/-/g, '');
  const normalized = unsigned.replace(/\./g, '').replace(',', '.');
  const n = Number(sign + normalized);

  return Number.isFinite(n) ? n : null;
};

export const formatEuroFromNumber = (n: number): string =>
  n.toLocaleString(LOCALE_CONFIG.DATE, {
    style: 'currency',
    currency: LOCALE_CONFIG.CURRENCY,
  });

export const formatEuro = (raw?: string): string => {
  if (!raw?.trim()) return '';
  const n = parseItalianNumber(raw);
  return n !== null ? formatEuroFromNumber(n) : raw;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(LOCALE_CONFIG.DATE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
