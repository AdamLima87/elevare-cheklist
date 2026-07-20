import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmContato {
  id: string;
  empresa_id: string;
  crm_empresa_id: string;
  nome: string;
  cargo: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCrmContatos(crmEmpresaId: string | undefined) {
  return useQuery({
    queryKey: ["crm-contatos", crmEmpresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_contatos")
        .select("*")
        .eq("crm_empresa_id", crmEmpresaId as string)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as CrmContato[];
    },
    enabled: !!crmEmpresaId,
  });
}

export function useUpsertCrmContato() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      empresa_id: string;
      crm_empresa_id: string;
      nome: string;
      cargo?: string | null;
      telefone?: string | null;
      whatsapp?: string | null;
      email?: string | null;
      observacoes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("crm_contatos")
        .upsert(input)
        .select()
        .single();
      if (error) throw error;
      return data as CrmContato;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-contatos", data.crm_empresa_id] });
    },
  });
}

export function useDeleteCrmContato() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; crm_empresa_id: string }) => {
      const { error } = await supabase.from("crm_contatos").delete().eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      queryClient.invalidateQueries({ queryKey: ["crm-contatos", input.crm_empresa_id] });
    },
  });
}
