-- Fase B — RPCs de contrato. Mesmo padrão SECURITY DEFINER das RPCs de
-- proposta: empresa_id resolvido no servidor, validação manual de
-- perfil/tenant, nunca confiado do client.

CREATE OR REPLACE FUNCTION public.crm_obter_ou_criar_contrato(p_proposta_id uuid)
RETURNS TABLE (contrato_id uuid, criado boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_proposta public.crm_propostas;
  v_crm_empresa public.crm_empresas;
  v_template public.crm_contrato_templates;
  v_contrato public.crm_contratos;
  v_novo_id uuid;
  v_representante public.crm_representantes;
  v_faltando text[] := '{}';
  v_variaveis jsonb;
  v_itens jsonb;
  v_servicos_texto text;
  v_desconhecidas text[];
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão para criar contrato.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_proposta FROM public.crm_propostas WHERE id = p_proposta_id FOR UPDATE;
  IF v_proposta.id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_proposta.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Proposta não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_proposta.status <> 'aceita' THEN
    RAISE EXCEPTION 'PROPOSTA_NAO_ACEITA: só é possível gerar contrato a partir de uma proposta aceita (status atual: %).', v_proposta.status;
  END IF;

  -- Get-or-create: no máximo 1 contrato não-cancelado por proposta (índice
  -- único parcial). Se já existe, devolve idempotentemente.
  SELECT * INTO v_contrato FROM public.crm_contratos
    WHERE crm_proposta_id = p_proposta_id AND status <> 'cancelado' FOR UPDATE;
  IF v_contrato.id IS NOT NULL THEN
    RETURN QUERY SELECT v_contrato.id, false;
    RETURN;
  END IF;

  SELECT * INTO v_crm_empresa FROM public.crm_empresas WHERE id = v_proposta.crm_empresa_id;

  -- Validação de completude jurídica: PJ exige representante principal
  -- ativo; PF não exige representante.
  IF v_crm_empresa.tipo_pessoa IS NULL THEN
    v_faltando := array_append(v_faltando, 'tipo_pessoa');
  ELSIF v_crm_empresa.tipo_pessoa = 'juridica' THEN
    IF v_crm_empresa.cnpj IS NULL THEN v_faltando := array_append(v_faltando, 'cnpj'); END IF;
    IF v_crm_empresa.razao_social IS NULL OR v_crm_empresa.razao_social = '' THEN v_faltando := array_append(v_faltando, 'razao_social'); END IF;
    SELECT * INTO v_representante FROM public.crm_representantes
      WHERE crm_empresa_id = v_crm_empresa.id AND principal = true AND ativo = true LIMIT 1;
    IF v_representante.id IS NULL THEN v_faltando := array_append(v_faltando, 'representante_principal'); END IF;
  ELSIF v_crm_empresa.tipo_pessoa = 'fisica' THEN
    IF v_crm_empresa.nome_completo_pf IS NULL OR v_crm_empresa.nome_completo_pf = '' THEN v_faltando := array_append(v_faltando, 'nome_completo_pf'); END IF;
    IF v_crm_empresa.cpf IS NULL THEN v_faltando := array_append(v_faltando, 'cpf'); END IF;
  END IF;

  IF v_crm_empresa.cep IS NULL THEN v_faltando := array_append(v_faltando, 'cep'); END IF;
  IF v_crm_empresa.endereco IS NULL THEN v_faltando := array_append(v_faltando, 'endereco'); END IF;
  IF v_crm_empresa.numero IS NULL THEN v_faltando := array_append(v_faltando, 'numero'); END IF;
  IF v_crm_empresa.bairro IS NULL THEN v_faltando := array_append(v_faltando, 'bairro'); END IF;
  IF v_crm_empresa.cidade_endereco IS NULL THEN v_faltando := array_append(v_faltando, 'cidade_endereco'); END IF;
  IF v_crm_empresa.uf_endereco IS NULL THEN v_faltando := array_append(v_faltando, 'uf_endereco'); END IF;

  IF array_length(v_faltando, 1) > 0 THEN
    RAISE EXCEPTION 'CONTRATO_DADOS_INCOMPLETOS: campos faltando na Conta: %.', array_to_string(v_faltando, ', ');
  END IF;

  SELECT * INTO v_template FROM public.crm_contrato_templates WHERE empresa_id = v_proposta.empresa_id AND ativo = true LIMIT 1;
  IF v_template.id IS NULL THEN
    RAISE EXCEPTION 'CONTRATO_SEM_TEMPLATE: nenhum template de contrato ativo configurado para este tenant.';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('nome', nome, 'descricao', descricao, 'valor', valor, 'ordem', ordem) ORDER BY ordem)
    INTO v_itens
    FROM public.crm_proposta_itens WHERE proposta_id = p_proposta_id;
  SELECT string_agg(nome, ', ' ORDER BY ordem) INTO v_servicos_texto FROM public.crm_proposta_itens WHERE proposta_id = p_proposta_id;

  v_variaveis := jsonb_build_object(
    'contratada.razao_social', (SELECT nome_empresa FROM public.configuracoes WHERE empresa_id = v_proposta.empresa_id LIMIT 1),
    'contratada.cnpj', '',
    'cliente.razao_social', CASE WHEN v_crm_empresa.tipo_pessoa = 'juridica' THEN v_crm_empresa.razao_social ELSE '' END,
    'cliente.nome_completo_pf', CASE WHEN v_crm_empresa.tipo_pessoa = 'fisica' THEN v_crm_empresa.nome_completo_pf ELSE '' END,
    'cliente.cnpj', CASE WHEN v_crm_empresa.tipo_pessoa = 'juridica' THEN v_crm_empresa.cnpj ELSE '' END,
    'cliente.cpf', CASE WHEN v_crm_empresa.tipo_pessoa = 'fisica' THEN v_crm_empresa.cpf ELSE '' END,
    'cliente.representante_legal', COALESCE(v_representante.nome_completo, ''),
    'proposta.servicos', COALESCE(v_servicos_texto, ''),
    'proposta.valor_total', to_char(COALESCE(v_proposta.valor_total, 0), 'FM999G999G990D00'),
    'contrato.prazo', '',
    'contrato.forma_pagamento', ''
  );

  SELECT array_agg(DISTINCT m[1]) INTO v_desconhecidas
    FROM jsonb_array_elements(v_template.conteudo) s, regexp_matches(coalesce(s->>'corpo', ''), '\{\{([a-zA-Z0-9_.]+)\}\}', 'g') m
    WHERE NOT (m[1] = ANY (ARRAY(SELECT jsonb_object_keys(v_variaveis))));
  IF v_desconhecidas IS NOT NULL AND array_length(v_desconhecidas, 1) > 0 THEN
    RAISE EXCEPTION 'CONTRATO_VARIAVEL_DESCONHECIDA: o template usa variável(is) não suportada(s): %.', array_to_string(v_desconhecidas, ', ');
  END IF;

  v_novo_id := gen_random_uuid();
  INSERT INTO public.crm_contratos (
    id, empresa_id, crm_oportunidade_id, crm_proposta_id, crm_empresa_id, crm_contrato_template_id, status, dados
  ) VALUES (
    v_novo_id, v_proposta.empresa_id, v_proposta.crm_oportunidade_id, p_proposta_id, v_proposta.crm_empresa_id, v_template.id, 'rascunho',
    jsonb_build_object(
      'contratada', jsonb_build_object('razao_social', v_variaveis->>'contratada.razao_social', 'cnpj', v_variaveis->>'contratada.cnpj'),
      'cliente', jsonb_build_object(
        'tipo_pessoa', v_crm_empresa.tipo_pessoa, 'razao_social', v_crm_empresa.razao_social, 'nome_completo_pf', v_crm_empresa.nome_completo_pf,
        'cnpj', v_crm_empresa.cnpj, 'cpf', v_crm_empresa.cpf, 'cep', v_crm_empresa.cep, 'endereco', v_crm_empresa.endereco,
        'numero', v_crm_empresa.numero, 'complemento', v_crm_empresa.complemento, 'bairro', v_crm_empresa.bairro,
        'cidade_endereco', v_crm_empresa.cidade_endereco, 'uf_endereco', v_crm_empresa.uf_endereco
      ),
      'representante', CASE WHEN v_representante.id IS NOT NULL THEN
        jsonb_build_object('nome_completo', v_representante.nome_completo, 'cpf', v_representante.cpf, 'rg', v_representante.rg, 'cargo', v_representante.cargo)
        ELSE NULL END,
      'proposta', jsonb_build_object('id', p_proposta_id, 'numero_revisao', v_proposta.numero_revisao, 'itens', COALESCE(v_itens, '[]'::jsonb), 'valor_total', v_proposta.valor_total),
      'contrato', jsonb_build_object('prazo', '', 'forma_pagamento', ''),
      'template', jsonb_build_object('id', v_template.id, 'nome', v_template.nome, 'versao', v_template.versao, 'conteudo', v_template.conteudo),
      'variaveis', v_variaveis,
      'conteudo_renderizado', public.crm_renderizar_contrato_template(v_template.conteudo, v_variaveis)
    )
  );

  PERFORM public.crm_registrar_timeline_sistema(
    v_proposta.crm_oportunidade_id, 'contrato_gerado', 'Rascunho de contrato criado a partir da proposta aceita.',
    jsonb_build_object('contrato_id', v_novo_id, 'crm_proposta_id', p_proposta_id)
  );

  RETURN QUERY SELECT v_novo_id, true;
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_obter_ou_criar_contrato(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_obter_ou_criar_contrato(uuid) TO authenticated;


-- Recalcula o snapshot de um contrato ainda em rascunho (ex.: representante
-- mudou antes de gerar de fato). Nunca age fora de rascunho.
CREATE OR REPLACE FUNCTION public.crm_atualizar_snapshot_contrato_rascunho(p_contrato_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_contrato public.crm_contratos;
  v_proposta public.crm_propostas;
  v_crm_empresa public.crm_empresas;
  v_template public.crm_contrato_templates;
  v_representante public.crm_representantes;
  v_variaveis jsonb;
  v_itens jsonb;
  v_servicos_texto text;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_contrato FROM public.crm_contratos WHERE id = p_contrato_id FOR UPDATE;
  IF v_contrato.id IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_contrato.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Contrato não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_contrato.status <> 'rascunho' THEN
    RAISE EXCEPTION 'CONTRATO_NAO_EDITAVEL: só é possível atualizar o snapshot de um contrato em rascunho (status atual: %).', v_contrato.status;
  END IF;

  SELECT * INTO v_proposta FROM public.crm_propostas WHERE id = v_contrato.crm_proposta_id;
  SELECT * INTO v_crm_empresa FROM public.crm_empresas WHERE id = v_contrato.crm_empresa_id;
  SELECT * INTO v_template FROM public.crm_contrato_templates WHERE id = v_contrato.crm_contrato_template_id;
  SELECT * INTO v_representante FROM public.crm_representantes WHERE crm_empresa_id = v_crm_empresa.id AND principal = true AND ativo = true LIMIT 1;

  SELECT jsonb_agg(jsonb_build_object('nome', nome, 'descricao', descricao, 'valor', valor, 'ordem', ordem) ORDER BY ordem)
    INTO v_itens FROM public.crm_proposta_itens WHERE proposta_id = v_contrato.crm_proposta_id;
  SELECT string_agg(nome, ', ' ORDER BY ordem) INTO v_servicos_texto FROM public.crm_proposta_itens WHERE proposta_id = v_contrato.crm_proposta_id;

  v_variaveis := jsonb_build_object(
    'contratada.razao_social', (SELECT nome_empresa FROM public.configuracoes WHERE empresa_id = v_contrato.empresa_id LIMIT 1),
    'contratada.cnpj', '',
    'cliente.razao_social', CASE WHEN v_crm_empresa.tipo_pessoa = 'juridica' THEN v_crm_empresa.razao_social ELSE '' END,
    'cliente.nome_completo_pf', CASE WHEN v_crm_empresa.tipo_pessoa = 'fisica' THEN v_crm_empresa.nome_completo_pf ELSE '' END,
    'cliente.cnpj', CASE WHEN v_crm_empresa.tipo_pessoa = 'juridica' THEN v_crm_empresa.cnpj ELSE '' END,
    'cliente.cpf', CASE WHEN v_crm_empresa.tipo_pessoa = 'fisica' THEN v_crm_empresa.cpf ELSE '' END,
    'cliente.representante_legal', COALESCE(v_representante.nome_completo, ''),
    'proposta.servicos', COALESCE(v_servicos_texto, ''),
    'proposta.valor_total', to_char(COALESCE(v_proposta.valor_total, 0), 'FM999G999G990D00'),
    'contrato.prazo', COALESCE(v_contrato.dados->'contrato'->>'prazo', ''),
    'contrato.forma_pagamento', COALESCE(v_contrato.dados->'contrato'->>'forma_pagamento', '')
  );

  UPDATE public.crm_contratos SET dados = jsonb_build_object(
    'contratada', jsonb_build_object('razao_social', v_variaveis->>'contratada.razao_social', 'cnpj', v_variaveis->>'contratada.cnpj'),
    'cliente', jsonb_build_object(
      'tipo_pessoa', v_crm_empresa.tipo_pessoa, 'razao_social', v_crm_empresa.razao_social, 'nome_completo_pf', v_crm_empresa.nome_completo_pf,
      'cnpj', v_crm_empresa.cnpj, 'cpf', v_crm_empresa.cpf, 'cep', v_crm_empresa.cep, 'endereco', v_crm_empresa.endereco,
      'numero', v_crm_empresa.numero, 'complemento', v_crm_empresa.complemento, 'bairro', v_crm_empresa.bairro,
      'cidade_endereco', v_crm_empresa.cidade_endereco, 'uf_endereco', v_crm_empresa.uf_endereco
    ),
    'representante', CASE WHEN v_representante.id IS NOT NULL THEN
      jsonb_build_object('nome_completo', v_representante.nome_completo, 'cpf', v_representante.cpf, 'rg', v_representante.rg, 'cargo', v_representante.cargo)
      ELSE NULL END,
    'proposta', jsonb_build_object('id', v_contrato.crm_proposta_id, 'numero_revisao', v_proposta.numero_revisao, 'itens', COALESCE(v_itens, '[]'::jsonb), 'valor_total', v_proposta.valor_total),
    'contrato', jsonb_build_object('prazo', v_variaveis->>'contrato.prazo', 'forma_pagamento', v_variaveis->>'contrato.forma_pagamento'),
    'template', jsonb_build_object('id', v_template.id, 'nome', v_template.nome, 'versao', v_template.versao, 'conteudo', v_template.conteudo),
    'variaveis', v_variaveis,
    'conteudo_renderizado', public.crm_renderizar_contrato_template(v_template.conteudo, v_variaveis)
  ) WHERE id = p_contrato_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_atualizar_snapshot_contrato_rascunho(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_atualizar_snapshot_contrato_rascunho(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.crm_marcar_contrato_gerado(p_contrato_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_contrato public.crm_contratos;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_contrato FROM public.crm_contratos WHERE id = p_contrato_id FOR UPDATE;
  IF v_contrato.id IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_contrato.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Contrato não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_contrato.status <> 'rascunho' THEN
    RAISE EXCEPTION 'CONTRATO_NAO_EDITAVEL: só é possível gerar um contrato em rascunho (status atual: %).', v_contrato.status;
  END IF;

  -- A partir daqui, dados/conteúdo ficam congelados pra sempre — nenhuma RPC
  -- subsequente altera dados; só campos de status/assinatura.
  UPDATE public.crm_contratos SET status = 'gerado', gerado_em = now() WHERE id = p_contrato_id;

  PERFORM public.crm_registrar_timeline_sistema(
    v_contrato.crm_oportunidade_id, 'contrato_gerado', 'Contrato gerado (conteúdo congelado).',
    jsonb_build_object('contrato_id', p_contrato_id)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_marcar_contrato_gerado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_marcar_contrato_gerado(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.crm_marcar_contrato_enviado(p_contrato_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_contrato public.crm_contratos;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_contrato FROM public.crm_contratos WHERE id = p_contrato_id FOR UPDATE;
  IF v_contrato.id IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_contrato.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Contrato não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_contrato.status NOT IN ('gerado', 'enviado') THEN
    RAISE EXCEPTION 'CONTRATO_NAO_ENVIAVEL: só é possível marcar como enviado um contrato gerado (status atual: %).', v_contrato.status;
  END IF;

  UPDATE public.crm_contratos SET status = 'enviado', enviado_em = COALESCE(enviado_em, now()) WHERE id = p_contrato_id;

  PERFORM public.crm_registrar_timeline_sistema(
    v_contrato.crm_oportunidade_id, 'contrato_enviado', 'Contrato enviado ao cliente (aguardando assinatura).',
    jsonb_build_object('contrato_id', p_contrato_id)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_marcar_contrato_enviado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_marcar_contrato_enviado(uuid) TO authenticated;


-- Exige pelo menos um dos dois (arquivo OU justificativa OR ambos) — nunca
-- os dois vazios. Mesma lógica do CHECK estrutural da tabela.
CREATE OR REPLACE FUNCTION public.crm_marcar_contrato_assinado(
  p_contrato_id uuid,
  p_arquivo_path text DEFAULT NULL,
  p_justificativa text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_contrato public.crm_contratos;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_contrato FROM public.crm_contratos WHERE id = p_contrato_id FOR UPDATE;
  IF v_contrato.id IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_contrato.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Contrato não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_contrato.status <> 'enviado' THEN
    RAISE EXCEPTION 'CONTRATO_NAO_ASSINAVEL: só é possível marcar como assinado um contrato enviado (status atual: %).', v_contrato.status;
  END IF;
  IF p_arquivo_path IS NULL AND coalesce(trim(p_justificativa), '') = '' THEN
    RAISE EXCEPTION 'CONTRATO_ASSINATURA_SEM_EVIDENCIA: informe o arquivo assinado, uma justificativa, ou ambos.';
  END IF;

  UPDATE public.crm_contratos SET
    status = 'assinado', assinado_em = now(), assinado_por = auth.uid(),
    arquivo_assinado_path = p_arquivo_path, justificativa_sem_arquivo = NULLIF(trim(p_justificativa), '')
  WHERE id = p_contrato_id;

  PERFORM public.crm_registrar_timeline_sistema(
    v_contrato.crm_oportunidade_id, 'contrato_assinado', 'Contrato marcado como assinado.',
    jsonb_build_object('contrato_id', p_contrato_id, 'tem_arquivo', p_arquivo_path IS NOT NULL, 'tem_justificativa', coalesce(trim(p_justificativa), '') <> '')
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_marcar_contrato_assinado(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_marcar_contrato_assinado(uuid, text, text) TO authenticated;


-- Só age em rascunho/gerado/enviado. Contrato assinado NUNCA pode ser
-- cancelado por esta RPC — rescisão pós-assinatura é conceito separado,
-- fora do escopo desta fase (rejeita com erro explícito).
CREATE OR REPLACE FUNCTION public.crm_cancelar_contrato(p_contrato_id uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_contrato public.crm_contratos;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_contrato FROM public.crm_contratos WHERE id = p_contrato_id FOR UPDATE;
  IF v_contrato.id IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_contrato.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Contrato não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;
  IF v_contrato.status = 'assinado' THEN
    RAISE EXCEPTION 'CONTRATO_ASSINADO_NAO_CANCELAVEL: um contrato assinado não pode ser cancelado por esta ação — rescisão contratual é um fluxo separado, ainda não implementado.';
  END IF;
  IF v_contrato.status NOT IN ('rascunho', 'gerado', 'enviado') THEN
    RAISE EXCEPTION 'CONTRATO_NAO_CANCELAVEL: não é possível cancelar um contrato com status "%".', v_contrato.status;
  END IF;

  UPDATE public.crm_contratos SET status = 'cancelado', cancelado_em = now(), cancelado_motivo = p_motivo WHERE id = p_contrato_id;

  PERFORM public.crm_registrar_timeline_sistema(
    v_contrato.crm_oportunidade_id, 'contrato_cancelado', 'Contrato cancelado.',
    jsonb_build_object('contrato_id', p_contrato_id, 'motivo', p_motivo)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_cancelar_contrato(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_cancelar_contrato(uuid, text) TO authenticated;
