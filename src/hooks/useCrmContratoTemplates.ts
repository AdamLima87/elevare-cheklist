import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmContratoTemplateSecao {
  titulo: string;
  corpo: string;
}

export interface CrmContratoTemplate {
  id: string;
  empresa_id: string;
  nome: string;
  conteudo: CrmContratoTemplateSecao[];
  ativo: boolean;
  versao: number;
  created_at: string;
  updated_at: string;
}

// 1 template ativo por tenant nesta versão (índice único parcial no banco),
// mas a query já busca todos — a UI de Configurações pode listar histórico.
export function useCrmContratoTemplateAtivo() {
  return useQuery({
    queryKey: ["crm-contrato-template-ativo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_contrato_templates").select("*").eq("ativo", true).maybeSingle();
      if (error) throw error;
      return data as CrmContratoTemplate | null;
    },
  });
}

export function useAtualizarCrmContratoTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; nome?: string; conteudo?: CrmContratoTemplateSecao[] }) => {
      const { data, error } = await supabase.from("crm_contrato_templates").update(input).eq("id", input.id).select().single();
      if (error) throw error;
      return data as CrmContratoTemplate;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-contrato-template-ativo"] }),
  });
}
