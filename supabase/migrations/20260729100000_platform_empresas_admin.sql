-- Administração da Plataforma — Fase 2: gestão global de tenants.
-- Toda RPC valida is_super_admin() no backend (não confia só em RLS/
-- frontend) e toda alteração grava uma linha em audit_log na mesma
-- transação — pedido explícito do usuário.

-- Uma query só: todas as empresas + contagens por tenant + último acesso
-- (join em auth.users.last_sign_in_at — mesmo dado que admin-manage-users
-- já usa via Admin API na ação list_with_auth, aqui direto em SQL porque
-- esta função já roda com privilégio elevado).
CREATE OR REPLACE FUNCTION public.platform_empresas_resumo()
RETURNS TABLE (
  id uuid,
  nome text,
  cnpj text,
  plano text,
  status text,
  trial_ends_at timestamptz,
  created_at timestamptz,
  usuarios int,
  clientes int,
  inspecoes int,
  oportunidades int,
  leads_importados int,
  ultimo_acesso timestamptz
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
    e.id, e.nome, e.cnpj, e.plano, e.status, e.trial_ends_at, e.created_at,
    (SELECT count(*) FROM public.profiles p WHERE p.empresa_id = e.id)::int,
    (SELECT count(*) FROM public.clientes c WHERE c.empresa_id = e.id)::int,
    (SELECT count(*) FROM public.inspecoes i WHERE i.empresa_id = e.id)::int,
    (SELECT count(*) FROM public.crm_oportunidades o WHERE o.empresa_id = e.id)::int,
    (SELECT count(*) FROM public.crm_leads_importacoes li WHERE li.empresa_id = e.id)::int,
    (
      SELECT max(au.last_sign_in_at)
      FROM public.profiles p
      JOIN auth.users au ON au.id = p.id
      WHERE p.empresa_id = e.id
    )
  FROM public.empresas e
  ORDER BY e.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_empresas_resumo() TO authenticated;

-- Ativar/suspender.
CREATE OR REPLACE FUNCTION public.platform_atualizar_empresa_status(p_empresa_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('ativo', 'inativo') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status USING ERRCODE = '22023';
  END IF;

  UPDATE public.empresas SET status = p_status WHERE id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
    VALUES (p_empresa_id, auth.uid(), 'empresa_status_alterado', jsonb_build_object('novo_status', p_status));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_atualizar_empresa_status(uuid, text) TO authenticated;

-- Alterar plano — valida contra o catálogo saas_planos (Fase 0) em vez de
-- aceitar qualquer texto, já que empresas.plano continua sendo uma coluna
-- texto livre sem CHECK constraint.
CREATE OR REPLACE FUNCTION public.platform_atualizar_empresa_plano(p_empresa_id uuid, p_plano text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saas_planos WHERE codigo = p_plano AND ativo) THEN
    RAISE EXCEPTION 'Plano inválido: %', p_plano USING ERRCODE = '22023';
  END IF;

  UPDATE public.empresas SET plano = p_plano WHERE id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
    VALUES (p_empresa_id, auth.uid(), 'empresa_plano_alterado', jsonb_build_object('novo_plano', p_plano));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_atualizar_empresa_plano(uuid, text) TO authenticated;

-- Estender trial.
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

  INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
    VALUES (p_empresa_id, auth.uid(), 'empresa_trial_estendido', jsonb_build_object('novo_trial_ends_at', p_novo_trial_ends_at));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_estender_trial(uuid, timestamptz) TO authenticated;

-- Override pontual de limite (ex: suporte libera mais leads pra um
-- tenant específico sem mudar o plano dele). Só grava o override —
-- religar isso em crm_leads_resolver_limite() é fase futura.
CREATE OR REPLACE FUNCTION public.platform_definir_override_limite(
  p_empresa_id uuid, p_limite_key text, p_valor numeric, p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id) THEN
    RAISE EXCEPTION 'Empresa não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saas_plano_limites WHERE limite_key = p_limite_key) THEN
    RAISE EXCEPTION 'Chave de limite desconhecida: %', p_limite_key USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.saas_empresa_overrides (empresa_id, limite_key, valor, motivo, criado_por)
    VALUES (p_empresa_id, p_limite_key, p_valor, p_motivo, auth.uid());

  INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
    VALUES (
      p_empresa_id, auth.uid(), 'empresa_limite_override',
      jsonb_build_object('limite_key', p_limite_key, 'valor', p_valor, 'motivo', p_motivo)
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_definir_override_limite(uuid, text, numeric, text) TO authenticated;
