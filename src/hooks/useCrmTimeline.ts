import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmTimelineEvento {
  id: string;
  empresa_id: string;
  crm_empresa_id: string;
  crm_oportunidade_id: string | null;
  origem: "sistema" | "usuario";
  evento_tipo: string;
  descricao: string;
  autor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useCrmTimeline(crmOportunidadeId: string | undefined) {
  return useQuery({
    queryKey: ["crm-timeline", crmOportunidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_timeline")
        .select("*")
        .eq("crm_oportunidade_id", crmOportunidadeId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CrmTimelineEvento[];
    },
    enabled: !!crmOportunidadeId,
  });
}

// Só permite origem='usuario' com autor_id = usuário logado — a RLS de
// crm_timeline reforça exatamente essa regra no banco (eventos 'sistema'
// só entram via trigger/RPC), então esta é a única forma de inserção que o
// client tem disponível.
export function useAddCrmTimelineNota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      empresa_id: string;
      crm_empresa_id: string;
      crm_oportunidade_id?: string | null;
      autor_id: string;
      evento_tipo: string;
      descricao: string;
    }) => {
      const { data, error } = await supabase
        .from("crm_timeline")
        .insert({ ...input, origem: "usuario" })
        .select()
        .single();
      if (error) throw error;
      return data as CrmTimelineEvento;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-timeline", data.crm_oportunidade_id] });
    },
  });
}
