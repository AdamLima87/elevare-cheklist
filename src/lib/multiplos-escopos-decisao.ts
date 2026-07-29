import type { DecisaoMultiplosEscopos, JustificativaCodigo } from "./checklist-modelo-recomendacao";

/**
 * Fase 9.G — lógica pura de resolução/gating da decisão de múltiplos
 * escopos, extraída de MultiplosEscoposDecisao.tsx pra ser testável sem
 * infraestrutura de teste de componente React (o projeto só testa lógica
 * pura em .test.ts — ver checklist-modelo-recomendacao.test.ts). O
 * componente é uma casca fina sobre esta função: nunca decide sozinho,
 * nunca libera "Continuar" sem os requisitos de cada opção.
 */
export interface MultiplosEscoposDecisaoInput {
  decisao: DecisaoMultiplosEscopos | null;
  /** modeloVersaoId sugerido pro escopo de comércio/serviço, ou null se nenhuma legislação foi identificada automaticamente. */
  modeloComercioServico: string | null;
  /** modeloVersaoId sugerido (RDC 275/2002) pro escopo de produção/industrialização. */
  modeloProducao: string | null;
  /** Só relevante na opção "duas_inspecoes": qual dos dois escopos vai primeiro. */
  primeiroEscopoOpcao3: "comercio_servico" | "producao" | null;
  /** Só relevante na opção "prosseguir_com_justificativa": modelo escolhido manualmente. */
  modeloManualOpcao4: string | null;
  /** Checkbox exigido nas opções 1 e 2. */
  confirmacaoDelimitacao: boolean;
  justificativaCodigo: JustificativaCodigo | null;
  justificativaTexto: string;
}

export interface MultiplosEscoposDecisaoResolvida {
  podeContinuar: boolean;
  modeloSelecionado: string | null;
  modeloOuEscopoNaoInspecionado: string | null;
  segundoEscopoPendente: boolean;
  exigeConfirmacao: boolean;
  exigeJustificativa: boolean;
}

function justificativaValida(codigo: JustificativaCodigo | null, texto: string): boolean {
  if (codigo === null) return false;
  if (codigo === "outro") return texto.trim().length > 0;
  return true;
}

export function resolverDecisaoMultiplosEscopos(
  input: MultiplosEscoposDecisaoInput,
): MultiplosEscoposDecisaoResolvida {
  const {
    decisao,
    modeloComercioServico,
    modeloProducao,
    primeiroEscopoOpcao3,
    modeloManualOpcao4,
    confirmacaoDelimitacao,
    justificativaCodigo,
    justificativaTexto,
  } = input;

  let modeloSelecionado: string | null = null;
  let modeloOuEscopoNaoInspecionado: string | null = null;

  if (decisao === "escopo_comercio_servico") {
    modeloSelecionado = modeloComercioServico;
    modeloOuEscopoNaoInspecionado = modeloProducao ?? "producao_industrializacao";
  } else if (decisao === "escopo_producao") {
    modeloSelecionado = modeloProducao;
    modeloOuEscopoNaoInspecionado = modeloComercioServico ?? "comercio_servico_alimentacao";
  } else if (decisao === "duas_inspecoes") {
    if (primeiroEscopoOpcao3 === "comercio_servico") {
      modeloSelecionado = modeloComercioServico;
      modeloOuEscopoNaoInspecionado = modeloProducao ?? "producao_industrializacao";
    } else if (primeiroEscopoOpcao3 === "producao") {
      modeloSelecionado = modeloProducao;
      modeloOuEscopoNaoInspecionado = modeloComercioServico ?? "comercio_servico_alimentacao";
    }
  } else if (decisao === "prosseguir_com_justificativa") {
    modeloSelecionado = modeloManualOpcao4;
    modeloOuEscopoNaoInspecionado =
      [modeloComercioServico, modeloProducao].find((id) => id && id !== modeloManualOpcao4) ?? null;
  }

  const exigeConfirmacao = decisao === "escopo_comercio_servico" || decisao === "escopo_producao";
  const exigeJustificativa =
    decisao === "escopo_comercio_servico" || decisao === "escopo_producao" || decisao === "prosseguir_com_justificativa";

  const podeContinuar =
    decisao !== null &&
    modeloSelecionado !== null &&
    (!exigeConfirmacao || confirmacaoDelimitacao) &&
    (!exigeJustificativa || justificativaValida(justificativaCodigo, justificativaTexto)) &&
    (decisao !== "duas_inspecoes" || primeiroEscopoOpcao3 !== null);

  return {
    podeContinuar,
    modeloSelecionado,
    modeloOuEscopoNaoInspecionado,
    segundoEscopoPendente: decisao === "duas_inspecoes",
    exigeConfirmacao,
    exigeJustificativa,
  };
}
