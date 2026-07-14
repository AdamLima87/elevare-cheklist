import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Cliente {
  id: string;
  empresa_id: string;
  nome: string;
  cnpj: string | null;
  categoria: string | null;
  foto_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientes(search?: string) {
  return useQuery({
    queryKey: ["clientes", search],
    queryFn: async () => {
      let query = supabase.from("clientes").select("*").order("nome");
      if (search) {
        query = query.or(`nome.ilike.%${search}%,cnpj.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Cliente[];
    },
  });
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id as string)
        .single();
      if (error) throw error;
      return data as Cliente;
    },
    enabled: !!id,
  });
}

export function useClienteByCnpj(cnpj: string | null | undefined) {
  return useQuery({
    queryKey: ["cliente-by-cnpj", cnpj],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("cnpj", cnpj as string)
        .maybeSingle();
      if (error) throw error;
      return data as Cliente | null;
    },
    enabled: !!cnpj,
  });
}

export function useUpsertCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      empresa_id: string;
      nome: string;
      cnpj?: string | null;
      categoria?: string | null;
      foto_url?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("clientes")
        .upsert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Cliente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

// Busca um cliente existente pelo CNPJ ou cria um novo, dentro da empresa do usuário atual.
export async function findOrCreateCliente(input: {
  empresa_id: string;
  nome: string;
  cnpj?: string | null;
}): Promise<Cliente> {
  const cleanCnpj = input.cnpj?.replace(/\D/g, "") || null;

  if (cleanCnpj) {
    const { data: existing, error: findError } = await supabase
      .from("clientes")
      .select("*")
      .eq("empresa_id", input.empresa_id)
      .eq("cnpj", cleanCnpj)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return existing as Cliente;
  }

  const { data: created, error: createError } = await supabase
    .from("clientes")
    .insert({ empresa_id: input.empresa_id, nome: input.nome, cnpj: cleanCnpj })
    .select()
    .single();
  if (createError) throw createError;
  return created as Cliente;
}
