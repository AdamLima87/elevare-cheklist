import { describe, expect, it } from "vitest";
import {
  dedupeLatestPerCnpj,
  dueDate,
  isWithinReminderWindow,
  REINSPECAO_INTERVALO_MESES,
} from "./reinspection";

describe("dueDate", () => {
  it("adds REINSPECAO_INTERVALO_MESES months to the conclusion date", () => {
    expect(dueDate("2026-01-15T00:00:00.000Z").toISOString().slice(0, 10)).toBe("2026-07-15");
  });

  it("uses the confirmed 6-month interval", () => {
    expect(REINSPECAO_INTERVALO_MESES).toBe(6);
  });
});

describe("isWithinReminderWindow", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("is false when the due date is further out than the lead window", () => {
    const due = new Date("2026-07-01T00:00:00.000Z");
    expect(isWithinReminderWindow(due, now, 14)).toBe(false);
  });

  it("is true when the due date falls inside the lead window", () => {
    const due = new Date("2026-06-10T00:00:00.000Z");
    expect(isWithinReminderWindow(due, now, 14)).toBe(true);
  });

  it("is true when the due date is already in the past (overdue)", () => {
    const due = new Date("2026-01-01T00:00:00.000Z");
    expect(isWithinReminderWindow(due, now, 14)).toBe(true);
  });
});

describe("dedupeLatestPerCnpj", () => {
  it("keeps only the first row seen per cnpj", () => {
    const rows = [
      { cnpj: "111", data_conclusao: "2026-03-01" },
      { cnpj: "222", data_conclusao: "2026-02-01" },
      { cnpj: "111", data_conclusao: "2026-01-01" },
    ];
    const result = dedupeLatestPerCnpj(rows);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.cnpj === "111")?.data_conclusao).toBe("2026-03-01");
  });

  it("drops rows with no cnpj or no conclusion date", () => {
    const rows = [
      { cnpj: null, data_conclusao: "2026-01-01" },
      { cnpj: "111", data_conclusao: null },
      { cnpj: "222", data_conclusao: "2026-01-01" },
    ];
    expect(dedupeLatestPerCnpj(rows)).toEqual([{ cnpj: "222", data_conclusao: "2026-01-01" }]);
  });
});
