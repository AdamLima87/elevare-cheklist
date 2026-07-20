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
}

export interface CrmCatalogoItem {
  id: string;
  empresa_id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
}

export function useCrmPipelinePadrao() {
  return useQuery({
    queryKey: ["crm-pipeline-padrao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("*")
        .eq("padrao", true)
        .maybeSingle();
      if (error) throw error;
      return data as CrmPipeline | null;
    },
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

function catalogoHooks(table: "crm_motivos_perda" | "crm_tipos_atividade" | "crm_origens_lead") {
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
