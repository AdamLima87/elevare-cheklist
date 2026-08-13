import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmServicoCatalogo {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  valor_padrao: number | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

// Só ativos por padrão — a UI de proposta escolhe itens daqui; a UI de
// Configurações usa useCrmServicosCatalogoTodos pra também mostrar inativos.
export function useCrmServicosCatalogo() {
  return useQuery({
    queryKey: ["crm-servicos-catalogo", "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_servicos_catalogo").select("*").eq("ativo", true).order("ordem");
      if (error) throw error;
      return (data ?? []) as CrmServicoCatalogo[];
    },
  });
}

export function useCrmServicosCatalogoTodos() {
  return useQuery({
    queryKey: ["crm-servicos-catalogo", "todos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_servicos_catalogo").select("*").order("ordem");
      if (error) throw error;
      return (data ?? []) as CrmServicoCatalogo[];
    },
  });
}

function invalidarCatalogo(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["crm-servicos-catalogo"] });
}

export function useUpsertCrmServicoCatalogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      empresa_id: string;
      nome: string;
      descricao?: string | null;
      valor_padrao?: number | null;
      ativo?: boolean;
      ordem?: number;
    }) => {
      const { data, error } = await supabase.from("crm_servicos_catalogo").upsert(input).select().single();
      if (error) throw error;
      return data as CrmServicoCatalogo;
    },
    onSuccess: () => invalidarCatalogo(queryClient),
  });
}

// Soft-remove: marca inativo em vez de deletar, pra não quebrar propostas
// antigas que referenciam este serviço via servico_catalogo_id.
export function useRemoverCrmServicoCatalogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_servicos_catalogo").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidarCatalogo(queryClient),
  });
}
