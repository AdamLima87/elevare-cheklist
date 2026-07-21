-- CRM Comercial — Buscar Leads: resolução do limite de importação.
-- SECURITY DEFINER porque precisa ler public.crm_leads_credenciais, que não
-- tem NENHUMA policy para authenticated (só service_role) — a função roda
-- como owner pra checar só o campo `status`, sem nunca expor o ciphertext.
-- Uso: (1) leitura direta pelo frontend (mostrar "18 de 30 utilizados" na
-- UI); (2) chamada interna, sob lock, dentro de crm_importar_lead_google.
--
-- Regra: NUNCA confia em nada vindo do frontend — todo o cálculo usa
-- get_minha_empresa() (resolvido da sessão autenticada) e dados do próprio
-- banco (empresas.plano, crm_leads_config, crm_leads_usage,
-- crm_leads_credenciais).
CREATE OR REPLACE FUNCTION public.crm_leads_resolver_limite()
RETURNS TABLE (
  pode_importar boolean,
  limite_tipo text,          -- 'tenant' (chave própria, sem limite) | 'trial' | 'mensal'
  limite int,                -- NULL quando limite_tipo = 'tenant'
  usados int,
  disponivel int,
  tem_credencial_propria boolean,
  periodo_inicio date,       -- só preenchido quando limite_tipo = 'mensal'
  periodo_fim date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_empresa_id uuid;
  v_plano text;
  v_tem_credencial boolean;
  v_trial_usados int;
  v_trial_limite int;
  v_periodo_inicio date;
  v_periodo_fim date;
  v_mensal_usados int;
BEGIN
  v_empresa_id := public.get_minha_empresa();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada.' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')
  ) THEN
    RAISE EXCEPTION 'Perfil sem acesso à prospecção de leads.' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.crm_leads_credenciais
    WHERE empresa_id = v_empresa_id AND status = 'conectado'
  ) INTO v_tem_credencial;

  IF v_tem_credencial THEN
    RETURN QUERY SELECT true, 'tenant'::text, NULL::int, NULL::int, NULL::int, true, NULL::date, NULL::date;
    RETURN;
  END IF;

  SELECT plano INTO v_plano FROM public.empresas WHERE id = v_empresa_id;

  IF v_plano = 'trial' THEN
    SELECT trial_leads_usados, trial_leads_limite INTO v_trial_usados, v_trial_limite
      FROM public.crm_leads_config WHERE empresa_id = v_empresa_id;
    -- Linha de config deveria sempre existir (seed em provision_tenant /
    -- backfill), mas se faltar por algum motivo, trata como zerada em vez
    -- de quebrar a busca de leads.
    v_trial_usados := coalesce(v_trial_usados, 0);
    v_trial_limite := coalesce(v_trial_limite, 5);
    RETURN QUERY SELECT
      (v_trial_usados < v_trial_limite), 'trial'::text, v_trial_limite, v_trial_usados,
      (v_trial_limite - v_trial_usados), false, NULL::date, NULL::date;
    RETURN;
  END IF;

  v_periodo_inicio := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_periodo_fim := (v_periodo_inicio + interval '1 month' - interval '1 day')::date;

  SELECT leads_importados INTO v_mensal_usados
    FROM public.crm_leads_usage WHERE empresa_id = v_empresa_id AND periodo_inicio = v_periodo_inicio;
  v_mensal_usados := coalesce(v_mensal_usados, 0);

  RETURN QUERY SELECT
    (v_mensal_usados < 30), 'mensal'::text, 30, v_mensal_usados,
    (30 - v_mensal_usados), false, v_periodo_inicio, v_periodo_fim;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crm_leads_resolver_limite() TO authenticated;
