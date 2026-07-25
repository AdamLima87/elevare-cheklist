import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReinspecaoStatus = "programada" | "reagendada" | "iniciada" | "realizada" | "cancelada";

export interface ReinspecaoProgramacao {
  id: string;
  inspecao_origem_id: string;
  cliente_id: string | null;
  responsavel_id: string | null;
  inspecao_criada_id: string | null;
  data_prevista: string;
  observacao: string | null;
  status: ReinspecaoStatus;
  created_at: string;
}

/** Programação ativa (não cancelada/realizada) de uma inspeção — no máximo 1 por vez faz sentido mostrar. */
export function useProgramacaoReinspecao(inspecaoOrigemId: string | undefined) {
  return useQuery({
    queryKey: ["reinspecao-programacao", inspecaoOrigemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reinspecao_programacoes")
        .select("*")
        .eq("inspecao_origem_id", inspecaoOrigemId as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ReinspecaoProgramacao | null;
    },
    enabled: !!inspecaoOrigemId,
  });
}

/** Histórico completo de programações de um cliente — usado na aba "Reinspeções" do hub do cliente. */
export function useReinspecaoProgramacoesCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["reinspecao-programacoes-cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reinspecao_programacoes")
        .select("*, inspecao_origem:inspecoes!reinspecao_programacoes_inspecao_origem_id_empresa_id_fkey(numero_sequencial)")
        .eq("cliente_id", clienteId as string)
        .order("data_prevista", { ascending: false });
      if (error) throw error;
      return data as (ReinspecaoProgramacao & { inspecao_origem: { numero_sequencial: number } | null })[];
    },
    enabled: !!clienteId,
  });
}

function useInvalidateReinspecao() {
  const queryClient = useQueryClient();
  return (programacao?: { inspecao_origem_id?: string; cliente_id?: string | null } | null) => {
    queryClient.invalidateQueries({ queryKey: ["reinspecao-programacao"] });
    queryClient.invalidateQueries({ queryKey: ["reinspecao-programacoes-cliente"] });
    if (programacao?.inspecao_origem_id) {
      queryClient.invalidateQueries({ queryKey: ["reinspecao-programacao", programacao.inspecao_origem_id] });
    }
  };
}

export function useCriarProgramacaoReinspecao() {
  const invalidate = useInvalidateReinspecao();
  return useMutation({
    mutationFn: async (input: {
      inspecaoOrigemId: string;
      dataPrevista: string;
      responsavelId?: string;
      observacao?: string;
    }) => {
      const { data, error } = await supabase.rpc("criar_programacao_reinspecao", {
        p_inspecao_origem_id: input.inspecaoOrigemId,
        p_data_prevista: input.dataPrevista,
        p_responsavel_id: input.responsavelId ?? null,
        p_observacao: input.observacao ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidate(),
  });
}

export function useReagendarProgramacaoReinspecao() {
  const invalidate = useInvalidateReinspecao();
  return useMutation({
    mutationFn: async (input: { programacaoId: string; novaData: string; observacao?: string }) => {
      const { error } = await supabase.rpc("reagendar_programacao_reinspecao", {
        p_programacao_id: input.programacaoId,
        p_nova_data: input.novaData,
        p_observacao: input.observacao ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useCancelarProgramacaoReinspecao() {
  const invalidate = useInvalidateReinspecao();
  return useMutation({
    mutationFn: async (input: { programacaoId: string; observacao?: string }) => {
      const { error } = await supabase.rpc("cancelar_programacao_reinspecao", {
        p_programacao_id: input.programacaoId,
        p_observacao: input.observacao ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });
}

export function useIniciarReinspecao() {
  const invalidate = useInvalidateReinspecao();
  return useMutation({
    mutationFn: async (input: { programacaoId: string; responsavelId?: string }) => {
      const { data, error } = await supabase.rpc("iniciar_reinspecao", {
        p_programacao_id: input.programacaoId,
        p_responsavel_id: input.responsavelId ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidate(),
  });
}
