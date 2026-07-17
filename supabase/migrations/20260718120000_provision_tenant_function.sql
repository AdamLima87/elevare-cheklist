-- Camada de bootstrap de tenant: cria empresa + profile do dono +
-- configuracoes + evento de auditoria numa única transação Postgres real
-- (uma função PL/pgSQL = uma transação; se qualquer INSERT falhar, os
-- anteriores são desfeitos automaticamente).

ALTER TABLE public.empresas ADD COLUMN trial_ends_at timestamptz;

-- profiles.telefone (WhatsApp) ainda não existia — necessário para o
-- cadastro público, que pede WhatsApp do dono.
ALTER TABLE public.profiles ADD COLUMN telefone text;

-- Lookup exato por e-mail, direto em auth.users — não depende do filtro
-- solto da REST Admin API (não documentado como exact-match nem como
-- cobrindo todas as páginas). Só service_role: expõe existência de conta
-- por e-mail, não deve ser chamável por authenticated/anon.
CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(p_email text)
RETURNS TABLE(user_id uuid, email_confirmed boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT id, (email_confirmed_at IS NOT NULL)
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.auth_user_id_by_email(text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_email(text) TO service_role;

CREATE TYPE public.provision_tenant_result AS (
  status text,       -- 'created' | 'already_provisioned' | 'inconsistent_state'
  empresa_id uuid
);

-- plano/status/trial_ends_at são parâmetros, não hardcoded: quem decide o
-- valor é o CHAMADOR do lado do servidor (a Edge Function), nunca o corpo
-- de uma requisição pública. O signup público sempre passa 'trial'/14
-- dias; o create_empresa do super admin passa o que o formulário
-- administrativo definir — esta função não força trial numa empresa
-- criada manualmente.
CREATE OR REPLACE FUNCTION public.provision_tenant(
  p_owner_id uuid,
  p_owner_email text,
  p_empresa_nome text,
  p_owner_nome text,
  p_whatsapp text,
  p_plano text DEFAULT 'trial',
  p_status text DEFAULT 'ativo',
  p_trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  p_origem jsonb DEFAULT '{}'  -- inclui provisioning_source ('public_signup' | 'super_admin')
) RETURNS public.provision_tenant_result
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
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
$$;
REVOKE EXECUTE ON FUNCTION public.provision_tenant(uuid, text, text, text, text, text, text, timestamptz, jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.provision_tenant(uuid, text, text, text, text, text, text, timestamptz, jsonb) TO service_role;
