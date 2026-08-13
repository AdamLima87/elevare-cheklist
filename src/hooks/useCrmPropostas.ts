import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CrmPropostaStatus = "rascunho" | "gerada" | "enviada" | "aceita" | "recusada" | "substituida" | "cancelada";
export type CrmPropostaAceiteForma = "email" | "whatsapp" | "assinatura_da_proposta" | "verbal_registrado" | "outro";

export interface CrmProposta {
  id: string;
  empresa_id: string;
  crm_oportunidade_id: string;
  crm_empresa_id: string;
  grupo_proposta_id: string;
  numero_revisao: number;
  revisao_anterior_id: string | null;
  status: CrmPropostaStatus;
  valor_total: number;
  gerada_em: string | null;
  enviada_em: string | null;
  aceite_em: string | null;
  aceite_por: string | null;
  aceite_forma: CrmPropostaAceiteForma | null;
  aceite_observacao: string | null;
  aceite_evidencia_path: string | null;
  recusada_em: string | null;
  recusada_motivo: string | null;
  cancelada_em: string | null;
  cancelada_motivo: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmPropostaItem {
  id: string;
  empresa_id: string;
  proposta_id: string;
  servico_catalogo_id: string | null;
  nome: string;
  descricao: string | null;
  valor: number;
  ordem: number;
  created_at: string;
}

// A proposta "atual" da oportunidade — a mais recente entre todas (qualquer
// status), já que o histórico completo (revisões substituidas + grupos
// anteriores) fica disponível via useCrmPropostasHistorico.
export function useCrmPropostaAtual(oportunidadeId: string | undefined) {
  return useQuery({
    queryKey: ["crm-proposta-atual", oportunidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_propostas")
        .select("*")
        .eq("crm_oportunidade_id", oportunidadeId as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CrmProposta | null;
    },
    enabled: !!oportunidadeId,
  });
}

export function useCrmPropostasHistorico(oportunidadeId: string | undefined) {
  return useQuery({
    queryKey: ["crm-propostas-historico", oportunidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_propostas")
        .select("*")
        .eq("crm_oportunidade_id", oportunidadeId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CrmProposta[];
    },
    enabled: !!oportunidadeId,
  });
}

export function useCrmProposta(propostaId: string | undefined) {
  return useQuery({
    queryKey: ["crm-proposta", propostaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_propostas").select("*").eq("id", propostaId as string).single();
      if (error) throw error;
      return data as CrmProposta;
    },
    enabled: !!propostaId,
  });
}

export function useCrmPropostaItens(propostaId: string | undefined) {
  return useQuery({
    queryKey: ["crm-proposta-itens", propostaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_proposta_itens").select("*").eq("proposta_id", propostaId as string).order("ordem");
      if (error) throw error;
      return (data ?? []) as CrmPropostaItem[];
    },
    enabled: !!propostaId,
  });
}

function invalidarProposta(queryClient: ReturnType<typeof useQueryClient>, oportunidadeId?: string, propostaId?: string) {
  if (oportunidadeId) {
    queryClient.invalidateQueries({ queryKey: ["crm-proposta-atual", oportunidadeId] });
    queryClient.invalidateQueries({ queryKey: ["crm-propostas-historico", oportunidadeId] });
  }
  if (propostaId) {
    queryClient.invalidateQueries({ queryKey: ["crm-proposta", propostaId] });
    queryClient.invalidateQueries({ queryKey: ["crm-proposta-itens", propostaId] });
  }
}

export function useObterOuCriarProposta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (oportunidadeId: string) => {
      const { data, error } = await supabase.rpc("crm_obter_ou_criar_proposta", { p_oportunidade_id: oportunidadeId });
      if (error) throw error;
      return { propostaId: data[0].proposta_id as string, criado: data[0].criado as boolean, oportunidadeId };
    },
    onSuccess: (data) => invalidarProposta(queryClient, data.oportunidadeId),
  });
}

export function useCriarRevisaoProposta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { propostaId: string; oportunidadeId: string }) => {
      const { data, error } = await supabase.rpc("crm_criar_revisao_proposta", { p_proposta_id: input.propostaId });
      if (error) throw error;
      return { novaPropostaId: data[0].proposta_id as string, oportunidadeId: input.oportunidadeId };
    },
    onSuccess: (data) => invalidarProposta(queryClient, data.oportunidadeId),
  });
}

export function useSalvarItensProposta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      propostaId: string;
      oportunidadeId: string;
      itens: { servico_catalogo_id?: string | null; nome: string; descricao?: string | null; valor: number; ordem: number }[];
    }) => {
      const { error } = await supabase.rpc("crm_salvar_itens_proposta", { p_proposta_id: input.propostaId, p_itens: input.itens });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => invalidarProposta(queryClient, data.oportunidadeId, data.propostaId),
  });
}

export function useMarcarPropostaGerada() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { propostaId: string; oportunidadeId: string }) => {
      const { error } = await supabase.rpc("crm_marcar_proposta_gerada", { p_proposta_id: input.propostaId });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => invalidarProposta(queryClient, data.oportunidadeId, data.propostaId),
  });
}

export function useMarcarPropostaEnviada() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { propostaId: string; oportunidadeId: string; canal?: string | null }) => {
      const { error } = await supabase.rpc("crm_marcar_proposta_enviada", { p_proposta_id: input.propostaId, p_canal: input.canal ?? null });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => invalidarProposta(queryClient, data.oportunidadeId, data.propostaId),
  });
}

export function useRegistrarAceiteProposta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      propostaId: string;
      oportunidadeId: string;
      forma: CrmPropostaAceiteForma;
      observacao?: string | null;
      evidenciaPath?: string | null;
    }) => {
      const { error } = await supabase.rpc("crm_registrar_aceite_proposta", {
        p_proposta_id: input.propostaId, p_forma: input.forma, p_observacao: input.observacao ?? null, p_evidencia_path: input.evidenciaPath ?? null,
      });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => invalidarProposta(queryClient, data.oportunidadeId, data.propostaId),
  });
}

export function useCancelarProposta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { propostaId: string; oportunidadeId: string; motivo?: string | null }) => {
      const { error } = await supabase.rpc("crm_cancelar_proposta", { p_proposta_id: input.propostaId, p_motivo: input.motivo ?? null });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => invalidarProposta(queryClient, data.oportunidadeId, data.propostaId),
  });
}

export function useMarcarPropostaRecusada() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { propostaId: string; oportunidadeId: string; motivo?: string | null }) => {
      const { error } = await supabase.rpc("crm_marcar_proposta_recusada", { p_proposta_id: input.propostaId, p_motivo: input.motivo ?? null });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => invalidarProposta(queryClient, data.oportunidadeId, data.propostaId),
  });
}
