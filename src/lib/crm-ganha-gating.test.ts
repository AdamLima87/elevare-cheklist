import { describe, expect, it } from "vitest";
import { resolverGanhaGating, type ResolverGanhaGatingInput } from "./crm-ganha-gating";

const BASE: ResolverGanhaGatingInput = {
  ganhaExige: "proposta_aceita",
  diagnosticoRequerido: false,
  diagnosticoConcluido: false,
  propostaAceita: false,
  contratoAssinado: false,
};

describe("resolverGanhaGating", () => {
  it("bloqueia por diagnóstico não concluído quando requerido, antes de checar proposta", () => {
    const r = resolverGanhaGating({ ...BASE, diagnosticoRequerido: true, diagnosticoConcluido: false });
    expect(r.liberado).toBe(false);
    if (!r.liberado) expect(r.motivo).toBe("DIAGNOSTICO_NAO_CONCLUIDO");
  });

  it("diagnóstico concluído libera essa checagem e segue pra proposta", () => {
    const r = resolverGanhaGating({ ...BASE, diagnosticoRequerido: true, diagnosticoConcluido: true, propostaAceita: false });
    expect(r.liberado).toBe(false);
    if (!r.liberado) expect(r.motivo).toBe("PROPOSTA_NAO_ACEITA");
  });

  it("diagnóstico não requerido nunca bloqueia, mesmo não concluído", () => {
    const r = resolverGanhaGating({ ...BASE, diagnosticoRequerido: false, diagnosticoConcluido: false, propostaAceita: true });
    expect(r.liberado).toBe(true);
  });

  it("ganha_exige='proposta_aceita': bloqueia sem proposta aceita", () => {
    const r = resolverGanhaGating({ ...BASE, propostaAceita: false });
    expect(r.liberado).toBe(false);
    if (!r.liberado) expect(r.motivo).toBe("PROPOSTA_NAO_ACEITA");
  });

  it("ganha_exige='proposta_aceita': libera com proposta aceita, mesmo sem contrato", () => {
    const r = resolverGanhaGating({ ...BASE, propostaAceita: true, contratoAssinado: false });
    expect(r.liberado).toBe(true);
  });

  it("ganha_exige='contrato_assinado': bloqueia com só proposta aceita", () => {
    const r = resolverGanhaGating({ ...BASE, ganhaExige: "contrato_assinado", propostaAceita: true, contratoAssinado: false });
    expect(r.liberado).toBe(false);
    if (!r.liberado) expect(r.motivo).toBe("CONTRATO_NAO_ASSINADO");
  });

  it("ganha_exige='contrato_assinado': bloqueia mesmo com contrato assinado se a proposta não estiver aceita", () => {
    const r = resolverGanhaGating({ ...BASE, ganhaExige: "contrato_assinado", propostaAceita: false, contratoAssinado: true });
    expect(r.liberado).toBe(false);
    if (!r.liberado) expect(r.motivo).toBe("PROPOSTA_NAO_ACEITA");
  });

  it("ganha_exige='contrato_assinado': libera só com proposta aceita E contrato assinado", () => {
    const r = resolverGanhaGating({ ...BASE, ganhaExige: "contrato_assinado", propostaAceita: true, contratoAssinado: true });
    expect(r.liberado).toBe(true);
  });

  it("todas as combinações de diagnóstico requerido x concluído x ganha_exige — tabela-verdade completa", () => {
    const casos: Array<[ResolverGanhaGatingInput, boolean]> = [
      [{ ...BASE, diagnosticoRequerido: true, diagnosticoConcluido: false, propostaAceita: true }, false],
      [{ ...BASE, diagnosticoRequerido: true, diagnosticoConcluido: true, propostaAceita: true }, true],
      [{ ...BASE, ganhaExige: "contrato_assinado", diagnosticoRequerido: true, diagnosticoConcluido: true, propostaAceita: true, contratoAssinado: false }, false],
      [{ ...BASE, ganhaExige: "contrato_assinado", diagnosticoRequerido: true, diagnosticoConcluido: true, propostaAceita: true, contratoAssinado: true }, true],
    ];
    for (const [input, esperado] of casos) {
      expect(resolverGanhaGating(input).liberado).toBe(esperado);
    }
  });
});
