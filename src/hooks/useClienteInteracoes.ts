import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClienteInteracao {
  id: string;
  empresa_id: string;
  cliente_id: string;
  autor_id: string | null;
  tipo: string;
  texto: string;
  created_at: string;
}

export function useClienteInteracoes(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["cliente-interacoes", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_interacoes")
        .select("*")
        .eq("cliente_id", clienteId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClienteInteracao[];
    },
    enabled: !!clienteId,
  });
}

export function useCreateInteracao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      empresa_id: string;
      cliente_id: string;
      autor_id?: string | null;
      tipo?: string;
      texto: string;
    }) => {
      const { data, error } = await supabase
        .from("cliente_interacoes")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ClienteInteracao;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cliente-interacoes", variables.cliente_id] });
    },
  });
}
