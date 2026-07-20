import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CrmAtividadeStatus = "pendente" | "concluida" | "cancelada";

export interface CrmAtividade {
  id: string;
  empresa_id: string;
  crm_empresa_id: string;
  crm_oportunidade_id: string | null;
  tipo_id: string;
  responsavel_id: string;
  vencimento: string;
  status: CrmAtividadeStatus;
  resultado: string | null;
  observacoes: string | null;
  canal: string | null;
  external_id: string | null;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
  crm_tipos_atividade?: { nome: string } | null;
}

export function useCrmAtividadesPorConta(crmEmpresaId: string | undefined) {
  return useQuery({
    queryKey: ["crm-atividades", "conta", crmEmpresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_atividades")
        .select("*, crm_tipos_atividade(nome)")
        .eq("crm_empresa_id", crmEmpresaId as string)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CrmAtividade[];
    },
    enabled: !!crmEmpresaId,
  });
}

export function useCrmAtividadesPorOportunidade(crmOportunidadeId: string | undefined) {
  return useQuery({
    queryKey: ["crm-atividades", "oportunidade", crmOportunidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_atividades")
        .select("*, crm_tipos_atividade(nome)")
        .eq("crm_oportunidade_id", crmOportunidadeId as string)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CrmAtividade[];
    },
    enabled: !!crmOportunidadeId,
  });
}

function invalidateAtividades(queryClient: ReturnType<typeof useQueryClient>, atividade: CrmAtividade) {
  queryClient.invalidateQueries({ queryKey: ["crm-atividades", "conta", atividade.crm_empresa_id] });
  if (atividade.crm_oportunidade_id) {
    queryClient.invalidateQueries({ queryKey: ["crm-atividades", "oportunidade", atividade.crm_oportunidade_id] });
    queryClient.invalidateQueries({ queryKey: ["crm-timeline"] });
  }
}

// Agendamento "solto" (fora do fluxo de mover etapa / concluir atividade) —
// não passa pela regra de próxima ação porque não está fechando nada.
export function useCriarCrmAtividade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      empresa_id: string;
      crm_empresa_id: string;
      crm_oportunidade_id?: string | null;
      tipo_id: string;
      responsavel_id: string;
      vencimento: string;
      observacoes?: string | null;
    }) => {
      const { data, error } = await supabase.from("crm_atividades").insert(input).select().single();
      if (error) throw error;
      return data as CrmAtividade;
    },
    onSuccess: (data) => invalidateAtividades(queryClient, data),
  });
}

// Conclui via RPC crm_concluir_atividade: se for a última atividade
// pendente de uma oportunidade ainda aberta, exige tipo+vencimento da
// próxima (nova_atividade_*) — senão lança erro "PROXIMA_ACAO_OBRIGATORIA".
export function useConcluirCrmAtividade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      resultado?: string | null;
      nova_atividade_tipo_id?: string;
      nova_atividade_vencimento?: string;
    }) => {
      const { data, error } = await supabase.rpc("crm_concluir_atividade", {
        p_atividade_id: input.id,
        p_resultado: input.resultado ?? null,
        p_nova_atividade_tipo_id: input.nova_atividade_tipo_id ?? null,
        p_nova_atividade_vencimento: input.nova_atividade_vencimento ?? null,
      });
      if (error) throw error;
      return data as CrmAtividade;
    },
    onSuccess: (data) => invalidateAtividades(queryClient, data),
  });
}
