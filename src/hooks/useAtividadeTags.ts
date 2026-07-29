import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AtividadeTag {
  codigo: string;
  nome: string;
}

/**
 * Catálogo global de atividades (Fase 9.C) usado para a captura de contexto
 * na Nova Inspeção/Diagnóstico e pelo motor de recomendação (Fase 9.D).
 * Vocabulário fechado — só entra código novo via migration.
 */
export function useAtividadeTags() {
  return useQuery({
    queryKey: ["atividade-tags"],
    queryFn: async (): Promise<AtividadeTag[]> => {
      const { data, error } = await supabase
        .from("atividade_tags")
        .select("codigo, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });
}
