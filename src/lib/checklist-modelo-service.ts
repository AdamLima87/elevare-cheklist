import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistItem, ChecklistSection } from "./checklist-types";

export interface ChecklistModeloResolvido {
  modeloVersaoId: string;
  secoes: ChecklistSection[];
  totalItens: number;
  criticalItemIds: Set<string>;
}

export class ChecklistModeloNaoEncontradoError extends Error {
  constructor(public readonly modeloVersaoId: string) {
    super(`Modelo de checklist não encontrado: ${modeloVersaoId}`);
    this.name = "ChecklistModeloNaoEncontradoError";
  }
}

/**
 * Fonte única de leitura do checklist resolvido (seções + itens) a partir de
 * checklist_modelo_versao_id. Não depende de React — usada tanto pelo hook
 * `useChecklistModelo` (componentes) quanto diretamente por `storage.ts`,
 * `pdf.ts` e rotas de servidor, que nunca devem depender de um hook.
 */
export async function carregarChecklistModelo(
  supabase: SupabaseClient<any, any>,
  modeloVersaoId: string,
): Promise<ChecklistModeloResolvido> {
  const [{ data: secoesRows, error: secoesError }, { data: itensRows, error: itensError }] = await Promise.all([
    supabase
      .from("checklist_secoes")
      .select("id, secao_key, titulo, ordem")
      .eq("modelo_versao_id", modeloVersaoId)
      .order("ordem"),
    supabase
      .from("checklist_itens")
      .select("secao_id, item_key, texto, critico, ordem")
      .eq("modelo_versao_id", modeloVersaoId)
      .order("ordem"),
  ]);

  if (secoesError) throw secoesError;
  if (itensError) throw itensError;

  if (!secoesRows || secoesRows.length === 0) {
    throw new ChecklistModeloNaoEncontradoError(modeloVersaoId);
  }

  const itensPorSecaoId = new Map<string, ChecklistItem[]>();
  const criticalItemIds = new Set<string>();
  let totalItens = 0;

  for (const row of itensRows ?? []) {
    totalItens++;
    if (row.critico) criticalItemIds.add(row.item_key);
    const item: ChecklistItem = { id: row.item_key, text: row.texto, critico: row.critico || undefined };
    const lista = itensPorSecaoId.get(row.secao_id) ?? [];
    lista.push(item);
    itensPorSecaoId.set(row.secao_id, lista);
  }

  const secoes: ChecklistSection[] = secoesRows.map((s) => ({
    id: s.secao_key,
    title: s.titulo,
    items: itensPorSecaoId.get(s.id) ?? [],
  }));

  return { modeloVersaoId, secoes, totalItens, criticalItemIds };
}

/** Equivalente a `contarNCCriticas` de checklist-data.ts, mas dirigido pelo modelo resolvido. */
export function contarNCCriticasModelo(
  modelo: Pick<ChecklistModeloResolvido, "criticalItemIds">,
  respostas: Record<string, string | null | undefined> | null | undefined,
): number {
  if (!respostas) return 0;
  let n = 0;
  for (const id of modelo.criticalItemIds) {
    if (respostas[id] === "N") n++;
  }
  return n;
}
