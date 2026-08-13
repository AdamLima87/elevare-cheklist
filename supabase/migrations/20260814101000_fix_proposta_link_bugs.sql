-- Fase B — correções encontradas pelos testes de isolamento antes de
-- qualquer aplicação em produção:
--
-- 1) crm_criar_revisao_proposta inseria a revisão nova ANTES de marcar a
--    atual como 'substituida' — colidia com o índice único parcial
--    (só 1 linha não-terminal por grupo), já que as duas ficavam
--    não-terminais ao mesmo tempo dentro da mesma transação. Corrigido:
--    UPDATE da atual primeiro, INSERT da nova depois.
-- 2) crm_gerar_link_documento chamava gen_random_bytes()/digest() sem
--    schema — pgcrypto vive em "extensions" neste projeto, não em "public",
--    e a função roda com search_path='public'. Corrigido: chamadas
--    schema-qualificadas (extensions.gen_random_bytes / extensions.digest).

CREATE OR REPLACE FUNCTION public.crm_criar_revisao_proposta(p_proposta_id uuid)
RETURNS TABLE (proposta_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_atual public.crm_propostas;
  v_novo_id uuid;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão para criar revisão de proposta.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_atual FROM public.crm_propostas WHERE id = p_proposta_id FOR UPDATE;
  IF v_atual.id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada ou sem permissão.' USING ERRCODE = 'P0002';
  END IF;
  IF v_atual.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Proposta não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;

  IF v_atual.status NOT IN ('gerada', 'enviada') THEN
    RAISE EXCEPTION 'PROPOSTA_REVISAO_INVALIDA: só é possível criar uma nova revisão a partir de uma proposta gerada ou enviada (status atual: %).', v_atual.status;
  END IF;

  UPDATE public.crm_propostas SET status = 'substituida' WHERE id = v_atual.id;

  v_novo_id := gen_random_uuid();
  INSERT INTO public.crm_propostas (
    id, empresa_id, crm_oportunidade_id, crm_empresa_id, grupo_proposta_id,
    numero_revisao, revisao_anterior_id, status, valor_total
  ) VALUES (
    v_novo_id, v_atual.empresa_id, v_atual.crm_oportunidade_id, v_atual.crm_empresa_id, v_atual.grupo_proposta_id,
    v_atual.numero_revisao + 1, v_atual.id, 'rascunho', v_atual.valor_total
  );

  INSERT INTO public.crm_proposta_itens (empresa_id, proposta_id, servico_catalogo_id, nome, descricao, valor, ordem)
    SELECT empresa_id, v_novo_id, servico_catalogo_id, nome, descricao, valor, ordem
    FROM public.crm_proposta_itens WHERE proposta_id = v_atual.id;

  PERFORM public.crm_registrar_timeline_sistema(
    v_atual.crm_oportunidade_id, 'proposta_substituida', 'Nova revisão de proposta criada.',
    jsonb_build_object('revisao_anterior_id', v_atual.id, 'nova_revisao_id', v_novo_id, 'numero_revisao', v_atual.numero_revisao + 1)
  );

  RETURN QUERY SELECT v_novo_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.crm_gerar_link_documento(
  p_tipo text,
  p_id uuid,
  p_validade_dias int DEFAULT 30
)
RETURNS TABLE (token text, link_id uuid, expira_em timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_empresa_id uuid;
  v_crm_oportunidade_id uuid;
  v_token text;
  v_hash text;
  v_link_id uuid;
  v_expira timestamptz;
  v_proposta_id uuid;
  v_contrato_id uuid;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão para gerar link.' USING ERRCODE = '42501';
  END IF;

  IF p_tipo NOT IN ('proposta', 'contrato') THEN
    RAISE EXCEPTION 'Tipo de documento inválido: %.', p_tipo;
  END IF;
  IF p_validade_dias IS NULL OR p_validade_dias < 1 OR p_validade_dias > 365 THEN
    RAISE EXCEPTION 'Validade em dias inválida (use entre 1 e 365).';
  END IF;

  IF p_tipo = 'proposta' THEN
    SELECT empresa_id, crm_oportunidade_id INTO v_empresa_id, v_crm_oportunidade_id
      FROM public.crm_propostas WHERE id = p_id;
    v_proposta_id := p_id;
  ELSE
    SELECT empresa_id, crm_oportunidade_id INTO v_empresa_id, v_crm_oportunidade_id
      FROM public.crm_contratos WHERE id = p_id;
    v_contrato_id := p_id;
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Documento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Documento não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expira := now() + (p_validade_dias || ' days')::interval;

  INSERT INTO public.crm_documentos_links (empresa_id, tipo, proposta_id, contrato_id, token_hash, expira_em, created_by)
    VALUES (v_empresa_id, p_tipo, v_proposta_id, v_contrato_id, v_hash, v_expira, auth.uid())
    RETURNING id INTO v_link_id;

  PERFORM public.crm_registrar_timeline_sistema(
    v_crm_oportunidade_id, 'link_documento_criado', 'Link público de documento gerado.',
    jsonb_build_object('token_id', v_link_id, 'tipo', p_tipo)
  );

  RETURN QUERY SELECT v_token, v_link_id, v_expira;
END;
$function$;
