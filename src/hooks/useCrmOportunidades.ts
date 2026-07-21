import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmOportunidade {
  id: string;
  empresa_id: string;
  crm_empresa_id: string;
  pipeline_id: string;
  etapa_id: string;
  nome: string;
  valor_estimado: number | null;
  probabilidade: number | null;
  responsavel_id: string;
  data_prevista_fechamento: string | null;
  concorrente: string | null;
  motivo_perda_id: string | null;
  motivo_perda_detalhe: string | null;
  observacoes: string | null;
  etapa_alterada_em: string;
  fechada_em: string | null;
  created_at: string;
  updated_at: string;
  crm_empresas?: { razao_social: string; nome_fantasia: string | null } | null;
}

export type CrmSaude = "verde" | "amarelo" | "vermelho" | "fechada";

export interface CrmOportunidadeComSaude extends CrmOportunidade {
  saude: CrmSaude;
  tem_atividade_vencida: boolean;
  ultimo_evento_em: string | null;
}

// Lê de crm_oportunidades_saude (view WITH security_invoker=true, Etapa 4)
// em vez da tabela — mesmas colunas, mais saude/tem_atividade_vencida
// calculados em cada consulta a partir de now(), sem cron.
export function useCrmOportunidades(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ["crm-oportunidades", pipelineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_oportunidades_saude")
        .select("*, crm_empresas(razao_social, nome_fantasia)")
        .eq("pipeline_id", pipelineId as string)
        .is("fechada_em", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CrmOportunidadeComSaude[];
    },
    enabled: !!pipelineId,
  });
}

export function useCrmOportunidade(id: string | undefined) {
  return useQuery({
    queryKey: ["crm-oportunidade", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_oportunidades")
        .select("*, crm_empresas(razao_social, nome_fantasia)")
        .eq("id", id as string)
        .single();
      if (error) throw error;
      return data as CrmOportunidade;
    },
    enabled: !!id,
  });
}

export function useUpsertCrmOportunidade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      empresa_id: string;
      crm_empresa_id: string;
      pipeline_id: string;
      etapa_id: string;
      nome: string;
      valor_estimado?: number | null;
      probabilidade?: number | null;
      responsavel_id: string;
      data_prevista_fechamento?: string | null;
      concorrente?: string | null;
      observacoes?: string | null;
    }) => {
      const { data, error } = await supabase.from("crm_oportunidades").upsert(input).select().single();
      if (error) throw error;
      return data as CrmOportunidade;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-oportunidades", data.pipeline_id] });
      queryClient.invalidateQueries({ queryKey: ["crm-oportunidade", data.id] });
    },
  });
}

// Move de etapa "aberta -> aberta", via RPC atômica que garante a regra de
// "próxima ação obrigatória" (crm_mover_etapa_com_proxima_acao). Se a
// oportunidade ficar sem nenhuma atividade pendente, a RPC exige que o
// caller informe tipo+vencimento da próxima atividade — senão lança um erro
// cuja mensagem começa com "PROXIMA_ACAO_OBRIGATORIA", que a UI reconhece
// pra abrir um dialog de agendamento e tentar de novo.
// Fechamento ganho/perdido usa uma RPC transacional dedicada (Etapa 7).
export function useMoverEtapaOportunidade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      etapa_id: string;
      pipeline_id: string;
      nova_atividade_tipo_id?: string;
      nova_atividade_vencimento?: string;
    }) => {
      const { data, error } = await supabase.rpc("crm_mover_etapa_com_proxima_acao", {
        p_oportunidade_id: input.id,
        p_etapa_id: input.etapa_id,
        p_nova_atividade_tipo_id: input.nova_atividade_tipo_id ?? null,
        p_nova_atividade_vencimento: input.nova_atividade_vencimento ?? null,
      });
      if (error) throw error;
      return data as CrmOportunidade;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-oportunidades", data.pipeline_id] });
      queryClient.invalidateQueries({ queryKey: ["crm-oportunidade", data.id] });
      queryClient.invalidateQueries({ queryKey: ["crm-timeline"] });
      queryClient.invalidateQueries({ queryKey: ["crm-atividades"] });
    },
  });
}

export function isProximaAcaoObrigatoriaError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message;
  return typeof message === "string" && message.startsWith("PROXIMA_ACAO_OBRIGATORIA");
}

export interface FecharOportunidadeGanhaResultado {
  oportunidade_id: string;
  cliente_id: string;
  cliente_criado: boolean;
}

// RPC atômica (Etapa 7): move pra etapa 'ganho', cria/vincula o cliente
// operacional (casando por CNPJ) e registra a timeline, tudo numa
// transação só.
export function useFecharOportunidadeGanha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { oportunidadeId: string; pipelineId: string }) => {
      const { data, error } = await supabase.rpc("crm_fechar_oportunidade_ganha", {
        p_oportunidade_id: input.oportunidadeId,
      });
      if (error) throw error;
      return (data as FecharOportunidadeGanhaResultado[])[0];
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["crm-oportunidades", variables.pipelineId] });
      queryClient.invalidateQueries({ queryKey: ["crm-oportunidade", variables.oportunidadeId] });
      queryClient.invalidateQueries({ queryKey: ["crm-timeline"] });
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-empresas-score"] });
    },
  });
}

// RPC atômica (Etapa 7): move pra etapa 'perdido', exige motivo padronizado.
export function useFecharOportunidadePerdida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      oportunidadeId: string;
      pipelineId: string;
      motivoPerdaId: string;
      motivoPerdaDetalhe?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("crm_fechar_oportunidade_perdida", {
        p_oportunidade_id: input.oportunidadeId,
        p_motivo_perda_id: input.motivoPerdaId,
        p_motivo_perda_detalhe: input.motivoPerdaDetalhe ?? null,
      });
      if (error) throw error;
      return data as CrmOportunidade;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["crm-oportunidades", variables.pipelineId] });
      queryClient.invalidateQueries({ queryKey: ["crm-oportunidade", variables.oportunidadeId] });
      queryClient.invalidateQueries({ queryKey: ["crm-timeline"] });
    },
  });
}
