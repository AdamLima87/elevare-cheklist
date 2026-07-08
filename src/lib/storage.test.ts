import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useSyncStore", () => ({ useSyncStore: { getState: () => ({ addConflict: () => {} }) } }));

import { calcularPercentual, classificacao } from "./storage";

describe("calcularPercentual", () => {
  it("returns all zeros for empty respostas", () => {
    expect(calcularPercentual({})).toEqual({ sim: 0, nao: 0, na: 0, aplicavel: 0, percentual: 0 });
  });

  it("returns all zeros for undefined respostas", () => {
    expect(calcularPercentual(undefined as unknown as Record<string, "S" | "N" | "NA" | null>)).toEqual({
      sim: 0,
      nao: 0,
      na: 0,
      aplicavel: 0,
      percentual: 0,
    });
  });

  it("gives 100% when every applicable answer is S", () => {
    const result = calcularPercentual({ q1: "S", q2: "S", q3: "S" });
    expect(result).toEqual({ sim: 3, nao: 0, na: 0, aplicavel: 3, percentual: 100 });
  });

  it("gives 0% when every applicable answer is N", () => {
    const result = calcularPercentual({ q1: "N", q2: "N" });
    expect(result).toEqual({ sim: 0, nao: 2, na: 0, aplicavel: 2, percentual: 0 });
  });

  it("excludes NA answers from the denominator", () => {
    const result = calcularPercentual({ q1: "S", q2: "S", q3: "S", q4: "N", q5: "NA", q6: "NA" });
    expect(result).toEqual({ sim: 3, nao: 1, na: 2, aplicavel: 4, percentual: 75 });
  });

  it("ignores null answers entirely", () => {
    const result = calcularPercentual({ q1: "S", q2: null });
    expect(result).toEqual({ sim: 1, nao: 0, na: 0, aplicavel: 1, percentual: 100 });
  });
});

describe("classificacao", () => {
  it("classifies exactly 76 as BOM", () => {
    expect(classificacao(76)).toEqual({ label: "BOM", emoji: "✅", tone: "success" });
  });

  it("classifies 100 as BOM", () => {
    expect(classificacao(100)).toEqual({ label: "BOM", emoji: "✅", tone: "success" });
  });

  it("classifies just under 76 as REGULAR", () => {
    expect(classificacao(75.999)).toEqual({ label: "REGULAR", emoji: "⚠️", tone: "warning" });
  });

  it("classifies exactly 51 as REGULAR", () => {
    expect(classificacao(51)).toEqual({ label: "REGULAR", emoji: "⚠️", tone: "warning" });
  });

  it("classifies just under 51 as RUIM", () => {
    expect(classificacao(50.999)).toEqual({ label: "RUIM", emoji: "❌", tone: "destructive" });
  });

  it("classifies 0 as RUIM", () => {
    expect(classificacao(0)).toEqual({ label: "RUIM", emoji: "❌", tone: "destructive" });
  });
});
