import { describe, expect, it } from "vitest";
import {
  CODIGO_CVS_3,
  CODIGO_RDC_216,
  CODIGO_RDC_275,
  recomendarModelo,
  type ChecklistModeloParaRecomendacao,
} from "./checklist-modelo-recomendacao";

const DATA_INSPECAO = "2026-08-15T10:00:00.000Z";

const MODELOS_COMPLETOS: ChecklistModeloParaRecomendacao[] = [
  { modeloVersaoId: "id-rdc275", codigo: CODIGO_RDC_275, vigenteDesde: null },
  { modeloVersaoId: "id-rdc216", codigo: CODIGO_RDC_216, vigenteDesde: null },
  { modeloVersaoId: "id-cvs3", codigo: CODIGO_CVS_3, vigenteDesde: "2026-10-04" },
];

// Ainda sem CVS 3/2026 seedado (estado real antes da Fase 9.E)
const MODELOS_SEM_CVS3: ChecklistModeloParaRecomendacao[] = [
  { modeloVersaoId: "id-rdc275", codigo: CODIGO_RDC_275, vigenteDesde: null },
  { modeloVersaoId: "id-rdc216", codigo: CODIGO_RDC_216, vigenteDesde: null },
];

describe("recomendarModelo", () => {
  it("SP + servico_alimentacao recomenda a CVS 3/2026", () => {
    const r = recomendarModelo({
      ufConsiderada: "SP",
      atividadesConsideradas: ["servico_alimentacao"],
      dataInspecao: DATA_INSPECAO,
      modelosDisponiveis: MODELOS_COMPLETOS,
    });
    expect(r).toMatchObject({ tipo: "unica", modeloRecomendadoId: "id-cvs3" });
  });

  it("SP + comercio_alimentos recomenda a CVS 3/2026", () => {
    const r = recomendarModelo({
      ufConsiderada: "SP",
      atividadesConsideradas: ["comercio_alimentos"],
      dataInspecao: DATA_INSPECAO,
      modelosDisponiveis: MODELOS_COMPLETOS,
    });
    expect(r).toMatchObject({ tipo: "unica", modeloRecomendadoId: "id-cvs3" });
  });

  it("SP antes da vigência da CVS 3/2026 sinaliza uso antecipado", () => {
    const r = recomendarModelo({
      ufConsiderada: "SP",
      atividadesConsideradas: ["servico_alimentacao"],
      dataInspecao: "2026-08-15T10:00:00.000Z",
      modelosDisponiveis: MODELOS_COMPLETOS,
    });
    expect(r).toMatchObject({ tipo: "unica", usoAntecipado: true });
  });

  it("SP depois da vigência da CVS 3/2026 não sinaliza uso antecipado", () => {
    const r = recomendarModelo({
      ufConsiderada: "SP",
      atividadesConsideradas: ["servico_alimentacao"],
      dataInspecao: "2026-11-01T10:00:00.000Z",
      modelosDisponiveis: MODELOS_COMPLETOS,
    });
    expect(r).toMatchObject({ tipo: "unica", usoAntecipado: false });
  });

  it("fora de SP + servico_alimentacao recomenda a RDC 216/2004", () => {
    const r = recomendarModelo({
      ufConsiderada: "RJ",
      atividadesConsideradas: ["servico_alimentacao"],
      dataInspecao: DATA_INSPECAO,
      modelosDisponiveis: MODELOS_COMPLETOS,
    });
    expect(r).toMatchObject({ tipo: "unica", modeloRecomendadoId: "id-rdc216" });
  });

  it("fora de SP + comercio_alimentos (sem servico) não recomenda nada", () => {
    const r = recomendarModelo({
      ufConsiderada: "RJ",
      atividadesConsideradas: ["comercio_alimentos"],
      dataInspecao: DATA_INSPECAO,
      modelosDisponiveis: MODELOS_COMPLETOS,
    });
    expect(r).toEqual({ tipo: "nenhuma" });
  });

  it("producao_industrializacao recomenda a RDC 275/2002 independente da UF", () => {
    const r1 = recomendarModelo({
      ufConsiderada: "SP",
      atividadesConsideradas: ["producao_industrializacao"],
      dataInspecao: DATA_INSPECAO,
      modelosDisponiveis: MODELOS_COMPLETOS,
    });
    expect(r1).toMatchObject({ tipo: "unica", modeloRecomendadoId: "id-rdc275" });

    const r2 = recomendarModelo({
      ufConsiderada: null,
      atividadesConsideradas: ["producao_industrializacao"],
      dataInspecao: DATA_INSPECAO,
      modelosDisponiveis: MODELOS_COMPLETOS,
    });
    expect(r2).toMatchObject({ tipo: "unica", modeloRecomendadoId: "id-rdc275" });
  });

  it("servico_alimentacao + producao_industrializacao dispara múltiplos escopos, nunca escolha única", () => {
    const r = recomendarModelo({
      ufConsiderada: "SP",
      atividadesConsideradas: ["servico_alimentacao", "producao_industrializacao"],
      dataInspecao: DATA_INSPECAO,
      modelosDisponiveis: MODELOS_COMPLETOS,
    });
    expect(r.tipo).toBe("multiplos_escopos");
    if (r.tipo === "multiplos_escopos") {
      expect(r.sugestoes).toHaveLength(2);
      expect(r.sugestoes.map((s) => s.modeloId).sort()).toEqual(["id-cvs3", "id-rdc275"].sort());
      // Fase 9.G — título e corpo do alerta exigidos pelo usuário, texto integral.
      expect(r.titulo).toBe("Possível incidência de mais de uma norma sanitária");
      expect(r.alerta).toContain(
        "As atividades informadas abrangem comércio ou serviço de alimentação e também produção ou industrialização. Cada atividade pode estar sujeita a requisitos sanitários distintos.",
      );
      expect(r.alerta).toContain(
        "Avalie o licenciamento, o processo produtivo, a destinação dos alimentos e a orientação da Vigilância Sanitária competente. Quando os escopos forem distintos, realize inspeções separadas para cada norma.",
      );
      // Regra: nunca afirmar que uma norma substitui/prevalece sobre a outra,
      // nem que a seleção torna duas inspeções sempre obrigatórias, nem usar
      // "o consultor pode escolher qualquer norma".
      expect(r.alerta).not.toMatch(/prevalece|substitui/i);
      expect(r.alerta).not.toMatch(/sempre (será|serão) necessárias duas inspeções/i);
      expect(r.alerta).not.toMatch(/escolher qualquer norma/i);
    }
  });

  it("comercio_alimentos + producao_industrializacao fora de SP dispara múltiplos escopos com só a sugestão de produção", () => {
    const r = recomendarModelo({
      ufConsiderada: "RJ",
      atividadesConsideradas: ["comercio_alimentos", "producao_industrializacao"],
      dataInspecao: DATA_INSPECAO,
      modelosDisponiveis: MODELOS_COMPLETOS,
    });
    expect(r.tipo).toBe("multiplos_escopos");
    if (r.tipo === "multiplos_escopos") {
      expect(r.sugestoes).toHaveLength(1);
      expect(r.sugestoes[0].modeloId).toBe("id-rdc275");
    }
  });

  it("UF desconhecida não recomenda nada, mesmo com atividade marcada", () => {
    const r = recomendarModelo({
      ufConsiderada: null,
      atividadesConsideradas: ["servico_alimentacao"],
      dataInspecao: DATA_INSPECAO,
      modelosDisponiveis: MODELOS_COMPLETOS,
    });
    expect(r).toEqual({ tipo: "nenhuma" });
  });

  it("nenhuma atividade marcada não recomenda nada", () => {
    const r = recomendarModelo({
      ufConsiderada: "SP",
      atividadesConsideradas: [],
      dataInspecao: DATA_INSPECAO,
      modelosDisponiveis: MODELOS_COMPLETOS,
    });
    expect(r).toEqual({ tipo: "nenhuma" });
  });

  it("SP + servico_alimentacao sem a CVS 3/2026 ainda seedada não recomenda nada (não inventa fallback para RDC 216)", () => {
    const r = recomendarModelo({
      ufConsiderada: "SP",
      atividadesConsideradas: ["servico_alimentacao"],
      dataInspecao: DATA_INSPECAO,
      modelosDisponiveis: MODELOS_SEM_CVS3,
    });
    expect(r).toEqual({ tipo: "nenhuma" });
  });

  it("producao_industrializacao sem a RDC 275 disponível não recomenda nada", () => {
    const r = recomendarModelo({
      ufConsiderada: "SP",
      atividadesConsideradas: ["producao_industrializacao"],
      dataInspecao: DATA_INSPECAO,
      modelosDisponiveis: [],
    });
    expect(r).toEqual({ tipo: "nenhuma" });
  });
});
