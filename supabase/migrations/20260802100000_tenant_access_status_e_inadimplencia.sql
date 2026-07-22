-- Fase 5/6 do billing: controle central de acesso + transições
-- automáticas de inadimplência. Uma função só, usada tanto pelo
-- frontend (ProtectedRoute, tela de Plano e Cobrança) quanto como base
-- pra qualquer ação sensível de backend futura — evita espalhar a
-- mesma regra (trial expirado? em atraso? bloqueado?) em várias telas.

CREATE OR REPLACE FUNCTION public.get_tenant_access_status()
RETURNS TABLE (
  status text,
  plano_codigo text,
  periodicidade text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  past_due_since timestamptz,
  dias_atraso int,
  dias_para_bloqueio int,
  blocked_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_empresa_id uuid;
  v_assinatura record;
BEGIN
  v_empresa_id := public.get_minha_empresa();

  IF v_empresa_id IS NULL THEN
    RETURN QUERY SELECT 'no_subscription'::text, NULL::text, NULL::text, NULL::timestamptz, NULL::timestamptz, NULL::timestamptz, NULL::int, NULL::int, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO v_assinatura
  FROM public.saas_assinaturas
  WHERE empresa_id = v_empresa_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Tenant sem nenhuma linha de assinatura (ex: empresa criada antes
    -- desta feature, ou via admin-manage-users) — não bloqueia quem já
    -- usava o sistema normalmente.
    RETURN QUERY SELECT 'active'::text, NULL::text, NULL::text, NULL::timestamptz, NULL::timestamptz, NULL::timestamptz, NULL::int, NULL::int, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_assinatura.status = 'trialing' THEN
    IF v_assinatura.trial_ends_at IS NOT NULL AND v_assinatura.trial_ends_at < now() THEN
      RETURN QUERY SELECT 'trial_expired'::text, v_assinatura.plano_codigo, v_assinatura.periodicidade,
        v_assinatura.trial_ends_at, v_assinatura.current_period_end, v_assinatura.past_due_since, NULL::int, NULL::int, v_assinatura.blocked_at;
    ELSE
      RETURN QUERY SELECT 'trialing'::text, v_assinatura.plano_codigo, v_assinatura.periodicidade,
        v_assinatura.trial_ends_at, v_assinatura.current_period_end, v_assinatura.past_due_since, NULL::int, NULL::int, v_assinatura.blocked_at;
    END IF;
    RETURN;
  END IF;

  IF v_assinatura.status = 'blocked' THEN
    RETURN QUERY SELECT 'blocked'::text, v_assinatura.plano_codigo, v_assinatura.periodicidade,
      v_assinatura.trial_ends_at, v_assinatura.current_period_end, v_assinatura.past_due_since,
      EXTRACT(DAY FROM now() - v_assinatura.past_due_since)::int, 0, v_assinatura.blocked_at;
    RETURN;
  END IF;

  IF v_assinatura.status = 'past_due' THEN
    RETURN QUERY SELECT 'past_due_warning'::text, v_assinatura.plano_codigo, v_assinatura.periodicidade,
      v_assinatura.trial_ends_at, v_assinatura.current_period_end, v_assinatura.past_due_since,
      EXTRACT(DAY FROM now() - v_assinatura.past_due_since)::int,
      GREATEST(0, 15 - EXTRACT(DAY FROM now() - v_assinatura.past_due_since)::int), v_assinatura.blocked_at;
    RETURN;
  END IF;

  IF v_assinatura.status = 'canceled' THEN
    RETURN QUERY SELECT 'canceled'::text, v_assinatura.plano_codigo, v_assinatura.periodicidade,
      v_assinatura.trial_ends_at, v_assinatura.current_period_end, v_assinatura.past_due_since, NULL::int, NULL::int, v_assinatura.blocked_at;
    RETURN;
  END IF;

  -- 'active'/'pending' e qualquer outro estado transitório: tratado
  -- como acesso normal (pending nunca deveria existir num tenant já
  -- provisionado, mas não é motivo pra bloquear na dúvida).
  RETURN QUERY SELECT 'active'::text, v_assinatura.plano_codigo, v_assinatura.periodicidade,
    v_assinatura.trial_ends_at, v_assinatura.current_period_end, v_assinatura.past_due_since, NULL::int, NULL::int, v_assinatura.blocked_at;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_tenant_access_status() TO authenticated;

-- Transições automáticas de inadimplência. past_due_since é setado pelo
-- webhook (evento PAYMENT_OVERDUE) — este job só observa há quanto tempo
-- isso está setado e move o status adiante. Roda a cada hora (não precisa
-- ser mais frequente que isso pra uma janela de dias).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-inadimplencia-transicoes') THEN
      PERFORM cron.unschedule('billing-inadimplencia-transicoes');
    END IF;
    PERFORM cron.schedule(
      'billing-inadimplencia-transicoes',
      '0 * * * *',
      $cron$
        -- Dia 7: aviso persistente (status muda pra past_due, dispara
        -- banner no frontend). Continua com acesso total.
        UPDATE public.saas_assinaturas
        SET status = 'past_due'
        WHERE status = 'active'
          AND past_due_since IS NOT NULL
          AND past_due_since <= now() - interval '7 days';

        -- Dia 15: bloqueio. Só módulos de cobrança ficam acessíveis
        -- (aplicado no frontend/ProtectedRoute com base neste status).
        UPDATE public.saas_assinaturas
        SET status = 'blocked', blocked_at = now()
        WHERE status IN ('active', 'past_due')
          AND past_due_since IS NOT NULL
          AND past_due_since <= now() - interval '15 days'
          AND blocked_at IS NULL;
      $cron$
    );
  END IF;
END $$;

-- Verificar após aplicar:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'billing-inadimplencia-transicoes';
