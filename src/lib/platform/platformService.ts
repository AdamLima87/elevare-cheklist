import { supabase } from "@/integrations/supabase/client";

// Única camada que fala com o Supabase pro módulo de Administração da
// Plataforma. Os hooks em @/hooks/usePlatform.ts só consomem este
// módulo — nenhum componente chama supabase.rpc/from diretamente pra
// dado de plataforma. Toda RPC aqui já valida is_super_admin() no
// backend (não confia só nesta camada nem na RLS).

export interface PlatformDashboardMetrics {
  empresas_total: number;
  empresas_ativas: number;
  empresas_trial: number;
  empresas_pagas: number;
  usuarios_total: number;
  clientes_total: number;
  inspecoes_total: number;
  crm_contas_total: number;
  crm_oportunidades_total: number;
  leads_google_total: number;
  cadastros_recentes: Array<{ nome: string; plano: string; status: string; created_at: string }>;
}

export async function getDashboardMetrics(): Promise<PlatformDashboardMetrics> {
  const { data, error } = await supabase.rpc("platform_dashboard_metrics").single();
  if (error) throw error;
  return data as PlatformDashboardMetrics;
}

export interface PlatformEmpresaResumo {
  id: string;
  nome: string;
  cnpj: string | null;
  plano: string;
  status: string;
  trial_ends_at: string | null;
  created_at: string;
  usuarios: number;
  clientes: number;
  inspecoes: number;
  oportunidades: number;
  leads_importados: number;
  ultimo_acesso: string | null;
}

export async function getEmpresasResumo(): Promise<PlatformEmpresaResumo[]> {
  const { data, error } = await supabase.rpc("platform_empresas_resumo");
  if (error) throw error;
  return (data ?? []) as PlatformEmpresaResumo[];
}

export async function atualizarEmpresaStatus(empresaId: string, status: "ativo" | "inativo"): Promise<void> {
  const { error } = await supabase.rpc("platform_atualizar_empresa_status", {
    p_empresa_id: empresaId,
    p_status: status,
  });
  if (error) throw error;
}

export async function atualizarEmpresaPlano(empresaId: string, plano: string): Promise<void> {
  const { error } = await supabase.rpc("platform_atualizar_empresa_plano", {
    p_empresa_id: empresaId,
    p_plano: plano,
  });
  if (error) throw error;
}

export async function estenderTrial(empresaId: string, novoTrialEndsAt: string): Promise<void> {
  const { error } = await supabase.rpc("platform_estender_trial", {
    p_empresa_id: empresaId,
    p_novo_trial_ends_at: novoTrialEndsAt,
  });
  if (error) throw error;
}

export async function definirOverrideLimite(input: {
  empresaId: string;
  limiteKey: string;
  valor: number;
  motivo: string;
}): Promise<void> {
  const { error } = await supabase.rpc("platform_definir_override_limite", {
    p_empresa_id: input.empresaId,
    p_limite_key: input.limiteKey,
    p_valor: input.valor,
    p_motivo: input.motivo,
  });
  if (error) throw error;
}

export interface PlatformSaasPlano {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export async function listPlanos(): Promise<PlatformSaasPlano[]> {
  const { data, error } = await supabase.from("saas_planos").select("*").order("ordem");
  if (error) throw error;
  return (data ?? []) as PlatformSaasPlano[];
}
