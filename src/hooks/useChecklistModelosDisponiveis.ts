import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChecklistModeloDisponivel {
  modeloVersaoId: string;
  modeloId: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  /** Fase 9.D — UF/esfera/vigência da legislação, para o motor de recomendação. */
  legislacaoUf: string | null;
  legislacaoEsfera: "federal" | "estadual" | null;
  vigenteDesde: string | null;
  publicadaEm: string | null;
}

/**
 * Lista os modelos de checklist publicados e disponíveis para novos
 * diagnósticos/inspeções. Fases 8/9 só precisam inserir linhas novas em
 * checklist_modelos/checklist_modelo_versoes; esta query já passa a devolver
 * mais opções sem nenhuma mudança de código.
 */
export function useChecklistModelosDisponiveis() {
  return useQuery({
    queryKey: ["checklist-modelos-disponiveis"],
    queryFn: async (): Promise<ChecklistModeloDisponivel[]> => {
      const { data, error } = await supabase
        .from("checklist_modelo_versoes")
        .select(
          "id, modelo_id, is_versao_atual, checklist_modelos(id, codigo, nome, descricao, ativo, legislacao_versoes(id, vigente_desde, publicada_em, legislacoes(id, uf, esfera)))",
        )
        .eq("is_versao_atual", true)
        .eq("ativo", true)
        .not("publicado_em", "is", null);
      if (error) throw error;
      return (data ?? [])
        .filter((row: any) => row.checklist_modelos?.ativo)
        .map((row: any) => {
          const legislacaoVersao = row.checklist_modelos.legislacao_versoes;
          const legislacao = legislacaoVersao?.legislacoes;
          return {
            modeloVersaoId: row.id,
            modeloId: row.modelo_id,
            nome: row.checklist_modelos.nome,
            codigo: row.checklist_modelos.codigo,
            descricao: row.checklist_modelos.descricao ?? null,
            legislacaoUf: legislacao?.uf ?? null,
            legislacaoEsfera: legislacao?.esfera ?? null,
            vigenteDesde: legislacaoVersao?.vigente_desde ?? null,
            publicadaEm: legislacaoVersao?.publicada_em ?? null,
          };
        });
    },
    staleTime: 5 * 60 * 1000,
  });
}
