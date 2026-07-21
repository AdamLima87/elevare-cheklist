// CRM Comercial — Buscar Leads: implementação Google Places API (New) da
// interface CompanySearchProvider. Endpoints/campos confirmados na
// documentação oficial atual (developers.google.com/maps/documentation/
// places/web-service/text-search e .../place-details) — não inventados.
//
// Estratégia em duas fases, pelo custo real da API: search() usa Text
// Search (New) com FieldMask mínimo (id/nome/endereço/localização/
// categoria — SKU mais barato). getPlaceDetails() só é chamado pra UM
// place_id por vez (quando o usuário expande/confirma um resultado
// específico), com FieldMask dos campos adicionais (telefone/site/
// avaliação/horário — SKU mais caro, então nunca pedido em lote).
import type {
  CompanyDetails,
  CompanySearchInput,
  CompanySearchProvider,
  CompanySearchResult,
} from "./types.ts";

const PLACES_BASE_URL = "https://places.googleapis.com/v1";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryTypeDisplayName",
  "places.googleMapsUri",
  "nextPageToken",
].join(",");

const DETAILS_FIELD_MASK = [
  "nationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "regularOpeningHours.weekdayDescriptions",
  "googleMapsUri",
].join(",");

async function parseGoogleError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error?.message ?? `Google Places respondeu ${res.status}`;
  } catch {
    return `Google Places respondeu ${res.status}`;
  }
}

export const googlePlacesProvider: CompanySearchProvider = {
  async search(input: CompanySearchInput, apiKey: string): Promise<CompanySearchResult> {
    const res = await fetch(`${PLACES_BASE_URL}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: input.textQuery,
        languageCode: input.languageCode ?? "pt-BR",
        regionCode: input.regionCode ?? "BR",
        ...(input.pageToken ? { pageToken: input.pageToken } : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(await parseGoogleError(res));
    }

    const data = await res.json();
    const places = Array.isArray(data.places) ? data.places : [];

    return {
      resultados: places.map((place: any) => ({
        placeId: place.id,
        nome: place.displayName?.text ?? "",
        endereco: place.formattedAddress ?? null,
        cidade: null, // não extraído do Google — usuário confirma/preenche na importação
        estado: null,
        latitude: place.location?.latitude ?? null,
        longitude: place.location?.longitude ?? null,
        categoria: place.primaryTypeDisplayName?.text ?? null,
        googleMapsUri: place.googleMapsUri ?? null,
      })),
      proximaPagina: data.nextPageToken ?? null,
    };
  },

  async getPlaceDetails(placeId: string, apiKey: string): Promise<CompanyDetails> {
    const res = await fetch(`${PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
    });

    if (!res.ok) {
      throw new Error(await parseGoogleError(res));
    }

    const data = await res.json();

    return {
      placeId,
      telefone: data.nationalPhoneNumber ?? null,
      site: data.websiteUri ?? null,
      avaliacao: typeof data.rating === "number" ? data.rating : null,
      quantidadeAvaliacoes: typeof data.userRatingCount === "number" ? data.userRatingCount : null,
      horarioFuncionamento: Array.isArray(data.regularOpeningHours?.weekdayDescriptions)
        ? data.regularOpeningHours.weekdayDescriptions
        : null,
      googleMapsUri: data.googleMapsUri ?? null,
    };
  },
};
