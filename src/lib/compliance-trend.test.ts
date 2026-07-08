import { describe, expect, it } from "vitest";
import { toTrendPoints } from "./compliance-trend";

describe("toTrendPoints", () => {
  it("sorts rows chronologically ascending", () => {
    const result = toTrendPoints([
      { data_conclusao: "2026-03-01", conformidade: 80 },
      { data_conclusao: "2026-01-01", conformidade: 60 },
      { data_conclusao: "2026-02-01", conformidade: 70 },
    ]);
    expect(result.map((p) => p.date)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });

  it("coerces conformidade to a number", () => {
    const result = toTrendPoints([{ data_conclusao: "2026-01-01", conformidade: "75.5" as any }]);
    expect(result[0].conformidade).toBe(75.5);
  });

  it("drops rows without a conclusion date", () => {
    const result = toTrendPoints([
      { data_conclusao: null, conformidade: 80 },
      { data_conclusao: "2026-01-01", conformidade: 60 },
    ]);
    expect(result).toHaveLength(1);
  });

  it("drops rows without a compliance score", () => {
    const result = toTrendPoints([
      { data_conclusao: "2026-01-01", conformidade: null },
      { data_conclusao: "2026-01-02", conformidade: 60 },
    ]);
    expect(result).toHaveLength(1);
  });

  it("returns an empty array for no rows", () => {
    expect(toTrendPoints([])).toEqual([]);
  });
});
