// CRM Comercial — Buscar Leads: interface desacoplada de descoberta de
// estabelecimentos. A UI e a RPC de importação (crm_importar_lead_google)
// nunca dependem da implementação do Google — só desta interface. Permite
// trocar/adicionar outro fornecedor no futuro sem reescrever o resto do
// recurso.

export interface CompanySearchInput {
  textQuery: string; // ex: "restaurantes em Campinas", "padarias no bairro Moema"
  languageCode?: string;
  regionCode?: string;
  pageToken?: string;
}

export interface CompanySearchResultItem {
  placeId: string;
  nome: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  categoria: string | null;
  googleMapsUri: string | null;
}

export interface CompanySearchResult {
  resultados: CompanySearchResultItem[];
  proximaPagina: string | null;
}

export interface CompanyDetails {
  placeId: string;
  telefone: string | null;
  site: string | null;
  avaliacao: number | null;
  quantidadeAvaliacoes: number | null;
  horarioFuncionamento: string[] | null;
  googleMapsUri: string | null;
}

export interface CompanySearchProvider {
  search(input: CompanySearchInput, apiKey: string): Promise<CompanySearchResult>;
  getPlaceDetails(placeId: string, apiKey: string): Promise<CompanyDetails>;
}
