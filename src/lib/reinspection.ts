import { addDays, addMonths } from "date-fns";

export const REINSPECAO_INTERVALO_MESES = 6;
export const REMINDER_LEAD_DAYS = 14;

export function dueDate(dataConclusaoISO: string): Date {
  return addMonths(new Date(dataConclusaoISO), REINSPECAO_INTERVALO_MESES);
}

/**
 * True once `due` falls within `leadDays` from `now` — including if it's already
 * overdue. There is deliberately no lower bound: email_send_log already prevents
 * duplicate sends, so a one-sided window tolerates cron downtime without silently
 * skipping an establishment that's overdue.
 */
export function isWithinReminderWindow(
  due: Date,
  now: Date,
  leadDays = REMINDER_LEAD_DAYS,
): boolean {
  return due.getTime() <= addDays(now, leadDays).getTime();
}

/**
 * Keeps only the most recent inspection per establishment (cnpj). Rows must
 * already be sorted by data_conclusao descending, or the "most recent" pick
 * is undefined — callers should query with `.order("data_conclusao", { ascending: false })`.
 */
export function dedupeLatestPerCnpj<
  T extends { cnpj: string | null; data_conclusao: string | null },
>(rows: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of rows) {
    if (!row.cnpj || !row.data_conclusao) continue;
    if (seen.has(row.cnpj)) continue;
    seen.add(row.cnpj);
    result.push(row);
  }
  return result;
}
