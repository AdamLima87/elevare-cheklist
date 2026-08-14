-- LGPD item 3: rotinas de direito do titular. Busca por e-mail OU CPF
-- porque os dados pessoais de terceiros neste sistema (representante
-- legal, responsável técnico de inspeção) usam CPF como identificador
-- principal — nem sempre têm conta/e-mail no RDCheck.
--
-- Escopo deliberado: estas rotinas tratam de dados de TERCEIROS mencionados
-- no sistema (representante, contato, responsável de inspeção). Se o
-- identificador também corresponder a uma conta paga (profiles/auth.users),
-- isso aparece no export mas NUNCA é apagado por aqui — excluir a conta de
-- um cliente pagante é uma ação deliberada e separada, não um efeito
-- colateral de um pedido de terceiro.

CREATE OR REPLACE FUNCTION public.platform_exportar_dados_titular(p_identificador text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_email text;
  v_cpf_digits text;
  v_result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;

  v_email := lower(trim(p_identificador));
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN v_email := NULL; END IF;

  v_cpf_digits := regexp_replace(p_identificador, '\D', '', 'g');
  IF length(v_cpf_digits) <> 11 THEN v_cpf_digits := NULL; END IF;

  IF v_email IS NULL AND v_cpf_digits IS NULL THEN
    RAISE EXCEPTION 'Informe um e-mail válido ou um CPF com 11 dígitos.' USING ERRCODE = '22023';
  END IF;

  v_result := jsonb_build_object(
    'identificador_buscado', p_identificador,
    'gerado_em', now(),

    'conta_rdcheck', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'nome', p.nome, 'email', p.email, 'telefone', p.telefone,
        'perfil', p.perfil, 'empresa_id', p.empresa_id
      )), '[]'::jsonb)
      FROM public.profiles p WHERE v_email IS NOT NULL AND lower(p.email) = v_email
    ),

    'contatos_crm', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'nome', c.nome, 'email', c.email, 'telefone', c.telefone,
        'whatsapp', c.whatsapp, 'cargo', c.cargo, 'crm_empresa_id', c.crm_empresa_id
      )), '[]'::jsonb)
      FROM public.crm_contatos c WHERE v_email IS NOT NULL AND lower(c.email) = v_email
    ),

    'representantes_legais', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'nome_completo', r.nome_completo, 'cpf', r.cpf, 'rg', r.rg,
        'email', r.email, 'telefone', r.telefone, 'cargo', r.cargo, 'crm_empresa_id', r.crm_empresa_id
      )), '[]'::jsonb)
      FROM public.crm_representantes r
      WHERE (v_cpf_digits IS NOT NULL AND regexp_replace(coalesce(r.cpf, ''), '\D', '', 'g') = v_cpf_digits)
         OR (v_email IS NOT NULL AND lower(r.email) = v_email)
    ),

    'contas_pessoa_fisica_crm', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'nome_completo_pf', e.nome_completo_pf, 'cpf', e.cpf, 'empresa_id', e.empresa_id
      )), '[]'::jsonb)
      FROM public.crm_empresas e
      WHERE v_cpf_digits IS NOT NULL AND regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g') = v_cpf_digits
    ),

    'inspecoes_como_responsavel', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'numero_sequencial', i.numero_sequencial,
        'estabelecimento', i.estabelecimento_nome,
        'data_inicio', i.data_inicio,
        'papel', CASE
          WHEN v_cpf_digits IS NOT NULL AND regexp_replace(coalesce(i.dados->'estabelecimento'->>'respLegalCpf', ''), '\D', '', 'g') = v_cpf_digits THEN 'responsavel_legal'
          WHEN v_cpf_digits IS NOT NULL AND regexp_replace(coalesce(i.dados->'estabelecimento'->>'respTecCpf', ''), '\D', '', 'g') = v_cpf_digits THEN 'responsavel_tecnico'
          WHEN v_email IS NOT NULL AND lower(i.dados->'estabelecimento'->>'respLegalEmail') = v_email THEN 'responsavel_legal'
          WHEN v_email IS NOT NULL AND lower(i.dados->'estabelecimento'->>'email') = v_email THEN 'contato_estabelecimento'
          ELSE 'outro'
        END,
        'nome_registrado', coalesce(i.dados->'estabelecimento'->>'respLegalNome', i.dados->'estabelecimento'->>'respTecNome')
      )), '[]'::jsonb)
      FROM public.inspecoes i
      WHERE (v_cpf_digits IS NOT NULL AND (
              regexp_replace(coalesce(i.dados->'estabelecimento'->>'respLegalCpf', ''), '\D', '', 'g') = v_cpf_digits
              OR regexp_replace(coalesce(i.dados->'estabelecimento'->>'respTecCpf', ''), '\D', '', 'g') = v_cpf_digits
            ))
         OR (v_email IS NOT NULL AND (
              lower(i.dados->'estabelecimento'->>'respLegalEmail') = v_email
              OR lower(i.dados->'estabelecimento'->>'email') = v_email
            ))
    ),

    'consentimentos_registrados', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'tela', cp.tela, 'politica_versao', cp.politica_versao, 'aceito_em', cp.aceito_em
      )), '[]'::jsonb)
      FROM public.consentimentos_privacidade cp WHERE v_email IS NOT NULL AND lower(cp.email) = v_email
    ),

    'tentativas_login_seguranca', (
      SELECT jsonb_build_object('quantidade_registros', count(*), 'ultima_tentativa', max(created_at))
      FROM public.login_attempts la WHERE v_email IS NOT NULL AND lower(la.email) = v_email
    )
  );

  INSERT INTO public.audit_log (actor_id, event_type, metadata)
    VALUES (auth.uid(), 'lgpd_exportacao_titular', jsonb_build_object('identificador', p_identificador));

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_anonimizar_titular(p_identificador text, p_confirmar boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_email text;
  v_cpf_digits text;
  v_count_contatos int;
  v_count_representantes int;
  v_count_pf int;
  v_count_inspecoes int;
  v_count_login_attempts int;
  v_count_signup_attempts int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.' USING ERRCODE = '42501';
  END IF;
  IF p_confirmar IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Confirmação obrigatória para anonimizar dados.' USING ERRCODE = '22023';
  END IF;

  v_email := lower(trim(p_identificador));
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN v_email := NULL; END IF;

  v_cpf_digits := regexp_replace(p_identificador, '\D', '', 'g');
  IF length(v_cpf_digits) <> 11 THEN v_cpf_digits := NULL; END IF;

  IF v_email IS NULL AND v_cpf_digits IS NULL THEN
    RAISE EXCEPTION 'Informe um e-mail válido ou um CPF com 11 dígitos.' USING ERRCODE = '22023';
  END IF;

  -- crm_contatos: sem valor de retenção legal — exclui de fato.
  WITH del AS (
    DELETE FROM public.crm_contatos c
    WHERE v_email IS NOT NULL AND lower(c.email) = v_email
    RETURNING 1
  ) SELECT count(*) INTO v_count_contatos FROM del;

  -- crm_representantes: nome/CPF podem ter sido usados num contrato já
  -- assinado — o snapshot em crm_contratos.dados é o registro legal e não é
  -- alterado aqui. Anonimiza a linha viva (não apaga): preserva "existiu um
  -- representante com este cargo" sem manter os dados pessoais dele.
  WITH upd AS (
    UPDATE public.crm_representantes r
    SET nome_completo = '[titular anonimizado a pedido]', cpf = NULL, rg = NULL, email = NULL, telefone = NULL
    WHERE (v_cpf_digits IS NOT NULL AND regexp_replace(coalesce(r.cpf, ''), '\D', '', 'g') = v_cpf_digits)
       OR (v_email IS NOT NULL AND lower(r.email) = v_email)
    RETURNING 1
  ) SELECT count(*) INTO v_count_representantes FROM upd;

  -- crm_empresas (Conta tipo Pessoa Física)
  WITH upd AS (
    UPDATE public.crm_empresas e
    SET nome_completo_pf = '[titular anonimizado a pedido]', cpf = NULL
    WHERE v_cpf_digits IS NOT NULL AND regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g') = v_cpf_digits
    RETURNING 1
  ) SELECT count(*) INTO v_count_pf FROM upd;

  -- inspecoes: o relatório é documento de guarda regulatória obrigatória —
  -- não apaga a inspeção, só troca nome/CPF do(s) responsável(is) dentro do
  -- jsonb pelos placeholders, preservando o restante do relatório intacto.
  WITH matches AS (
    SELECT
      i.id,
      (v_cpf_digits IS NOT NULL AND regexp_replace(coalesce(i.dados->'estabelecimento'->>'respLegalCpf', ''), '\D', '', 'g') = v_cpf_digits)
        OR (v_email IS NOT NULL AND lower(i.dados->'estabelecimento'->>'respLegalEmail') = v_email) AS is_legal,
      (v_cpf_digits IS NOT NULL AND regexp_replace(coalesce(i.dados->'estabelecimento'->>'respTecCpf', ''), '\D', '', 'g') = v_cpf_digits) AS is_tec
    FROM public.inspecoes i
    WHERE (v_cpf_digits IS NOT NULL AND (
            regexp_replace(coalesce(i.dados->'estabelecimento'->>'respLegalCpf', ''), '\D', '', 'g') = v_cpf_digits
            OR regexp_replace(coalesce(i.dados->'estabelecimento'->>'respTecCpf', ''), '\D', '', 'g') = v_cpf_digits
          ))
       OR (v_email IS NOT NULL AND lower(i.dados->'estabelecimento'->>'respLegalEmail') = v_email)
  ),
  upd AS (
    UPDATE public.inspecoes i
    SET dados = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            i.dados,
            '{estabelecimento,respLegalCpf}',
            CASE WHEN m.is_legal THEN '""'::jsonb ELSE coalesce(i.dados->'estabelecimento'->'respLegalCpf', '""'::jsonb) END
          ),
          '{estabelecimento,respTecCpf}',
          CASE WHEN m.is_tec THEN '""'::jsonb ELSE coalesce(i.dados->'estabelecimento'->'respTecCpf', '""'::jsonb) END
        ),
        '{estabelecimento,respLegalNome}',
        CASE WHEN m.is_legal THEN '"[titular anonimizado a pedido]"'::jsonb ELSE coalesce(i.dados->'estabelecimento'->'respLegalNome', '""'::jsonb) END
      ),
      '{estabelecimento,respTecNome}',
      CASE WHEN m.is_tec THEN '"[titular anonimizado a pedido]"'::jsonb ELSE coalesce(i.dados->'estabelecimento'->'respTecNome', '""'::jsonb) END
    )
    FROM matches m
    WHERE i.id = m.id
    RETURNING 1
  ) SELECT count(*) INTO v_count_inspecoes FROM upd;

  -- Logs de segurança: sem valor de retenção além da janela de proteção
  -- contra força bruta, que já expirou pra qualquer tentativa antiga.
  WITH del AS (
    DELETE FROM public.login_attempts la WHERE v_email IS NOT NULL AND lower(la.email) = v_email RETURNING 1
  ) SELECT count(*) INTO v_count_login_attempts FROM del;
  WITH del AS (
    DELETE FROM public.signup_attempts sa WHERE v_email IS NOT NULL AND lower(sa.email) = v_email RETURNING 1
  ) SELECT count(*) INTO v_count_signup_attempts FROM del;

  INSERT INTO public.audit_log (actor_id, event_type, metadata)
    VALUES (auth.uid(), 'lgpd_anonimizacao_titular', jsonb_build_object(
      'identificador', p_identificador,
      'contatos_excluidos', v_count_contatos,
      'representantes_anonimizados', v_count_representantes,
      'contas_pf_anonimizadas', v_count_pf,
      'inspecoes_anonimizadas', v_count_inspecoes,
      'login_attempts_excluidos', v_count_login_attempts,
      'signup_attempts_excluidos', v_count_signup_attempts
    ));

  RETURN jsonb_build_object(
    'contatos_excluidos', v_count_contatos,
    'representantes_anonimizados', v_count_representantes,
    'contas_pf_anonimizadas', v_count_pf,
    'inspecoes_anonimizadas', v_count_inspecoes,
    'login_attempts_excluidos', v_count_login_attempts,
    'signup_attempts_excluidos', v_count_signup_attempts
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.platform_exportar_dados_titular(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_anonimizar_titular(text, boolean) TO authenticated;
