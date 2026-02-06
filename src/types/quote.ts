export interface QuoteData {
  companyName: string;
  companyAddress: string;
  companyCity: string;
  taxCode: string;
  vatNumber: string;
  subject: string;
  serviceDescription: string;
  services: ServiceItem[];
  totalCost: string;
  location: string;
  date: string;
  signature: string;
}

export interface ServiceItem {
  description: string;
  cost?: string;
  vat?: boolean;
  subservices?: SubServiceItem[];
}

export interface SubServiceItem {
  description: string;
}
