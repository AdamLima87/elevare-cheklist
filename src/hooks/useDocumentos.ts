import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Documento {
  id: string;
  empresa_id: string;
  cliente_id: string;
  tipo: string;
  numero: string | null;
  orgao_emissor: string | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentoComCliente extends Documento {
  clientes: { nome: string } | null;
}

export const TIPOS_DOCUMENTO = [
  "Alvará Sanitário",
  "Licença de Funcionamento",
  "Certificado de Controle de Pragas",
  "Laudo de Potabilidade da Água",
  "Limpeza de Caixa d'Água",
  "ASO (Atestado de Saúde Ocupacional)",
  "Certificado de Treinamento",
  "Manual de Boas Práticas",
  "Registro de Responsabilidade Técnica",
  "Outro",
];

export function documentoStatus(dataVencimento: string | null): "sem-vencimento" | "vencido" | "vencendo" | "ok" {
  if (!dataVencimento) return "sem-vencimento";
  const dias = Math.ceil(
    (new Date(dataVencimento + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (dias < 0) return "vencido";
  if (dias <= 30) return "vencendo";
  return "ok";
}

export function useDocumentos(clienteId?: string) {
  return useQuery({
    queryKey: ["documentos", clienteId],
    queryFn: async () => {
      let query = supabase
        .from("documentos")
        .select("*, clientes(nome)")
        .order("data_vencimento", { ascending: true, nullsFirst: false });

      if (clienteId) query = query.eq("cliente_id", clienteId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DocumentoComCliente[];
    },
  });
}

// Documentos vencidos ou vencendo dentro da janela de dias — usado no alerta
// de entrada no sistema e no card do dashboard.
export function useExpiringDocumentos(days: number = 30, enabled: boolean = true) {
  return useQuery({
    queryKey: ["documentos-expiring", days],
    enabled,
    queryFn: async () => {
      const limit = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const { data, error } = await supabase
        .from("documentos")
        .select("*, clientes(nome)")
        .not("data_vencimento", "is", null)
        .lte("data_vencimento", limit.toISOString().slice(0, 10))
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DocumentoComCliente[];
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      empresa_id: string;
      cliente_id: string;
      tipo: string;
      numero?: string | null;
      orgao_emissor?: string | null;
      data_emissao?: string | null;
      data_vencimento?: string | null;
      observacoes?: string | null;
      created_by?: string | null;
    }) => {
      const { data, error } = await supabase.from("documentos").insert(input).select().single();
      if (error) throw error;
      return data as Documento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      queryClient.invalidateQueries({ queryKey: ["documentos-expiring"] });
    },
  });
}

export function useDeleteDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      queryClient.invalidateQueries({ queryKey: ["documentos-expiring"] });
    },
  });
}
