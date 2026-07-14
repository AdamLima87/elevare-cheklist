import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Visita {
  id: string;
  empresa_id: string;
  cliente_id: string;
  consultor_id: string | null;
  data_hora: string;
  tipo: string;
  status: "agendada" | "realizada" | "cancelada";
  observacoes: string | null;
  inspecao_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VisitaComCliente extends Visita {
  clientes: { nome: string } | null;
}

export function useVisitas(filters: { clienteId?: string; onlyUpcoming?: boolean } = {}) {
  return useQuery({
    queryKey: ["visitas", filters],
    queryFn: async () => {
      let query = supabase
        .from("visitas")
        .select("*, clientes(nome)")
        .order("data_hora", { ascending: true });

      if (filters.clienteId) query = query.eq("cliente_id", filters.clienteId);
      if (filters.onlyUpcoming) query = query.gte("data_hora", new Date().toISOString());

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as VisitaComCliente[];
    },
  });
}

// Visitas agendadas dentro de uma janela de dias a partir de agora (usado no
// alerta de entrada no sistema e no widget do dashboard).
export function useUpcomingVisitas(days: number = 1, enabled: boolean = true) {
  return useQuery({
    queryKey: ["visitas-upcoming", days],
    enabled,
    queryFn: async () => {
      const now = new Date();
      const limit = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const { data, error } = await supabase
        .from("visitas")
        .select("*, clientes(nome)")
        .eq("status", "agendada")
        .gte("data_hora", now.toISOString())
        .lte("data_hora", limit.toISOString())
        .order("data_hora", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VisitaComCliente[];
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateVisita() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      empresa_id: string;
      cliente_id: string;
      consultor_id?: string | null;
      data_hora: string;
      tipo?: string;
      observacoes?: string | null;
    }) => {
      const { data, error } = await supabase.from("visitas").insert(input).select().single();
      if (error) throw error;
      return data as Visita;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visitas"] });
    },
  });
}

export function useUpdateVisitaStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: Visita["status"] }) => {
      const { data, error } = await supabase
        .from("visitas")
        .update({ status: input.status })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as Visita;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visitas"] });
    },
  });
}
