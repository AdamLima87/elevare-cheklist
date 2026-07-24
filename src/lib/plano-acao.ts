import { addDays, format } from "date-fns";
import type { AcaoCorretiva, Resposta } from "./storage";

export const DEFAULT_PRAZO_DIAS = 30;

export function defaultAcaoTexto(): string {
  return "Corrigir a não conformidade identificada e adequar o item às Boas Práticas até o prazo estabelecido.";
}

// Reads the date portion of an ISO string as a local-midnight calendar date,
// ignoring any time/offset. Prevents a UTC-midnight timestamp from shifting to
// the previous/next calendar day once addDays/format below apply the local
// timezone of whichever machine runs the code.
function calendarDateFromISO(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function defaultPrazo(
  dataConclusaoISO: string | null | undefined,
  dias = DEFAULT_PRAZO_DIAS,
): string {
  const base = dataConclusaoISO ? calendarDateFromISO(dataConclusaoISO) : new Date();
  return format(addDays(base, dias), "yyyy-MM-dd");
}

/**
 * Ensures every non-conforming ("N") item has a corrective action entry, generating
 * defaults for missing ones. Existing entries (including user edits) pass through
 * unchanged, and entries for items no longer "N" are kept rather than pruned.
 */
export function ensurePlanoAcao(
  respostas: Record<string, Resposta>,
  existente: Record<string, AcaoCorretiva> | undefined,
  dataConclusaoISO: string | null | undefined,
): Record<string, AcaoCorretiva> {
  const result: Record<string, AcaoCorretiva> = { ...existente };

  Object.entries(respostas || {}).forEach(([id, resposta]) => {
    if (resposta === "N" && !result[id]) {
      result[id] = { texto: defaultAcaoTexto(), prazo: defaultPrazo(dataConclusaoISO) };
    }
  });

  return result;
}
