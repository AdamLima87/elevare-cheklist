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

// Fase 4: lista simples de oportunidades de uma Conta, usada como ponto de
// entrada pra página de detalhe da oportunidade (/crm/oportunidades/$id) a
// partir da Conta — hoje a Conta não tinha nenhuma listagem de oportunidades.
export function useCrmOportunidadesPorConta(crmEmpresaId: string | undefined) {
  return useQuery({
    queryKey: ["crm-oportunidades-por-conta", crmEmpresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_oportunidades")
        .select("id, nome, etapa_id, valor_estimado, fechada_em")
        .eq("crm_empresa_id", crmEmpresaId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!crmEmpresaId,
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

export interface CrmDiagnosticoRow {
  id: string;
  status: "em_andamento" | "concluida";
  progresso: number;
  conformidade: number | null;
  data_inicio: string;
  data_conclusao: string | null;
  estabelecimento_nome: string | null;
}

// Fase 4: lê diretamente inspecoes (tipo_execucao='diagnostico') filtradas
// pela oportunidade — RLS (inspecoes_diagnostico_select, Fase 3) já garante
// tenant-wide admin/consultor, sem query adicional aqui. Mais de uma linha
// não deveria ocorrer (índice único parcial + RPC idempotente, Fase 4), mas
// a UI trata isso como inconsistência a sinalizar, nunca escolhe sozinha.
export function useCrmDiagnostico(crmOportunidadeId: string | undefined) {
  return useQuery({
    queryKey: ["crm-diagnostico", crmOportunidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecoes")
        .select("id, status, progresso, conformidade, data_inicio, data_conclusao, estabelecimento_nome")
        .eq("crm_oportunidade_id", crmOportunidadeId as string)
        .eq("tipo_execucao", "diagnostico")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as CrmDiagnosticoRow[];
      return { rows, inconsistente: rows.length > 1 };
    },
    enabled: !!crmOportunidadeId,
  });
}

export interface CrmDiagnosticoResumo {
  crm_oportunidade_id: string;
  inspecao_id: string;
  status: "em_andamento" | "concluida";
  progresso: number;
  conformidade: number | null;
  updated_at: string;
}

// Fase 5: versão agregada de useCrmDiagnostico pro Kanban, que renderiza N
// cards de uma vez — uma única query pra todas as oportunidades carregadas,
// em vez de 1 hook por card (N+1). Nunca escolhe entre múltiplos registros
// da mesma oportunidade (>1 é inconsistência, sinalizada pelo consumidor
// via `rows.length`), mesmo princípio de useCrmDiagnostico.
export function useCrmDiagnosticosPorOportunidades(oportunidadeIds: string[]) {
  const ids = [...oportunidadeIds].sort();
  return useQuery({
    queryKey: ["crm-diagnosticos-por-oportunidades", ids],
    queryFn: async () => {
      if (ids.length === 0) return new Map<string, CrmDiagnosticoResumo[]>();
      const { data, error } = await supabase
        .from("inspecoes")
        .select("id, crm_oportunidade_id, status, progresso, conformidade, updated_at")
        .in("crm_oportunidade_id", ids)
        .eq("tipo_execucao", "diagnostico");
      if (error) throw error;

      const porOportunidade = new Map<string, CrmDiagnosticoResumo[]>();
      for (const row of data ?? []) {
        const key = row.crm_oportunidade_id as string;
        const resumo: CrmDiagnosticoResumo = {
          crm_oportunidade_id: key,
          inspecao_id: row.id,
          status: row.status as "em_andamento" | "concluida",
          progresso: row.progresso,
          conformidade: row.conformidade == null ? null : Number(row.conformidade),
          updated_at: row.updated_at,
        };
        const list = porOportunidade.get(key) ?? [];
        list.push(resumo);
        porOportunidade.set(key, list);
      }
      return porOportunidade;
    },
    enabled: ids.length > 0,
  });
}

export interface ObterOuCriarDiagnosticoResultado {
  inspecao_id: string;
  criado: boolean;
}

// RPC idempotente (Fase 4) — nunca faz SELECT-then-INSERT no client. Duas
// chamadas concorrentes (duplo clique, duas abas) sempre retornam o mesmo
// inspecao_id: o lock em crm_oportunidades dentro da RPC serializa a
// segunda chamada, e o índice único parcial é a defesa estrutural.
export function useObterOuCriarDiagnostico() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (crmOportunidadeId: string) => {
      const { data, error } = await supabase.rpc("crm_obter_ou_criar_diagnostico", {
        p_oportunidade_id: crmOportunidadeId,
      });
      if (error) throw error;
      return (data as ObterOuCriarDiagnosticoResultado[])[0];
    },
    onSuccess: (_data, crmOportunidadeId) => {
      queryClient.invalidateQueries({ queryKey: ["crm-diagnostico", crmOportunidadeId] });
      queryClient.invalidateQueries({ queryKey: ["crm-timeline"] });
    },
  });
}

export function isProximaAcaoObrigatoriaError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message;
  return typeof message === "string" && message.startsWith("PROXIMA_ACAO_OBRIGATORIA");
}

// Fase 5: reconhece o erro lançado por crm_fechar_oportunidade_ganha
// quando o pipeline tem etapa de Diagnóstico configurada e o Diagnóstico
// da oportunidade não está concluído — mesmo padrão de
// isProximaAcaoObrigatoriaError (prefixo reconhecível na mensagem).
export function isDiagnosticoNaoConcluidoError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message;
  return typeof message === "string" && message.startsWith("DIAGNOSTICO_NAO_CONCLUIDO");
}

export interface FecharOportunidadeGanhaResultado {
  oportunidade_id: string;
  cliente_id: string;
  cliente_criado: boolean;
  /** Fase 3: total de diagnósticos (tipo_execucao='diagnostico') vinculados a este cliente através desta oportunidade. */
  diagnosticos_vinculados: number;
  /** Fase 3: true quando a oportunidade já estava convertida — a RPC é idempotente, não lança erro na 2ª chamada. */
  already_converted: boolean;
}

// RPC atômica (Etapa 7, ampliada na Fase 3): move pra etapa 'ganho',
// cria/vincula o cliente operacional (casando por CNPJ), vincula os
// diagnósticos pré-venda da oportunidade ao cliente (preservando
// crm_oportunidade_id) e registra a timeline, tudo numa transação só.
// Idempotente: chamar de novo numa oportunidade já convertida retorna o
// mesmo resultado (already_converted=true) em vez de lançar erro.
export function useFecharOportunidadeGanha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { oportunidadeId: string; pipelineId: string; motivoSemDiagnostico?: string }) => {
      const { data, error } = await supabase.rpc("crm_fechar_oportunidade_ganha", {
        p_oportunidade_id: input.oportunidadeId,
        p_motivo_sem_diagnostico: input.motivoSemDiagnostico ?? undefined,
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
