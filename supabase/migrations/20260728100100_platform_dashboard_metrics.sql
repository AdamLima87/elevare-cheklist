-- Administração da Plataforma — Fase 1: métricas globais do Dashboard.
-- SECURITY DEFINER com guarda explícita de super_admin (não confia só na
-- RLS/frontend) — pedido explícito do usuário pra toda RPC deste módulo.
CREATE OR REPLACE FUNCTION public.platform_dashboard_metrics()
RETURNS TABLE (
  empresas_total int,
  empresas_ativas int,
  empresas_trial int,
  empresas_pagas int,
  usuarios_total int,
  clientes_total int,
  inspecoes_total int,
  crm_contas_total int,
  crm_oportunidades_total int,
  leads_google_total int,
  cadastros_recentes jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.empresas)::int,
    (SELECT count(*) FROM public.empresas WHERE status = 'ativo')::int,
    (SELECT count(*) FROM public.empresas WHERE plano = 'trial')::int,
    (SELECT count(*) FROM public.empresas WHERE plano != 'trial')::int,
    (SELECT count(*) FROM public.profiles)::int,
    (SELECT count(*) FROM public.clientes)::int,
    (SELECT count(*) FROM public.inspecoes)::int,
    (SELECT count(*) FROM public.crm_empresas)::int,
    (SELECT count(*) FROM public.crm_oportunidades)::int,
    (SELECT count(*) FROM public.crm_leads_importacoes)::int,
    (
      SELECT coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) FROM (
        SELECT nome, plano, status, created_at
        FROM public.empresas
        ORDER BY created_at DESC
        LIMIT 5
      ) r
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_dashboard_metrics() TO authenticated;
