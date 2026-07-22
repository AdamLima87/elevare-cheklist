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
