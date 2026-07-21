import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmBuscaResultado {
  tipo: "conta" | "contato";
  id: string;
  titulo: string;
  subtitulo: string | null;
  crm_empresa_id: string;
}

// RPC crm_busca_global (Etapa 6): um round-trip só, UNION entre
// crm_empresas/crm_contatos/responsável. Só dispara com 2+ caracteres.
export function useCrmSearch(query: string) {
  const termo = query.trim();
  return useQuery({
    queryKey: ["crm-busca-global", termo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("crm_busca_global", { p_query: termo });
      if (error) throw error;
      return (data ?? []) as CrmBuscaResultado[];
    },
    enabled: termo.length >= 2,
  });
}
