import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CrmDocumentoLinkTipo = "proposta" | "contrato";

// Nunca inclui token_hash — o SELECT direto (RLS + GRANT de coluna) já
// bloqueia essa coluna pra qualquer client autenticado normal, então nem
// tentamos pedir. Ver crm_documentos_links no banco.
export interface CrmDocumentoLink {
  id: string;
  empresa_id: string;
  tipo: CrmDocumentoLinkTipo;
  proposta_id: string | null;
  contrato_id: string | null;
  expira_em: string;
  revogado_em: string | null;
  created_by: string | null;
  created_at: string;
}

export function useCrmDocumentosLinks(tipo: CrmDocumentoLinkTipo, id: string | undefined) {
  return useQuery({
    queryKey: ["crm-documentos-links", tipo, id],
    queryFn: async () => {
      const coluna = tipo === "proposta" ? "proposta_id" : "contrato_id";
      const { data, error } = await supabase
        .from("crm_documentos_links")
        .select("id, empresa_id, tipo, proposta_id, contrato_id, expira_em, revogado_em, created_by, created_at")
        .eq(coluna, id as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CrmDocumentoLink[];
    },
    enabled: !!id,
  });
}

// Devolve o token bruto SÓ nesta resposta — nunca mais recuperável depois.
// A UI deve montar a URL completa (`${window.location.origin}/documento/${token}`)
// e mostrá-la uma única vez pro consultor copiar; se perdida, gerar outra.
export function useGerarLinkDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tipo: CrmDocumentoLinkTipo; id: string; validadeDias?: number }) => {
      const { data, error } = await supabase.rpc("crm_gerar_link_documento", {
        p_tipo: input.tipo, p_id: input.id, p_validade_dias: input.validadeDias ?? 30,
      });
      if (error) throw error;
      return {
        token: data[0].token as string,
        linkId: data[0].link_id as string,
        expiraEm: data[0].expira_em as string,
        url: `${window.location.origin}/documento/${data[0].token}`,
      };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["crm-documentos-links", variables.tipo, variables.id] });
    },
  });
}

export function useRevogarLinkDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { linkId: string; tipo: CrmDocumentoLinkTipo; id: string }) => {
      const { error } = await supabase.rpc("crm_revogar_link_documento", { p_link_id: input.linkId });
      if (error) throw error;
      return input;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-documentos-links", data.tipo, data.id] });
    },
  });
}
