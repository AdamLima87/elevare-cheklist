-- Fase 8: Cupons + área de Cobranças da Administração da Plataforma.

-- Corrige inconsistência real: platform_estender_trial só atualizava
-- empresas.trial_ends_at, mas get_tenant_access_status() (Fase 5) lê de
-- saas_assinaturas.trial_ends_at — estender trial pelo painel não
-- refletia no controle de acesso real do tenant. Atualiza os dois.
CREATE OR REPLACE FUNCTION public.platform_estender_trial(p_empresa_id uuid, p_novo_trial_ends_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.empresas SET trial_ends_at = p_novo_trial_ends_at WHERE id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.saas_assinaturas
  SET trial_ends_at = p_novo_trial_ends_at
  WHERE empresa_id = p_empresa_id
    AND id = (
      SELECT id FROM public.saas_assinaturas WHERE empresa_id = p_empresa_id ORDER BY created_at DESC LIMIT 1
    );

  INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
    VALUES (p_empresa_id, auth.uid(), 'empresa_trial_estendido', jsonb_build_object('novo_trial_ends_at', p_novo_trial_ends_at));
END;
$function$;

-- Bloqueio/desbloqueio administrativo — independente do fluxo automático
-- de inadimplência (dia 15). Sempre exige motivo, sempre audita.
CREATE OR REPLACE FUNCTION public.platform_bloquear_assinatura(p_empresa_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_assinatura_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo é obrigatório.' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_assinatura_id FROM public.saas_assinaturas WHERE empresa_id = p_empresa_id ORDER BY created_at DESC LIMIT 1;
  IF v_assinatura_id IS NULL THEN
    RAISE EXCEPTION 'Empresa sem assinatura.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.saas_assinaturas SET status = 'blocked', blocked_at = now() WHERE id = v_assinatura_id;

  INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
    VALUES (p_empresa_id, auth.uid(), 'empresa_bloqueada_manualmente', jsonb_build_object('motivo', p_motivo));
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_desbloquear_assinatura(p_empresa_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_assinatura_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo é obrigatório.' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_assinatura_id FROM public.saas_assinaturas WHERE empresa_id = p_empresa_id ORDER BY created_at DESC LIMIT 1;
  IF v_assinatura_id IS NULL THEN
    RAISE EXCEPTION 'Empresa sem assinatura.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.saas_assinaturas
  SET status = 'active', blocked_at = NULL, past_due_since = NULL
  WHERE id = v_assinatura_id;

  INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
    VALUES (p_empresa_id, auth.uid(), 'empresa_desbloqueada_manualmente', jsonb_build_object('motivo', p_motivo));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_bloquear_assinatura(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_desbloquear_assinatura(uuid, text) TO authenticated;

-- Reabre um evento de webhook com erro pra reprocessamento manual (a
-- Edge Function reprocessar-webhook-evento executa a lógica de fato).
CREATE OR REPLACE FUNCTION public.platform_marcar_evento_para_reprocessar(p_evento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.saas_webhook_eventos SET status = 'recebido', error = NULL WHERE id = p_evento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_marcar_evento_para_reprocessar(uuid) TO authenticated;

-- Indicadores agregados pro painel de Cobranças da Plataforma.
CREATE OR REPLACE FUNCTION public.platform_billing_dashboard()
RETURNS TABLE (
  trials_ativos int,
  trials_expirando_em_breve int,
  trials_expirados int,
  assinaturas_ativas int,
  inadimplentes_1_a_6 int,
  inadimplentes_7_a_14 int,
  bloqueados int,
  cancelados int,
  webhooks_com_erro int,
  ultimos_pagamentos jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT
    (SELECT count(*) FROM public.saas_assinaturas WHERE status = 'trialing' AND (trial_ends_at IS NULL OR trial_ends_at >= now()))::int,
    (SELECT count(*) FROM public.saas_assinaturas WHERE status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at >= now() AND trial_ends_at <= now() + interval '3 days')::int,
    (SELECT count(*) FROM public.saas_assinaturas WHERE status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at < now())::int,
    (SELECT count(*) FROM public.saas_assinaturas WHERE status = 'active')::int,
    (SELECT count(*) FROM public.saas_assinaturas WHERE status = 'active' AND past_due_since IS NOT NULL)::int,
    (SELECT count(*) FROM public.saas_assinaturas WHERE status = 'past_due')::int,
    (SELECT count(*) FROM public.saas_assinaturas WHERE status = 'blocked')::int,
    (SELECT count(*) FROM public.saas_assinaturas WHERE status = 'canceled')::int,
    (SELECT count(*) FROM public.saas_webhook_eventos WHERE status = 'erro')::int,
    (SELECT coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) FROM (
      SELECT sp.id, e.nome AS empresa_nome, sp.valor_cobrado, sp.status, sp.created_at
      FROM public.saas_pagamentos sp
      JOIN public.empresas e ON e.id = sp.empresa_id
      ORDER BY sp.created_at DESC LIMIT 10
    ) p);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_billing_dashboard() TO authenticated;

-- Lista de assinaturas pra tela de Cobranças (com filtro por status feito
-- no frontend sobre este retorno único — volume esperado é pequeno).
CREATE OR REPLACE FUNCTION public.platform_assinaturas_lista()
RETURNS TABLE (
  empresa_id uuid,
  empresa_nome text,
  plano_codigo text,
  periodicidade text,
  status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  past_due_since timestamptz,
  blocked_at timestamptz
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
  SELECT DISTINCT ON (sa.empresa_id)
    sa.empresa_id, e.nome, sa.plano_codigo, sa.periodicidade, sa.status,
    sa.trial_ends_at, sa.current_period_end, sa.past_due_since, sa.blocked_at
  FROM public.saas_assinaturas sa
  JOIN public.empresas e ON e.id = sa.empresa_id
  ORDER BY sa.empresa_id, sa.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_assinaturas_lista() TO authenticated;

-- Cupons: valida e RESERVA atomicamente numa única transação (evita corrida
-- entre checar e reservar por duplo clique/concorrência). Chamável por
-- qualquer authenticated (não só super_admin) — é o usuário do checkout
-- aplicando o próprio cupom. Nunca aceita desconto do frontend: resolve
-- tipo_desconto/valor daqui, quem calcula o preço final é criar-checkout.
-- Colunas de retorno prefixadas com out_ de propósito: RETURNS TABLE cria
-- variáveis implícitas com esses nomes dentro da função, e "cupom_id"/
-- "valor" também são nomes de colunas reais em saas_cupom_utilizacoes/
-- saas_cupons — sem o prefixo, qualquer referência não qualificada a eles
-- dentro do corpo vira "column reference is ambiguous".
CREATE OR REPLACE FUNCTION public.aplicar_cupom_checkout(p_codigo text, p_checkout_intencao_id uuid)
RETURNS TABLE (out_cupom_id uuid, out_tipo_desconto text, out_valor numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cupom record;
  v_intencao record;
  v_usos_confirmados int;
BEGIN
  SELECT * INTO v_intencao FROM public.saas_checkout_intencoes
    WHERE id = p_checkout_intencao_id AND auth_user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intenção de checkout não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_cupom FROM public.saas_cupons WHERE upper(codigo) = upper(trim(p_codigo)) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupom não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_cupom.ativo THEN
    RAISE EXCEPTION 'Este cupom não está mais ativo.' USING ERRCODE = '22023';
  END IF;
  IF now() < v_cupom.data_inicio OR (v_cupom.data_fim IS NOT NULL AND now() > v_cupom.data_fim) THEN
    RAISE EXCEPTION 'Este cupom está fora do período de validade.' USING ERRCODE = '22023';
  END IF;
  IF v_cupom.plano_codigo IS NOT NULL AND v_cupom.plano_codigo != v_intencao.plano_codigo THEN
    RAISE EXCEPTION 'Este cupom não é válido para este plano.' USING ERRCODE = '22023';
  END IF;
  IF v_cupom.periodicidade IS NOT NULL AND v_cupom.periodicidade != v_intencao.periodicidade THEN
    RAISE EXCEPTION 'Este cupom não é válido para esta periodicidade.' USING ERRCODE = '22023';
  END IF;
  IF v_cupom.max_utilizacoes IS NOT NULL AND v_cupom.utilizacoes_atual >= v_cupom.max_utilizacoes THEN
    RAISE EXCEPTION 'Este cupom já atingiu o limite de utilizações.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_usos_confirmados FROM public.saas_cupom_utilizacoes
    WHERE cupom_id = v_cupom.id AND auth_user_id = auth.uid() AND status = 'confirmado';
  IF v_usos_confirmados >= v_cupom.max_utilizacoes_por_empresa THEN
    RAISE EXCEPTION 'Você já utilizou este cupom.' USING ERRCODE = '22023';
  END IF;

  -- O índice único de saas_cupom_utilizacoes é parcial (só quando
  -- checkout_intencao_id IS NOT NULL) — o ON CONFLICT precisa repetir essa
  -- condição pra Postgres conseguir inferir qual índice usar.
  INSERT INTO public.saas_cupom_utilizacoes (cupom_id, auth_user_id, checkout_intencao_id, status, expires_at)
    VALUES (v_cupom.id, auth.uid(), p_checkout_intencao_id, 'reservado', v_intencao.expires_at)
  ON CONFLICT (cupom_id, checkout_intencao_id) WHERE checkout_intencao_id IS NOT NULL DO UPDATE
    SET status = 'reservado', reserved_at = now(), expires_at = v_intencao.expires_at
    WHERE public.saas_cupom_utilizacoes.status <> 'confirmado';

  UPDATE public.saas_checkout_intencoes SET cupom_codigo = v_cupom.codigo WHERE id = p_checkout_intencao_id;

  RETURN QUERY SELECT v_cupom.id, v_cupom.tipo_desconto, v_cupom.valor;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.aplicar_cupom_checkout(text, uuid) TO authenticated;

-- Remove a reserva (usuário tirou o cupom antes de pagar).
CREATE OR REPLACE FUNCTION public.remover_cupom_checkout(p_checkout_intencao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.saas_cupom_utilizacoes
  WHERE checkout_intencao_id = p_checkout_intencao_id
    AND auth_user_id = auth.uid()
    AND status = 'reservado';
  UPDATE public.saas_checkout_intencoes SET cupom_codigo = NULL
    WHERE id = p_checkout_intencao_id AND auth_user_id = auth.uid();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.remover_cupom_checkout(uuid) TO authenticated;

-- Confirma o uso do cupom quando o pagamento é confirmado (chamada só
-- pelo webhook, via service_role — incrementa utilizacoes_atual de forma
-- atômica com row lock, então dois webhooks concorrentes pro mesmo cupom
-- nunca contam a mesma utilização duas vezes nem perdem uma contagem).
CREATE OR REPLACE FUNCTION public.confirmar_cupom_checkout(p_checkout_intencao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uso record;
BEGIN
  SELECT * INTO v_uso FROM public.saas_cupom_utilizacoes
    WHERE checkout_intencao_id = p_checkout_intencao_id AND status = 'reservado'
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN; -- sem cupom reservado pra esta intenção, nada a fazer
  END IF;

  UPDATE public.saas_cupom_utilizacoes SET status = 'confirmado', used_at = now() WHERE id = v_uso.id;
  UPDATE public.saas_cupons SET utilizacoes_atual = utilizacoes_atual + 1 WHERE id = v_uso.cupom_id;
END;
$function$;

-- Preço público de um plano (não sensível — é o preço exibido no site).
-- Existe pra tela de checkout poder mostrar "valor original / desconto /
-- valor final" sem precisar de acesso a saas_plano_limites (RLS restrita
-- a super_admin). Preview no frontend, nunca autoridade: quem define o
-- valor final cobrado de fato é sempre criar-checkout, no backend.
CREATE OR REPLACE FUNCTION public.resolver_preco_plano(p_plano_codigo text, p_periodicidade text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT spl.valor
  FROM public.saas_plano_limites spl
  JOIN public.saas_planos sp ON sp.id = spl.plano_id
  WHERE sp.codigo = p_plano_codigo
    AND spl.limite_key = CASE WHEN p_periodicidade = 'mensal' THEN 'preco_mensal' ELSE 'preco_anual' END
$function$;

GRANT EXECUTE ON FUNCTION public.resolver_preco_plano(text, text) TO authenticated;

-- Verificar após aplicar:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'expire-checkout%';
