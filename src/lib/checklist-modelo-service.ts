import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistItem, ChecklistSection } from "./checklist-types";

export interface ChecklistModeloResolvido {
  modeloVersaoId: string;
  /** Nome do modelo (ex.: "Checklist RDC 275/2002 - Padrão RDCheck") — Fase
   * 8.B, usado pra identificar a legislação em PDF e telas com múltiplos
   * modelos em uso. */
  modeloNome: string;
  /** Código do modelo (ex.: "RDC_275_2002_PADRAO") — Fase 8.B, usado em
   * nomes de arquivo (PDF) pra distinguir modelos sem depender do nome
   * completo, que pode ter espaços/acentos. */
  modeloCodigo: string;
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

function montarModeloResolvido(
  modeloVersaoId: string,
  modeloNome: string,
  modeloCodigo: string,
  secoesRows: { id: string; secao_key: string; titulo: string; ordem: number }[],
  itensRows: { secao_id: string; item_key: string; texto: string; critico: boolean; ordem: number }[],
): ChecklistModeloResolvido {
  const itensPorSecaoId = new Map<string, ChecklistItem[]>();
  const criticalItemIds = new Set<string>();
  let totalItens = 0;

  for (const row of itensRows) {
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

  return { modeloVersaoId, modeloNome, modeloCodigo, secoes, totalItens, criticalItemIds };
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
  const modelos = await carregarChecklistModelos(supabase, [modeloVersaoId]);
  const modelo = modelos.get(modeloVersaoId);
  if (!modelo) throw new ChecklistModeloNaoEncontradoError(modeloVersaoId);
  return modelo;
}

/**
 * Fase 8.B — versão em lote de `carregarChecklistModelo`, pra telas que
 * listam inspeções de modelos possivelmente diferentes (relatórios,
 * dashboard, planos de ação, comparativo) sem resolver cada uma
 * individualmente nem cair no erro de assumir "o modelo padrão" pra
 * respostas de qualquer modelo. Deduplica os ids recebidos; ids sem
 * seções cadastradas são omitidos do Map resultante (o caller decide como
 * tratar ausência — normalmente com `ChecklistModeloNaoEncontrado`).
 */
export async function carregarChecklistModelos(
  supabase: SupabaseClient<any, any>,
  modeloVersaoIds: string[],
): Promise<Map<string, ChecklistModeloResolvido>> {
  const ids = [...new Set(modeloVersaoIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const [
    { data: versoesRows, error: versoesError },
    { data: secoesRows, error: secoesError },
    { data: itensRows, error: itensError },
  ] = await Promise.all([
    supabase
      .from("checklist_modelo_versoes")
      .select("id, checklist_modelos(nome, codigo)")
      .in("id", ids),
    supabase
      .from("checklist_secoes")
      .select("id, modelo_versao_id, secao_key, titulo, ordem")
      .in("modelo_versao_id", ids)
      .order("ordem"),
    supabase
      .from("checklist_itens")
      .select("secao_id, modelo_versao_id, item_key, texto, critico, ordem")
      .in("modelo_versao_id", ids)
      .order("ordem"),
  ]);

  if (versoesError) throw versoesError;
  if (secoesError) throw secoesError;
  if (itensError) throw itensError;

  const nomePorVersaoId = new Map<string, string>(
    (versoesRows ?? []).map((v: any) => [v.id, v.checklist_modelos?.nome ?? ""]),
  );
  const codigoPorVersaoId = new Map<string, string>(
    (versoesRows ?? []).map((v: any) => [v.id, v.checklist_modelos?.codigo ?? ""]),
  );

  const secoesPorModelo = new Map<string, typeof secoesRows>();
  for (const row of secoesRows ?? []) {
    const lista = secoesPorModelo.get(row.modelo_versao_id) ?? [];
    lista.push(row);
    secoesPorModelo.set(row.modelo_versao_id, lista);
  }

  const itensPorModelo = new Map<string, typeof itensRows>();
  for (const row of itensRows ?? []) {
    const lista = itensPorModelo.get(row.modelo_versao_id) ?? [];
    lista.push(row);
    itensPorModelo.set(row.modelo_versao_id, lista);
  }

  const resultado = new Map<string, ChecklistModeloResolvido>();
  for (const id of ids) {
    const secoes = secoesPorModelo.get(id);
    if (!secoes || secoes.length === 0) continue; // sem seções cadastradas — omitido, ver doc acima
    resultado.set(
      id,
      montarModeloResolvido(
        id,
        nomePorVersaoId.get(id) ?? "",
        codigoPorVersaoId.get(id) ?? "",
        secoes,
        itensPorModelo.get(id) ?? [],
      ),
    );
  }
  return resultado;
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
