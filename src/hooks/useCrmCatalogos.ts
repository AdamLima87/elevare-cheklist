import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmPipeline {
  id: string;
  empresa_id: string;
  nome: string;
  padrao: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type CrmEtapaTipo = "aberta" | "ganho" | "perdido";

export interface CrmEtapa {
  id: string;
  empresa_id: string;
  pipeline_id: string;
  nome: string;
  ordem: number;
  tipo: CrmEtapaTipo;
  cor: string | null;
  created_at: string;
  /** Fase 2: flag independente de `tipo` — não altera comportamento até a Fase 5 (toggle de configuração). */
  gera_diagnostico: boolean;
  /** Marca a(s) etapa(s) que representam "proposta enviada" — usado pela Mesa de Trabalho em vez de casar texto no nome. */
  eh_proposta: boolean;
}

export interface CrmCatalogoItem {
  id: string;
  empresa_id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
}

export function useCrmPipelinePadrao(empresaId: string | undefined) {
  return useQuery({
    queryKey: ["crm-pipeline-padrao", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("*")
        .eq("padrao", true)
        .eq("empresa_id", empresaId as string)
        .maybeSingle();
      if (error) throw error;
      return data as CrmPipeline | null;
    },
    enabled: !!empresaId,
  });
}

export function useCrmEtapas(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ["crm-etapas", pipelineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_etapas")
        .select("*")
        .eq("pipeline_id", pipelineId as string)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as CrmEtapa[];
    },
    enabled: !!pipelineId,
  });
}

// Fase 5: nome/cor/tipo/ordem continuam editados por upsert direto
// client-side (mesmo padrão dos 4 catálogos abaixo — RLS de crm_etapas já
// restringe INSERT/UPDATE/DELETE a admin). Só gera_diagnostico passa pela
// RPC dedicada (useDefinirEtapaDiagnostico), que precisa de unicidade
// transacional + auditoria. A CHECK constraint do banco
// (crm_etapas_diagnostico_somente_aberta_check) é quem impede este upsert
// de deixar uma etapa gera_diagnostico=true com tipo≠'aberta' — se isso
// for tentado, o UPDATE falha com 23514.
export function useUpsertCrmEtapa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      empresa_id: string;
      pipeline_id: string;
      nome: string;
      ordem: number;
      tipo?: CrmEtapaTipo;
      cor?: string | null;
      eh_proposta?: boolean;
    }) => {
      const { data, error } = await supabase.from("crm_etapas").upsert(input).select().single();
      if (error) throw error;
      return data as CrmEtapa;
    },
    onSuccess: (etapa) => {
      queryClient.invalidateQueries({ queryKey: ["crm-etapas", etapa.pipeline_id] });
    },
  });
}

export function useDeleteCrmEtapa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pipelineId }: { id: string; pipelineId: string }) => {
      const { error } = await supabase.from("crm_etapas").delete().eq("id", id);
      if (error) throw error;
      return pipelineId;
    },
    onSuccess: (pipelineId) => {
      queryClient.invalidateQueries({ queryKey: ["crm-etapas", pipelineId] });
    },
  });
}

export interface DefinirEtapaDiagnosticoResultado {
  pipeline_id: string;
  etapa_diagnostico_id: string | null;
}

export function useDefinirEtapaDiagnostico() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, etapaId }: { pipelineId: string; etapaId: string | null }) => {
      const { data, error } = await supabase.rpc("crm_definir_etapa_diagnostico", {
        p_pipeline_id: pipelineId,
        p_etapa_id: etapaId,
      });
      if (error) throw error;
      return (data as DefinirEtapaDiagnosticoResultado[])[0];
    },
    onSuccess: (_data, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: ["crm-etapas", pipelineId] });
    },
  });
}

/** Reconhece a violação da CHECK que impede etapa de fechamento marcada
 * como Diagnóstico (23514) — usado pra traduzir o erro cru do upsert de
 * etapa numa mensagem clara, sem vazar SQL. */
export function isDiagnosticoSomenteAbertaError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "23514";
}

function catalogoHooks(table: "crm_motivos_perda" | "crm_tipos_atividade" | "crm_origens_lead" | "crm_leads_nichos") {
  function useList() {
    return useQuery({
      queryKey: [table],
      queryFn: async () => {
        const { data, error } = await supabase.from(table).select("*").order("ordem");
        if (error) throw error;
        return (data ?? []) as CrmCatalogoItem[];
      },
    });
  }

  function useUpsert() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (input: { id?: string; empresa_id: string; nome: string; ativo?: boolean; ordem?: number }) => {
        const { data, error } = await supabase.from(table).upsert(input).select().single();
        if (error) throw error;
        return data as CrmCatalogoItem;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
    });
  }

  function useDelete() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [table] }),
    });
  }

  return { useList, useUpsert, useDelete };
}

const motivosPerda = catalogoHooks("crm_motivos_perda");
export const useCrmMotivosPerda = motivosPerda.useList;
export const useUpsertCrmMotivoPerda = motivosPerda.useUpsert;
export const useDeleteCrmMotivoPerda = motivosPerda.useDelete;

const tiposAtividade = catalogoHooks("crm_tipos_atividade");
export const useCrmTiposAtividade = tiposAtividade.useList;
export const useUpsertCrmTipoAtividade = tiposAtividade.useUpsert;
export const useDeleteCrmTipoAtividade = tiposAtividade.useDelete;

const origensLead = catalogoHooks("crm_origens_lead");
export const useCrmOrigensLead = origensLead.useList;
export const useUpsertCrmOrigemLead = origensLead.useUpsert;
export const useDeleteCrmOrigemLead = origensLead.useDelete;

const leadsNichos = catalogoHooks("crm_leads_nichos");
export const useCrmLeadsNichos = leadsNichos.useList;
export const useUpsertCrmLeadsNicho = leadsNichos.useUpsert;
export const useDeleteCrmLeadsNicho = leadsNichos.useDelete;
