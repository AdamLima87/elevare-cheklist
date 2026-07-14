import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  plano: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useEmpresas() {
  return useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
  });
}

export interface CreateEmpresaInput {
  empresaNome: string;
  empresaCnpj?: string;
  plano?: string;
  adminNome: string;
  adminEmail: string;
  adminPassword?: string;
}

export function useCreateEmpresa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEmpresaInput) => {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "create_empresa", userData: input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
  });
}
