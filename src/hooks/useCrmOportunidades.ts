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

export function useCrmOportunidades(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ["crm-oportunidades", pipelineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_oportunidades")
        .select("*, crm_empresas(razao_social, nome_fantasia)")
        .eq("pipeline_id", pipelineId as string)
        .is("fechada_em", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CrmOportunidade[];
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

// Move de etapa "simples" (etapa 'aberta' -> 'aberta'). Fechamento
// ganho/perdido usa uma RPC transacional dedicada (Etapa 7).
export function useMoverEtapaOportunidade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; etapa_id: string; pipeline_id: string }) => {
      const { data, error } = await supabase
        .from("crm_oportunidades")
        .update({ etapa_id: input.etapa_id })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as CrmOportunidade;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-oportunidades", data.pipeline_id] });
      queryClient.invalidateQueries({ queryKey: ["crm-oportunidade", data.id] });
      queryClient.invalidateQueries({ queryKey: ["crm-timeline"] });
    },
  });
}
