/**
 * Fase 9.D — motor de recomendação de legislação/modelo de checklist.
 *
 * Função pura, sem I/O: recebe o contexto já carregado (UF/atividades
 * marcadas nesta inspeção e a lista de modelos disponíveis, já com
 * uf/esfera/vigência) e devolve uma recomendação — nunca uma escolha
 * automática. `resolver_checklist_modelo_padrao()` (o padrão global de uma
 * inspeção sem nenhuma seleção) não é tocado por este módulo.
 *
 * Regra aprovada (Fase 9.A/9.B):
 * - fora de SP + servico_alimentacao → RDC 216/2004;
 * - em SP + (servico_alimentacao OU comercio_alimentos) → CVS 3/2026;
 * - producao_industrializacao (qualquer UF) → RDC 275/2002;
 * - presença simultânea de (servico_alimentacao OU comercio_alimentos) E
 *   producao_industrializacao → múltiplos escopos, nunca uma única escolha
 *   silenciosa — o consultor decide se faz inspeções separadas;
 * - UF desconhecida, ou nenhuma atividade relevante marcada → nenhuma
 *   recomendação (comportamento manual de sempre).
 */

export const CODIGO_RDC_275 = "RDC_275_2002_PADRAO";
export const CODIGO_RDC_216 = "RDC_216_2004_PADRAO";
/** Ainda não seedado até a Fase 9.E — a função trata sua ausência como "não disponível ainda", nunca como erro. */
export const CODIGO_CVS_3 = "CVS_3_2026_PADRAO";

export interface ChecklistModeloParaRecomendacao {
  modeloVersaoId: string;
  codigo: string;
  vigenteDesde: string | null;
}

export interface Sugestao {
  modeloId: string;
  motivo: string;
}

export type ResultadoRecomendacao =
  | { tipo: "unica"; modeloRecomendadoId: string; motivo: string; usoAntecipado: boolean }
  | { tipo: "multiplos_escopos"; sugestoes: Sugestao[]; alerta: string }
  | { tipo: "nenhuma" };

export interface RecomendarModeloInput {
  ufConsiderada: string | null;
  atividadesConsideradas: string[];
  /** Data da inspeção em curso (ISO), usada para checar uso antecipado contra vigente_desde. */
  dataInspecao: string;
  modelosDisponiveis: ChecklistModeloParaRecomendacao[];
}

function encontrarModelo(modelos: ChecklistModeloParaRecomendacao[], codigo: string) {
  return modelos.find((m) => m.codigo === codigo) ?? null;
}

function ehUsoAntecipado(vigenteDesde: string | null, dataInspecao: string): boolean {
  if (!vigenteDesde) return false;
  return dataInspecao.slice(0, 10) < vigenteDesde.slice(0, 10);
}

function recomendarServicoOuComercio(
  ufConsiderada: string | null,
  atividades: string[],
  dataInspecao: string,
  modelos: ChecklistModeloParaRecomendacao[],
): { modeloRecomendadoId: string; motivo: string; usoAntecipado: boolean } | null {
  if (!ufConsiderada) return null;

  if (ufConsiderada === "SP") {
    const cvs3 = encontrarModelo(modelos, CODIGO_CVS_3);
    if (!cvs3) return null;
    return {
      modeloRecomendadoId: cvs3.modeloVersaoId,
      motivo:
        "Este estabelecimento está localizado em São Paulo e realiza comércio ou serviço de alimentação. A Portaria CVS 3/2026 é recomendada.",
      usoAntecipado: ehUsoAntecipado(cvs3.vigenteDesde, dataInspecao),
    };
  }

  if (atividades.includes("servico_alimentacao")) {
    const rdc216 = encontrarModelo(modelos, CODIGO_RDC_216);
    if (!rdc216) return null;
    return {
      modeloRecomendadoId: rdc216.modeloVersaoId,
      motivo: `Este estabelecimento presta serviço de alimentação fora de São Paulo (${ufConsiderada}). A RDC 216/2004 é recomendada.`,
      usoAntecipado: false,
    };
  }

  // comercio_alimentos fora de SP, sem servico_alimentacao: nenhuma norma
  // estadual equivalente mapeada — não inventamos recomendação sem base
  // regulatória confirmada.
  return null;
}

function recomendarProducao(
  dataInspecao: string,
  modelos: ChecklistModeloParaRecomendacao[],
): { modeloRecomendadoId: string; motivo: string; usoAntecipado: boolean } | null {
  const rdc275 = encontrarModelo(modelos, CODIGO_RDC_275);
  if (!rdc275) return null;
  return {
    modeloRecomendadoId: rdc275.modeloVersaoId,
    motivo: "Este estabelecimento produz ou industrializa alimentos. A RDC 275/2002 é recomendada.",
    usoAntecipado: ehUsoAntecipado(rdc275.vigenteDesde, dataInspecao),
  };
}

export function recomendarModelo(input: RecomendarModeloInput): ResultadoRecomendacao {
  const { ufConsiderada, atividadesConsideradas, dataInspecao, modelosDisponiveis } = input;

  const temServicoOuComercio =
    atividadesConsideradas.includes("servico_alimentacao") ||
    atividadesConsideradas.includes("comercio_alimentos");
  const temProducao = atividadesConsideradas.includes("producao_industrializacao");

  if (temServicoOuComercio && temProducao) {
    const doServico = recomendarServicoOuComercio(ufConsiderada, atividadesConsideradas, dataInspecao, modelosDisponiveis);
    const daProducao = recomendarProducao(dataInspecao, modelosDisponiveis);
    const sugestoes: Sugestao[] = [];
    if (doServico) sugestoes.push({ modeloId: doServico.modeloRecomendadoId, motivo: doServico.motivo });
    if (daProducao) sugestoes.push({ modeloId: daProducao.modeloRecomendadoId, motivo: daProducao.motivo });
    return {
      tipo: "multiplos_escopos",
      sugestoes,
      alerta:
        "Este estabelecimento parece ter mais de um escopo regulatório (comércio/serviço de alimentação e produção/industrialização). Considere realizar inspeções separadas — uma para cada escopo — em vez de uma única inspeção combinada.",
    };
  }

  if (temProducao) {
    const r = recomendarProducao(dataInspecao, modelosDisponiveis);
    return r ? { tipo: "unica", modeloRecomendadoId: r.modeloRecomendadoId, motivo: r.motivo, usoAntecipado: r.usoAntecipado } : { tipo: "nenhuma" };
  }

  if (temServicoOuComercio) {
    const r = recomendarServicoOuComercio(ufConsiderada, atividadesConsideradas, dataInspecao, modelosDisponiveis);
    return r ? { tipo: "unica", modeloRecomendadoId: r.modeloRecomendadoId, motivo: r.motivo, usoAntecipado: r.usoAntecipado } : { tipo: "nenhuma" };
  }

  return { tipo: "nenhuma" };
}
