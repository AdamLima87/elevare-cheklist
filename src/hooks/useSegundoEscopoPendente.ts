import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SegundoEscopoPendente {
  inspecaoOrigemId: string;
  /** modeloVersaoId do escopo ainda não inspecionado, ou uma string descritiva
   * (ex.: "producao_industrializacao") quando não havia legislação sugerida
   * automaticamente pra esse escopo no momento da decisão. */
  modeloOuEscopoNaoInspecionado: string | null;
  ufConsiderada: string | null;
  atividadesConsideradas: string[];
}

/**
 * Fase 9.G — quando o consultor escolhe "Realizar inspeções separadas" no
 * alerta de múltiplos escopos, a inspeção criada agora registra
 * `segundoEscopoPendente: true`. Este hook procura, entre as inspeções do
 * cliente, a mais recente com esse sinal ainda sem `segundaInspecaoId`
 * preenchido — ou seja, o segundo escopo que ainda falta inspecionar.
 * Busca client-side (não via filtro JSONB no PostgREST) porque o campo é
 * opcional e nem toda inspeção antiga tem esse shape.
 */
export function useSegundoEscopoPendente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["segundo-escopo-pendente", clienteId],
    queryFn: async (): Promise<SegundoEscopoPendente | null> => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from("inspecoes")
        .select("id, dados")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      for (const row of data ?? []) {
        const rec = (row as any).dados?.recomendacaoLegislacao;
        if (rec?.segundoEscopoPendente === true && !rec?.segundaInspecaoId) {
          return {
            inspecaoOrigemId: (row as any).id,
            modeloOuEscopoNaoInspecionado: rec.modeloOuEscopoNaoInspecionado ?? null,
            ufConsiderada: rec.ufConsiderada ?? null,
            atividadesConsideradas: rec.atividadesConsideradas ?? [],
          };
        }
      }
      return null;
    },
    enabled: Boolean(clienteId),
    staleTime: 30_000,
  });
}
