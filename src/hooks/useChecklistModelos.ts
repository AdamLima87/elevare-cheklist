import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { carregarChecklistModelos } from "@/lib/checklist-modelo-service";

/**
 * Fase 8.B — wrapper de React Query sobre `carregarChecklistModelos`
 * (versão em lote), pra telas que listam inspeções de modelos possivelmente
 * diferentes (relatórios, dashboard, planos de ação, comparativo). Nunca
 * usar `useChecklistModeloPadrao` nesses casos — cada inspeção deve ser
 * resolvida pelo seu próprio `checklist_modelo_versao_id`, não pelo padrão
 * global. Conteúdo publicado é imutável por design (Fase 7.1), cache não
 * expira.
 */
export function useChecklistModelos(modeloVersaoIds: (string | null | undefined)[]) {
  const ids = [...new Set(modeloVersaoIds.filter((id): id is string => !!id))].sort();
  return useQuery({
    queryKey: ["checklist-modelos", ids],
    queryFn: () => carregarChecklistModelos(supabase, ids),
    enabled: ids.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
