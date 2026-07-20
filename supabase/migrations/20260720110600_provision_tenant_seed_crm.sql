-- CRM Comercial — provision_tenant() passa a semear os catálogos padrão do
-- CRM (pipeline/etapas/motivos de perda/tipos de atividade/origens de lead)
-- pra todo tenant novo, mesma função usada no backfill dos tenants existentes.
CREATE OR REPLACE FUNCTION public.provision_tenant(p_owner_id uuid, p_owner_email text, p_empresa_nome text, p_owner_nome text, p_whatsapp text, p_plano text DEFAULT 'trial'::text, p_status text DEFAULT 'ativo'::text, p_trial_ends_at timestamp with time zone DEFAULT (now() + '14 days'::interval), p_origem jsonb DEFAULT '{}'::jsonb)
 RETURNS provision_tenant_result
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result public.provision_tenant_result;
  v_constraint text;
  v_existing_empresa_id uuid;
  v_has_config boolean;
BEGIN
  -- Owner precisa existir de fato em auth.users e o e-mail bater — guarda
  -- de consistência, já que esta função roda com privilégio elevado.
  PERFORM 1 FROM auth.users
    WHERE id = p_owner_id AND lower(email) = lower(trim(p_owner_email));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owner % não encontrado ou e-mail não corresponde', p_owner_id
      USING ERRCODE = '28000';
  END IF;

  BEGIN
    INSERT INTO public.empresas (nome, plano, status, trial_ends_at)
      VALUES (p_empresa_nome, p_plano, p_status, p_trial_ends_at)
      RETURNING id INTO v_result.empresa_id;

    INSERT INTO public.profiles (id, empresa_id, perfil, nome, email, telefone)
      VALUES (p_owner_id, v_result.empresa_id, 'admin', p_owner_nome, p_owner_email, p_whatsapp);

    INSERT INTO public.configuracoes (empresa_id, nome_empresa)
      VALUES (v_result.empresa_id, p_empresa_nome);

    PERFORM public.crm_seed_catalogos_padrao(v_result.empresa_id);

    INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
      VALUES (
        v_result.empresa_id, p_owner_id, 'empresa_criada',
        p_origem || jsonb_build_object('empresa_id_original', v_result.empresa_id, 'actor_id_original', p_owner_id)
      );

    v_result.status := 'created';
    RETURN v_result;

  EXCEPTION WHEN unique_violation THEN
    -- Só tratamos como retry benigno (corrida entre 2 requisições do
    -- mesmo usuário) se a constraint violada for especificamente
    -- profiles_pkey. Qualquer outra é um erro real e deve propagar.
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint <> 'profiles_pkey' THEN
      RAISE;
    END IF;

    SELECT empresa_id INTO v_existing_empresa_id
      FROM public.profiles WHERE id = p_owner_id;

    SELECT EXISTS (
      SELECT 1 FROM public.configuracoes WHERE empresa_id = v_existing_empresa_id
    ) INTO v_has_config;

    v_result.empresa_id := v_existing_empresa_id;
    v_result.status := CASE
      WHEN v_existing_empresa_id IS NOT NULL AND v_has_config THEN 'already_provisioned'
      ELSE 'inconsistent_state'
    END;
    RETURN v_result;
  END;
END;
$function$
