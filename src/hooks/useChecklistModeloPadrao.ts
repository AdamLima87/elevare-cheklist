import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChecklistModelo } from "./useChecklistModelo";

/**
 * Resolve e carrega o modelo de checklist PADRÃO (via
 * resolver_checklist_modelo_padrao) — usado em telas de listagem/resumo
 * (dashboard, relatórios, hub do cliente) que hoje mostram badges/contagens
 * agregadas sem depender de qual inspeção específica está sendo exibida.
 * Enquanto só existe um modelo (RDC 275), isso é equivalente a resolver o
 * modelo de cada inspeção individualmente; quando a Fase 8/9 introduzir um
 * segundo modelo em uso real, essas telas de resumo são candidatas a uma
 * revisão própria — não é um problema desta fase.
 */
export function useChecklistModeloPadrao() {
  const { data: modeloVersaoId } = useQuery({
    queryKey: ["checklist-modelo-padrao-id"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolver_checklist_modelo_padrao");
      if (error) throw error;
      return data as string;
    },
    staleTime: 5 * 60 * 1000,
  });
  return useChecklistModelo(modeloVersaoId);
}
