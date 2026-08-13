import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CrmContratoStatus = "rascunho" | "gerado" | "enviado" | "assinado" | "cancelado";

export interface CrmContratoDados {
  contratada: { razao_social: string | null; cnpj: string | null };
  cliente: Record<string, unknown>;
  representante: { nome_completo: string; cpf: string | null; rg: string | null; cargo: string | null } | null;
  proposta: { id: string; numero_revisao: number; itens: { nome: string; descricao: string | null; valor: number; ordem: number }[]; valor_total: number };
  contrato: { prazo: string; forma_pagamento: string };
  template: { id: string; nome: string; versao: number; conteudo: { titulo: string; corpo: string }[] };
  variaveis: Record<string, string>;
  conteudo_renderizado: { titulo: string; corpo: string }[];
}

export interface CrmContrato {
  id: string;
  empresa_id: string;
  crm_oportunidade_id: string;
  crm_proposta_id: string;
  crm_empresa_id: string;
  crm_contrato_template_id: string;
  status: CrmContratoStatus;
  dados: CrmContratoDados | null;
  gerado_em: string | null;
  enviado_em: string | null;
  assinado_em: string | null;
  assinado_por: string | null;
  arquivo_assinado_path: string | null;
  justificativa_sem_arquivo: string | null;
  origem_assinatura: "upload_manual" | "assinatura_eletronica";
  cancelado_em: string | null;
  cancelado_motivo: string | null;
  created_at: string;
  updated_at: string;
}

// Contrato não-cancelado mais recente da oportunidade (no máximo 1 por
// desenho — índice único parcial no banco).
export function useCrmContratoAtual(oportunidadeId: string | undefined) {
  return useQuery({
    queryKey: ["crm-contrato-atual", oportunidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_contratos")
        .select("*")
        .eq("crm_oportunidade_id", oportunidadeId as string)
        .neq("status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CrmContrato | null;
    },
    enabled: !!oportunidadeId,
  });
}

export function useCrmContrato(contratoId: string | undefined) {
  return useQuery({
    queryKey: ["crm-contrato", contratoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_contratos").select("*").eq("id", contratoId as string).single();
      if (error) throw error;
      return data as CrmContrato;
    },
    enabled: !!contratoId,
  });
}

function invalidarContrato(queryClient: ReturnType<typeof useQueryClient>, oportunidadeId?: string, contratoId?: string) {
  if (oportunidadeId) queryClient.invalidateQueries({ queryKey: ["crm-contrato-atual", oportunidadeId] });
  if (contratoId) queryClient.invalidateQueries({ queryKey: ["crm-contrato", contratoId] });
}

export function useObterOuCriarContrato() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { propostaId: string; oportunidadeId: string }) => {
      const { data, error } = await supabase.rpc("crm_obter_ou_criar_contrato", { p_proposta_id: input.propostaId });
      if (error) throw error;
      return { contratoId: data[0].contrato_id as string, criado: data[0].criado as boolean, oportunidadeId: input.oportunidadeId };
    },
    onSuccess: (data) => invalidarContrato(queryClient, data.oportunidadeId, data.contratoId),
  });
}

export function useAtualizarSnapshotContratoRascunho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contratoId: string; oportunidadeId: string }) => {
      const { error } = await supabase.rpc("crm_atualizar_snapshot_contrato_rascunho", { p_contrato_id: input.contratoId });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => invalidarContrato(queryClient, data.oportunidadeId, data.contratoId),
  });
}

export function useMarcarContratoGerado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contratoId: string; oportunidadeId: string }) => {
      const { error } = await supabase.rpc("crm_marcar_contrato_gerado", { p_contrato_id: input.contratoId });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => invalidarContrato(queryClient, data.oportunidadeId, data.contratoId),
  });
}

export function useMarcarContratoEnviado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contratoId: string; oportunidadeId: string }) => {
      const { error } = await supabase.rpc("crm_marcar_contrato_enviado", { p_contrato_id: input.contratoId });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => invalidarContrato(queryClient, data.oportunidadeId, data.contratoId),
  });
}

export function useMarcarContratoAssinado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contratoId: string; oportunidadeId: string; arquivoPath?: string | null; justificativa?: string | null }) => {
      const { error } = await supabase.rpc("crm_marcar_contrato_assinado", {
        p_contrato_id: input.contratoId, p_arquivo_path: input.arquivoPath ?? null, p_justificativa: input.justificativa ?? null,
      });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => invalidarContrato(queryClient, data.oportunidadeId, data.contratoId),
  });
}

// Nunca pode cancelar contrato assinado — a RPC rejeita explicitamente
// (CONTRATO_ASSINADO_NAO_CANCELAVEL), a UI só deveria oferecer esta ação
// pra rascunho/gerado/enviado.
export function useCancelarContrato() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contratoId: string; oportunidadeId: string; motivo?: string | null }) => {
      const { error } = await supabase.rpc("crm_cancelar_contrato", { p_contrato_id: input.contratoId, p_motivo: input.motivo ?? null });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => invalidarContrato(queryClient, data.oportunidadeId, data.contratoId),
  });
}
