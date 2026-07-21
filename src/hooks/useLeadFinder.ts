import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadFinderResultado {
  placeId: string;
  nome: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  categoria: string | null;
  googleMapsUri: string | null;
  jaExisteNoCrm: boolean;
}

export interface LeadFinderDetalhes {
  placeId: string;
  telefone: string | null;
  site: string | null;
  avaliacao: number | null;
  quantidadeAvaliacoes: number | null;
  horarioFuncionamento: string[] | null;
  googleMapsUri: string | null;
}

export interface LeadFinderLimite {
  pode_importar: boolean;
  limite_tipo: "tenant" | "trial" | "mensal";
  limite: number | null;
  usados: number | null;
  disponivel: number | null;
  tem_credencial_propria: boolean;
  periodo_inicio: string | null;
  periodo_fim: string | null;
}

export interface LeadFinderCredencial {
  status: "nao_configurado" | "conectado" | "invalido";
  ultimo_teste_em: string | null;
}

async function invokeLeadFinder<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("lead-finder", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function useLeadFinderSearch() {
  return useMutation({
    mutationFn: (input: { textQuery: string; pageToken?: string }) =>
      invokeLeadFinder<{ resultados: LeadFinderResultado[]; proximaPagina: string | null }>({
        action: "search",
        ...input,
      }),
  });
}

export function useLeadFinderDetails() {
  return useMutation({
    mutationFn: (placeId: string) =>
      invokeLeadFinder<{ detalhes: LeadFinderDetalhes }>({ action: "get_details", placeId }),
  });
}

export function useLeadFinderUsage() {
  return useQuery({
    queryKey: ["lead-finder-usage"],
    queryFn: () =>
      invokeLeadFinder<{ limite: LeadFinderLimite; credencial: LeadFinderCredencial }>({ action: "get_usage" }),
  });
}

export interface LeadFinderImportInput {
  placeId: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cidade?: string | null;
  estado?: string | null;
  site?: string | null;
  whatsapp?: string | null;
  pipelineId: string;
  etapaId: string;
  responsavelId: string;
}

export function useLeadFinderImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LeadFinderImportInput) => invokeLeadFinder({ action: "import", ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-finder-usage"] });
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });
    },
  });
}

export function useSaveLeadFinderCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKey: string) => invokeLeadFinder({ action: "save_credential", apiKey }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead-finder-usage"] }),
  });
}

export function useTestLeadFinderCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => invokeLeadFinder<{ status: string }>({ action: "test_credential" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead-finder-usage"] }),
  });
}

export function useRemoveLeadFinderCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => invokeLeadFinder({ action: "remove_credential" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead-finder-usage"] }),
  });
}
