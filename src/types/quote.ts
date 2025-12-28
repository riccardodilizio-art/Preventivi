export interface QuoteData {
  // Dati azienda
  companyName: string;
  companyAddress: string;
  companyCity: string;
  taxCode: string;
  vatNumber: string;
  companyLogo?: string;

  // Oggetto del preventivo
  subject: string;

  // Descrizione servizio
  serviceDescription: string;

  // Servizi offerti (lista puntata con costi opzionali)
  services: ServiceItem[];

  // Costo totale
  totalCost: string;

  // Footer
  location: string;
  date: string;
  signature: string;
}

export interface ServiceItem {
  description: string;
  cost?: string;
}