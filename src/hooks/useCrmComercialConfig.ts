import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CrmGanhaExige = "proposta_aceita" | "contrato_assinado";

export interface CrmComercialConfig {
  empresa_id: string;
  ganha_exige: CrmGanhaExige;
  created_at: string;
  updated_at: string;
}

// Linha única por tenant, semeada por crm_seed_catalogos_padrao (nunca
// deveria faltar, mas maybeSingle por segurança). Nesta fase, o valor de
// ganha_exige ainda não afeta o fechamento de oportunidades — isso só entra
// na Fase E, quando os módulos de Proposta e Contrato existirem de fato.
export function useCrmComercialConfig() {
  return useQuery({
    queryKey: ["crm-comercial-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_comercial_config").select("*").maybeSingle();
      if (error) throw error;
      return data as CrmComercialConfig | null;
    },
  });
}

export function useAtualizarCrmComercialConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { empresaId: string; ganhaExige: CrmGanhaExige }) => {
      const { data, error } = await supabase
        .from("crm_comercial_config")
        .update({ ganha_exige: input.ganhaExige })
        .eq("empresa_id", input.empresaId)
        .select()
        .single();
      if (error) throw error;
      return data as CrmComercialConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-comercial-config"] });
    },
  });
}
