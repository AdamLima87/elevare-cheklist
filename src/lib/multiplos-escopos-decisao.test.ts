import { describe, expect, it } from "vitest";
import { resolverDecisaoMultiplosEscopos, type MultiplosEscoposDecisaoInput } from "./multiplos-escopos-decisao";

const BASE: MultiplosEscoposDecisaoInput = {
  decisao: null,
  modeloComercioServico: "id-cvs3",
  modeloProducao: "id-rdc275",
  primeiroEscopoOpcao3: null,
  modeloManualOpcao4: null,
  confirmacaoDelimitacao: false,
  justificativaCodigo: null,
  justificativaTexto: "",
};

describe("resolverDecisaoMultiplosEscopos", () => {
  it("nenhuma decisão selecionada nunca libera o avanço", () => {
    const r = resolverDecisaoMultiplosEscopos(BASE);
    expect(r.podeContinuar).toBe(false);
    expect(r.modeloSelecionado).toBeNull();
  });

  it("opção 1 (escopo_comercio_servico) exige confirmação e justificativa antes de liberar", () => {
    const semNada = resolverDecisaoMultiplosEscopos({ ...BASE, decisao: "escopo_comercio_servico" });
    expect(semNada.podeContinuar).toBe(false);

    const soConfirmacao = resolverDecisaoMultiplosEscopos({
      ...BASE,
      decisao: "escopo_comercio_servico",
      confirmacaoDelimitacao: true,
    });
    expect(soConfirmacao.podeContinuar).toBe(false);

    const completo = resolverDecisaoMultiplosEscopos({
      ...BASE,
      decisao: "escopo_comercio_servico",
      confirmacaoDelimitacao: true,
      justificativaCodigo: "atividade_em_unidade_separada",
    });
    expect(completo.podeContinuar).toBe(true);
    expect(completo.modeloSelecionado).toBe("id-cvs3");
    expect(completo.modeloOuEscopoNaoInspecionado).toBe("id-rdc275");
    expect(completo.segundoEscopoPendente).toBe(false);
  });

  it("opção 2 (escopo_producao) exige confirmação e justificativa antes de liberar", () => {
    const completo = resolverDecisaoMultiplosEscopos({
      ...BASE,
      decisao: "escopo_producao",
      confirmacaoDelimitacao: true,
      justificativaCodigo: "orientacao_vigilancia_sanitaria",
    });
    expect(completo.podeContinuar).toBe(true);
    expect(completo.modeloSelecionado).toBe("id-rdc275");
    expect(completo.modeloOuEscopoNaoInspecionado).toBe("id-cvs3");
  });

  it("justificativa 'outro' exige texto de descrição", () => {
    const semTexto = resolverDecisaoMultiplosEscopos({
      ...BASE,
      decisao: "escopo_producao",
      confirmacaoDelimitacao: true,
      justificativaCodigo: "outro",
      justificativaTexto: "   ",
    });
    expect(semTexto.podeContinuar).toBe(false);

    const comTexto = resolverDecisaoMultiplosEscopos({
      ...BASE,
      decisao: "escopo_producao",
      confirmacaoDelimitacao: true,
      justificativaCodigo: "outro",
      justificativaTexto: "Motivo específico descrito aqui",
    });
    expect(comTexto.podeContinuar).toBe(true);
  });

  it("opção 3 (duas_inspecoes) não exige confirmação nem justificativa, só qual escopo vai primeiro", () => {
    const semEscolha = resolverDecisaoMultiplosEscopos({ ...BASE, decisao: "duas_inspecoes" });
    expect(semEscolha.podeContinuar).toBe(false);

    const primeiroComercio = resolverDecisaoMultiplosEscopos({
      ...BASE,
      decisao: "duas_inspecoes",
      primeiroEscopoOpcao3: "comercio_servico",
    });
    expect(primeiroComercio.podeContinuar).toBe(true);
    expect(primeiroComercio.modeloSelecionado).toBe("id-cvs3");
    expect(primeiroComercio.modeloOuEscopoNaoInspecionado).toBe("id-rdc275");
    expect(primeiroComercio.segundoEscopoPendente).toBe(true);

    const primeiroProducao = resolverDecisaoMultiplosEscopos({
      ...BASE,
      decisao: "duas_inspecoes",
      primeiroEscopoOpcao3: "producao",
    });
    expect(primeiroProducao.modeloSelecionado).toBe("id-rdc275");
    expect(primeiroProducao.modeloOuEscopoNaoInspecionado).toBe("id-cvs3");
    expect(primeiroProducao.segundoEscopoPendente).toBe(true);
  });

  it("opção 4 (prosseguir_com_justificativa) exige escolha manual do modelo e justificativa", () => {
    const semModelo = resolverDecisaoMultiplosEscopos({
      ...BASE,
      decisao: "prosseguir_com_justificativa",
      justificativaCodigo: "fora_do_escopo_contratado",
    });
    expect(semModelo.podeContinuar).toBe(false);

    const semJustificativa = resolverDecisaoMultiplosEscopos({
      ...BASE,
      decisao: "prosseguir_com_justificativa",
      modeloManualOpcao4: "id-cvs3",
    });
    expect(semJustificativa.podeContinuar).toBe(false);

    const completo = resolverDecisaoMultiplosEscopos({
      ...BASE,
      decisao: "prosseguir_com_justificativa",
      modeloManualOpcao4: "id-cvs3",
      justificativaCodigo: "fora_do_escopo_contratado",
    });
    expect(completo.podeContinuar).toBe(true);
    expect(completo.modeloSelecionado).toBe("id-cvs3");
    // "outro" escopo é o que não foi escolhido, entre os dois sugeridos.
    expect(completo.modeloOuEscopoNaoInspecionado).toBe("id-rdc275");
    expect(completo.segundoEscopoPendente).toBe(false);
  });

  it("opção 1/2 sem legislação sugerida automaticamente pro escopo não libera o avanço mesmo com confirmação/justificativa", () => {
    const r = resolverDecisaoMultiplosEscopos({
      ...BASE,
      modeloComercioServico: null, // ex.: UF desconhecida
      decisao: "escopo_comercio_servico",
      confirmacaoDelimitacao: true,
      justificativaCodigo: "enquadramento_confirmado_licenciamento",
    });
    expect(r.podeContinuar).toBe(false);
    expect(r.modeloSelecionado).toBeNull();
  });
});
