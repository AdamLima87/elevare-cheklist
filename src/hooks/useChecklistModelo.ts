import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { carregarChecklistModelo } from "@/lib/checklist-modelo-service";

/**
 * Wrapper fino de React Query sobre `carregarChecklistModelo` — a única
 * forma que componentes React consomem o checklist resolvido. Conteúdo
 * publicado é imutável por design (Fase 7.1), então o cache não expira.
 */
export function useChecklistModelo(modeloVersaoId: string | null | undefined) {
  return useQuery({
    queryKey: ["checklist-modelo", modeloVersaoId],
    queryFn: () => carregarChecklistModelo(supabase, modeloVersaoId as string),
    enabled: !!modeloVersaoId,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
