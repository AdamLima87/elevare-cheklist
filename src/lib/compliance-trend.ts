export interface TrendPoint {
  date: string;
  conformidade: number;
}

/**
 * Converts inspection rows into chronologically-sorted trend points for charting.
 * Rows missing a date or a compliance score are dropped.
 */
export function toTrendPoints(
  rows: { data_conclusao: string | null; conformidade: number | string | null }[],
): TrendPoint[] {
  return rows
    .filter((r) => r.data_conclusao && r.conformidade !== null && r.conformidade !== undefined)
    .map((r) => ({ date: r.data_conclusao as string, conformidade: Number(r.conformidade) }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
