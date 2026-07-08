import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InspecoesFilters {
  status?: "concluida" | "em_andamento";
  consultorId?: string | null;
  cnpj?: string | null;
  dateStart?: string;
  dateEnd?: string;
  dateField?: "data_conclusao" | "data_inicio";
  classification?: "BOM" | "REGULAR" | "RUIM" | "all";
  orderBy?: "data_conclusao" | "data_inicio";
  page: number;
  pageSize: number;
}

function applyFilters(query: any, filters: InspecoesFilters) {
  const dateField = filters.dateField ?? "data_conclusao";

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.consultorId) query = query.eq("consultor_id", filters.consultorId);
  if (filters.cnpj) query = query.eq("cnpj", filters.cnpj);
  if (filters.dateStart) query = query.gte(dateField, filters.dateStart);
  if (filters.dateEnd) query = query.lte(dateField, `${filters.dateEnd}T23:59:59`);

  if (filters.classification === "BOM") query = query.gte("conformidade", 76);
  else if (filters.classification === "REGULAR")
    query = query.gte("conformidade", 51).lt("conformidade", 76);
  else if (filters.classification === "RUIM") query = query.lt("conformidade", 51);

  return query;
}

export function useInspecoesQuery(filters: InspecoesFilters) {
  return useQuery({
    queryKey: ["inspecoes", filters],
    queryFn: async () => {
      let query = supabase.from("inspecoes").select("*", { count: "exact" });
      query = applyFilters(query, filters);

      const from = filters.page * filters.pageSize;
      const to = from + filters.pageSize - 1;

      const { data, error, count } = await query
        .order(filters.orderBy ?? "data_conclusao", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
    placeholderData: keepPreviousData,
  });
}

export function useInspecoesStats(
  filters: Omit<InspecoesFilters, "page" | "pageSize" | "orderBy">,
) {
  return useQuery({
    queryKey: ["inspecoes-stats", filters],
    queryFn: async () => {
      let query = supabase.from("inspecoes").select("conformidade");
      query = applyFilters(query, filters as InspecoesFilters);

      const { data, error } = await query;
      if (error) throw error;

      const values = (data ?? []).map((r: any) => Number(r.conformidade) || 0);
      const total = values.length;
      const avg = total > 0 ? values.reduce((a: number, b: number) => a + b, 0) / total : 0;
      const bom = values.filter((v: number) => v >= 76).length;
      const regular = values.filter((v: number) => v >= 51 && v < 76).length;
      const ruim = values.filter((v: number) => v < 51).length;

      return { total, avg, bom, regular, ruim };
    },
  });
}
