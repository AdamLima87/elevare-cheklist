import { describe, expect, it } from "vitest";
import { DEFAULT_PRAZO_DIAS, defaultPrazo, ensurePlanoAcao } from "./plano-acao";

describe("defaultPrazo", () => {
  it("adds DEFAULT_PRAZO_DIAS days to the given conclusion date", () => {
    expect(defaultPrazo("2026-01-01T00:00:00.000Z")).toBe("2026-01-31");
  });

  it("respects a custom number of days", () => {
    expect(defaultPrazo("2026-01-01T00:00:00.000Z", 10)).toBe("2026-01-11");
  });

  it("falls back to today when no conclusion date is given", () => {
    const expected = new Date();
    expected.setDate(expected.getDate() + DEFAULT_PRAZO_DIAS);
    const expectedStr = expected.toISOString().slice(0, 10);
    expect(defaultPrazo(null)).toBe(expectedStr);
  });
});

describe("ensurePlanoAcao", () => {
  it("generates a default entry for each non-conforming item without one", () => {
    const result = ensurePlanoAcao(
      { a: "N", b: "S", c: "NA" },
      undefined,
      "2026-01-01T00:00:00.000Z",
    );
    expect(Object.keys(result)).toEqual(["a"]);
    expect(result.a.prazo).toBe("2026-01-31");
    expect(result.a.texto.length).toBeGreaterThan(0);
  });

  it("keeps existing entries unchanged, including user edits", () => {
    const existente = { a: { texto: "Texto editado pelo consultor", prazo: "2026-06-01" } };
    const result = ensurePlanoAcao({ a: "N" }, existente, "2026-01-01T00:00:00.000Z");
    expect(result.a).toEqual(existente.a);
  });

  it("does not prune entries for items that are no longer N", () => {
    const existente = { a: { texto: "Já corrigido antes", prazo: "2026-06-01" } };
    const result = ensurePlanoAcao({ a: "S" }, existente, "2026-01-01T00:00:00.000Z");
    expect(result.a).toEqual(existente.a);
  });

  it("returns an empty object when there are no non-conforming items and no existing entries", () => {
    expect(ensurePlanoAcao({ a: "S", b: "NA" }, undefined, "2026-01-01T00:00:00.000Z")).toEqual({});
  });
});
