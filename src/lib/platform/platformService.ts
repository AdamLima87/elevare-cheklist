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

export interface PlatformGooglePlacesConsumo {
  empresa_id: string;
  empresa_nome: string;
  plano: string;
  credencial_origem: "tenant" | "rdcheck";
  credencial_status: "nao_configurado" | "conectado" | "invalido";
  trial_leads_usados: number;
  trial_leads_limite: number;
  mes_atual_leads_importados: number;
  buscas_ultima_hora: number;
  total_leads_importados: number;
}

export async function getGooglePlacesConsumo(): Promise<PlatformGooglePlacesConsumo[]> {
  const { data, error } = await supabase.rpc("platform_google_places_consumo");
  if (error) throw error;
  return (data ?? []) as PlatformGooglePlacesConsumo[];
}

export interface PlatformAuditLogEntry {
  id: string;
  empresa_id: string | null;
  actor_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  empresas: { nome: string } | null;
}

export async function getAuditLog(): Promise<PlatformAuditLogEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, empresa_id, actor_id, event_type, metadata, created_at, empresas(nome)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as PlatformAuditLogEntry[];
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

export interface PlatformPlanoLimite {
  id: string;
  plano_id: string;
  limite_key: string;
  valor: number;
}

export interface PlatformPlanoComLimites extends PlatformSaasPlano {
  saas_plano_limites: PlatformPlanoLimite[];
}

export async function listPlanosComLimites(): Promise<PlatformPlanoComLimites[]> {
  const { data, error } = await supabase
    .from("saas_planos")
    .select("*, saas_plano_limites(*)")
    .order("ordem");
  if (error) throw error;
  return (data ?? []) as unknown as PlatformPlanoComLimites[];
}

export async function criarPlano(input: { codigo: string; nome: string; ordem: number }): Promise<void> {
  const { error } = await supabase.from("saas_planos").insert({
    codigo: input.codigo,
    nome: input.nome,
    ordem: input.ordem,
  });
  if (error) throw error;
}

export async function atualizarPlanoAtivo(planoId: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("saas_planos").update({ ativo }).eq("id", planoId);
  if (error) throw error;
}

export async function definirPlanoLimite(input: {
  planoId: string;
  limiteKey: string;
  valor: number;
}): Promise<void> {
  const { error } = await supabase
    .from("saas_plano_limites")
    .upsert({ plano_id: input.planoId, limite_key: input.limiteKey, valor: input.valor }, { onConflict: "plano_id,limite_key" });
  if (error) throw error;
}

export async function removerPlanoLimite(limiteId: string): Promise<void> {
  const { error } = await supabase.from("saas_plano_limites").delete().eq("id", limiteId);
  if (error) throw error;
}

export interface PlatformBillingDashboard {
  trials_ativos: number;
  trials_expirando_em_breve: number;
  trials_expirados: number;
  assinaturas_ativas: number;
  inadimplentes_1_a_6: number;
  inadimplentes_7_a_14: number;
  bloqueados: number;
  cancelados: number;
  webhooks_com_erro: number;
  ultimos_pagamentos: Array<{ id: string; empresa_nome: string; valor_cobrado: number; status: string; created_at: string }>;
}

export async function getBillingDashboard(): Promise<PlatformBillingDashboard> {
  const { data, error } = await supabase.rpc("platform_billing_dashboard").single();
  if (error) throw error;
  return data as PlatformBillingDashboard;
}

export interface PlatformAssinatura {
  empresa_id: string;
  empresa_nome: string;
  plano_codigo: string;
  periodicidade: string | null;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  past_due_since: string | null;
  blocked_at: string | null;
}

export async function getAssinaturasLista(): Promise<PlatformAssinatura[]> {
  const { data, error } = await supabase.rpc("platform_assinaturas_lista");
  if (error) throw error;
  return (data ?? []) as PlatformAssinatura[];
}

export async function bloquearAssinatura(empresaId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("platform_bloquear_assinatura", { p_empresa_id: empresaId, p_motivo: motivo });
  if (error) throw error;
}

export async function desbloquearAssinatura(empresaId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("platform_desbloquear_assinatura", { p_empresa_id: empresaId, p_motivo: motivo });
  if (error) throw error;
}

export async function reprocessarWebhookEvento(eventoId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const { error } = await supabase.functions.invoke("reprocessar-webhook-evento", {
    body: { eventoId },
    headers: sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
  });
  if (error) throw error;
}

export interface PlatformCupom {
  id: string;
  codigo: string;
  descricao: string | null;
  tipo_desconto: "percentual" | "valor_fixo" | "primeiro_periodo_gratis";
  valor: number;
  plano_codigo: string | null;
  periodicidade: "mensal" | "anual" | null;
  data_inicio: string;
  data_fim: string | null;
  max_utilizacoes: number | null;
  utilizacoes_atual: number;
  max_utilizacoes_por_empresa: number;
  somente_novos_clientes: boolean;
  ativo: boolean;
  created_at: string;
}

export async function listCupons(): Promise<PlatformCupom[]> {
  const { data, error } = await supabase.from("saas_cupons").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlatformCupom[];
}

export async function criarCupom(input: {
  codigo: string;
  descricao: string;
  tipoDesconto: string;
  valor: number;
  planoCodigo: string | null;
  periodicidade: string | null;
  dataFim: string | null;
  maxUtilizacoes: number | null;
  maxUtilizacoesPorEmpresa: number;
}): Promise<void> {
  const { error } = await supabase.from("saas_cupons").insert({
    codigo: input.codigo.trim().toUpperCase(),
    descricao: input.descricao || null,
    tipo_desconto: input.tipoDesconto,
    valor: input.valor,
    plano_codigo: input.planoCodigo,
    periodicidade: input.periodicidade,
    data_fim: input.dataFim,
    max_utilizacoes: input.maxUtilizacoes,
    max_utilizacoes_por_empresa: input.maxUtilizacoesPorEmpresa,
  });
  if (error) throw error;
}

export async function atualizarCupomAtivo(cupomId: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("saas_cupons").update({ ativo }).eq("id", cupomId);
  if (error) throw error;
}
