import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CrmEmpresaStatus = "lead" | "prospect" | "ativa" | "inativa";

export interface CrmEmpresa {
  id: string;
  empresa_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  segmento: string | null;
  cidade: string | null;
  estado: string | null;
  site: string | null;
  whatsapp: string | null;
  instagram: string | null;
  numero_unidades: number | null;
  observacoes: string | null;
  origem_id: string | null;
  responsavel_id: string;
  status: CrmEmpresaStatus;
  tags: string[];
  cliente_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useCrmEmpresas(search?: string, status?: CrmEmpresaStatus) {
  return useQuery({
    queryKey: ["crm-empresas", search, status],
    queryFn: async () => {
      let query = supabase.from("crm_empresas").select("*").order("razao_social");
      if (search) {
        query = query.or(`razao_social.ilike.%${search}%,nome_fantasia.ilike.%${search}%,cnpj.ilike.%${search}%`);
      }
      if (status) {
        query = query.eq("status", status);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CrmEmpresa[];
    },
  });
}

export function useCrmEmpresa(id: string | undefined) {
  return useQuery({
    queryKey: ["crm-empresa", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_empresas")
        .select("*")
        .eq("id", id as string)
        .single();
      if (error) throw error;
      return data as CrmEmpresa;
    },
    enabled: !!id,
  });
}

export function useCrmEmpresaByCnpj(cnpj: string | null | undefined) {
  const cleanCnpj = cnpj?.replace(/\D/g, "") || null;
  return useQuery({
    queryKey: ["crm-empresa-by-cnpj", cleanCnpj],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_empresas")
        .select("*")
        .eq("cnpj", cleanCnpj as string)
        .maybeSingle();
      if (error) throw error;
      return data as CrmEmpresa | null;
    },
    enabled: !!cleanCnpj,
  });
}

export function useUpsertCrmEmpresa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      empresa_id: string;
      razao_social: string;
      nome_fantasia?: string | null;
      cnpj?: string | null;
      segmento?: string | null;
      cidade?: string | null;
      estado?: string | null;
      site?: string | null;
      whatsapp?: string | null;
      instagram?: string | null;
      numero_unidades?: number | null;
      observacoes?: string | null;
      origem_id?: string | null;
      responsavel_id: string;
      status?: CrmEmpresaStatus;
    }) => {
      const { data, error } = await supabase
        .from("crm_empresas")
        .upsert(input)
        .select()
        .single();
      if (error) throw error;
      return data as CrmEmpresa;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crm-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-empresa", data.id] });
    },
  });
}
