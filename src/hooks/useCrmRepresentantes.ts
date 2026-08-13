import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmRepresentante {
  id: string;
  empresa_id: string;
  crm_empresa_id: string;
  nome_completo: string;
  cpf: string | null;
  rg: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  principal: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Só representantes ativos — os inativos (soft-remove) continuam no banco
// pra preservar histórico de contratos antigos, mas nunca aparecem na
// lista de edição/seleção de uma Conta.
export function useCrmRepresentantes(crmEmpresaId: string | undefined) {
  return useQuery({
    queryKey: ["crm-representantes", crmEmpresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_representantes")
        .select("*")
        .eq("crm_empresa_id", crmEmpresaId as string)
        .eq("ativo", true)
        .order("principal", { ascending: false })
        .order("nome_completo");
      if (error) throw error;
      return (data ?? []) as CrmRepresentante[];
    },
    enabled: !!crmEmpresaId,
  });
}

export function useUpsertCrmRepresentante() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      empresa_id: string;
      crm_empresa_id: string;
      nome_completo: string;
      cpf?: string | null;
      rg?: string | null;
      cargo?: string | null;
      email?: string | null;
      telefone?: string | null;
      principal?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("crm_representantes")
        .upsert(input)
        .select()
        .single();
      if (error) throw error;
      return data as CrmRepresentante;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-representantes", data.crm_empresa_id] });
    },
  });
}

// Troca o principal em 2 passos (sem RPC nesta fase): desmarca o atual,
// depois marca o novo — nessa ordem, pra nunca colidir com o índice único
// parcial (principal AND ativo) que só permite 1 por vez.
export function useMarcarRepresentantePrincipal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; crmEmpresaId: string }) => {
      const { error: errUnset } = await supabase
        .from("crm_representantes")
        .update({ principal: false })
        .eq("crm_empresa_id", input.crmEmpresaId)
        .eq("principal", true);
      if (errUnset) throw errUnset;

      const { data, error } = await supabase
        .from("crm_representantes")
        .update({ principal: true })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as CrmRepresentante;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-representantes", data.crm_empresa_id] });
    },
  });
}

// Soft-remove: nunca DELETE, só ativo=false — preserva o histórico pra
// contratos que já usaram este representante no snapshot deles.
export function useRemoverCrmRepresentante() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; crmEmpresaId: string }) => {
      const { error } = await supabase
        .from("crm_representantes")
        .update({ ativo: false, principal: false })
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      queryClient.invalidateQueries({ queryKey: ["crm-representantes", input.crmEmpresaId] });
    },
  });
}
