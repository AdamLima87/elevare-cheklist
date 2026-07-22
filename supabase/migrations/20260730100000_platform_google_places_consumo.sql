-- Administração da Plataforma — Fase 3: painel de consumo global do
-- Google Places. NUNCA seleciona api_key_ciphertext/api_key_iv de
-- crm_leads_credenciais (a tabela nem tem policy pra authenticated —
-- só service_role/esta função SECURITY DEFINER acessam) — só o `status`,
-- igual ao padrão já usado em crm_leads_resolver_limite().
CREATE OR REPLACE FUNCTION public.platform_google_places_consumo()
RETURNS TABLE (
  empresa_id uuid,
  empresa_nome text,
  plano text,
  credencial_origem text,
  credencial_status text,
  trial_leads_usados int,
  trial_leads_limite int,
  mes_atual_leads_importados int,
  buscas_ultima_hora int,
  total_leads_importados int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_periodo_inicio date;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;

  v_periodo_inicio := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;

  RETURN QUERY
  SELECT
    e.id,
    e.nome,
    e.plano,
    CASE WHEN cred.status = 'conectado' THEN 'tenant' ELSE 'rdcheck' END,
    coalesce(cred.status, 'nao_configurado'),
    coalesce(cfg.trial_leads_usados, 0),
    coalesce(cfg.trial_leads_limite, 5),
    coalesce((
      SELECT u.leads_importados FROM public.crm_leads_usage u
      WHERE u.empresa_id = e.id AND u.periodo_inicio = v_periodo_inicio
    ), 0)::int,
    (
      SELECT count(*) FROM public.crm_leads_busca_tentativas b
      WHERE b.empresa_id = e.id AND b.created_at > now() - interval '1 hour'
    )::int,
    (SELECT count(*) FROM public.crm_leads_importacoes li WHERE li.empresa_id = e.id)::int
  FROM public.empresas e
  LEFT JOIN public.crm_leads_config cfg ON cfg.empresa_id = e.id
  LEFT JOIN public.crm_leads_credenciais cred ON cred.empresa_id = e.id
  ORDER BY e.nome;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_google_places_consumo() TO authenticated;
