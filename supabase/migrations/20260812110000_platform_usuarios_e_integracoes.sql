-- Administração da Plataforma — telas "Usuários" e "Integrações" (antes
-- só stubs de navegação). Mesmo padrão já usado em Empresas/Consumo:
-- toda RPC valida is_super_admin() no backend e toda alteração grava uma
-- linha em audit_log na mesma transação.

-- Lista de contas com perfil='super_admin' (equipe do RDCheck, não
-- usuários de tenant). Junta auth.users só pelo e-mail/último acesso —
-- nunca expõe hash de senha nem qualquer outro campo sensível.
CREATE OR REPLACE FUNCTION public.platform_super_admins_lista()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  empresa_id uuid,
  empresa_nome text,
  ativo boolean,
  created_at timestamptz,
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
  SELECT p.id, p.nome, au.email::text, p.empresa_id, e.nome, p.ativo, p.created_at, au.last_sign_in_at
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  LEFT JOIN public.empresas e ON e.id = p.empresa_id
  WHERE p.perfil = 'super_admin'
  ORDER BY p.created_at;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_super_admins_lista() TO authenticated;

-- Busca um usuário existente por e-mail exato, pra promover a
-- super_admin. Só retorna o necessário pra confirmar a pessoa certa antes
-- da ação — nunca lista o cadastro inteiro por e-mail parcial.
CREATE OR REPLACE FUNCTION public.platform_buscar_usuario_por_email(p_email text)
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  perfil text,
  empresa_nome text
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
  SELECT p.id, p.nome, au.email::text, p.perfil, e.nome
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  LEFT JOIN public.empresas e ON e.id = p.empresa_id
  WHERE lower(au.email) = lower(trim(p_email))
  LIMIT 1;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_buscar_usuario_por_email(text) TO authenticated;

-- Promove um profile existente a super_admin.
CREATE OR REPLACE FUNCTION public.platform_promover_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_perfil_atual text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;

  SELECT perfil INTO v_perfil_atual FROM public.profiles WHERE id = p_user_id;
  IF v_perfil_atual IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_perfil_atual = 'super_admin' THEN
    RAISE EXCEPTION 'Este usuário já é super_admin.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles SET perfil = 'super_admin' WHERE id = p_user_id;

  INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
    VALUES (
      (SELECT empresa_id FROM public.profiles WHERE id = p_user_id),
      auth.uid(), 'usuario_promovido_super_admin',
      jsonb_build_object('usuario_id', p_user_id, 'perfil_anterior', v_perfil_atual)
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_promover_super_admin(uuid) TO authenticated;

-- Revoga o acesso de super_admin, devolvendo o profile a 'admin' (dono do
-- próprio tenant, papel mais alto abaixo de super_admin). Nunca deixa a
-- plataforma sem nenhum super_admin restante.
CREATE OR REPLACE FUNCTION public.platform_rebaixar_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_perfil_atual text;
  v_total_super_admins int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;

  SELECT perfil INTO v_perfil_atual FROM public.profiles WHERE id = p_user_id;
  IF v_perfil_atual IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_perfil_atual != 'super_admin' THEN
    RAISE EXCEPTION 'Este usuário não é super_admin.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_total_super_admins FROM public.profiles WHERE perfil = 'super_admin';
  IF v_total_super_admins <= 1 THEN
    RAISE EXCEPTION 'Não é possível remover o último super_admin da plataforma.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles SET perfil = 'admin' WHERE id = p_user_id;

  INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
    VALUES (
      (SELECT empresa_id FROM public.profiles WHERE id = p_user_id),
      auth.uid(), 'usuario_rebaixado_de_super_admin',
      jsonb_build_object('usuario_id', p_user_id)
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_rebaixar_super_admin(uuid) TO authenticated;

-- Status agregado das integrações de terceiros usadas pela plataforma —
-- nunca lê ciphertext de credenciais, só as mesmas colunas de status já
-- expostas em platform_google_places_consumo().
CREATE OR REPLACE FUNCTION public.platform_integracoes_resumo()
RETURNS TABLE (
  empresas_total int,
  google_places_tenants_byo int,
  google_places_tenants_rdcheck int,
  google_places_tenants_invalido int,
  google_places_leads_total int,
  email_tenants_habilitados int
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
    (SELECT count(*) FROM public.crm_leads_credenciais WHERE status = 'conectado')::int,
    (SELECT count(*) FROM public.empresas e
       WHERE NOT EXISTS (
         SELECT 1 FROM public.crm_leads_credenciais c WHERE c.empresa_id = e.id AND c.status = 'conectado'
       ))::int,
    (SELECT count(*) FROM public.crm_leads_credenciais WHERE status = 'invalido')::int,
    (SELECT count(*) FROM public.crm_leads_importacoes)::int,
    (SELECT count(*) FROM public.configuracoes WHERE enviar_email_cliente = true)::int;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_integracoes_resumo() TO authenticated;
