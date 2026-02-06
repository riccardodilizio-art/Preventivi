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

    // Servizi offerti
    services: ServiceItem[];

    // Costo totale
    totalCost: string;

    // Footer
    location: string;
    date: string;
    signature: string;
}

export interface ServiceItem {
    /** Nome del servizio principale (o del sottoservizio) */
    description: string;

    /** Costo SOLO del servizio principale (vuoto/undefined per i sottoservizi) */
    cost?: string;

    /** Se true applica IVA a questo servizio (tipicamente solo sul principale) */
    vat?: boolean;

    /** Lista sottoservizi (senza costo) */
    subservices?: SubServiceItem[];
}

export interface SubServiceItem {
    description: string;
}

