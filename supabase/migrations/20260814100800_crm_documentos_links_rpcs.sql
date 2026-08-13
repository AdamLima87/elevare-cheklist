-- Fase B — RPCs de link público. crm_gerar_link_documento devolve o TOKEN
-- BRUTO apenas nesta resposta — nunca mais recuperável depois (se perdido,
-- gerar outro via nova chamada + revogar o antigo se quiser). O frontend
-- monta a URL completa (`${origin}/documento/${token}`); o banco nunca guarda
-- nem o token nem a URL, só o hash. Nunca gravar token/URL em
-- crm_timeline.metadata — só token_id.
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

  -- pgcrypto vive no schema "extensions" neste projeto (não em "public"),
  -- e a função roda com search_path='public' — qualificar explicitamente.
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
REVOKE ALL ON FUNCTION public.crm_gerar_link_documento(text, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_gerar_link_documento(text, uuid, int) TO authenticated;


CREATE OR REPLACE FUNCTION public.crm_revogar_link_documento(p_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_link public.crm_documentos_links;
BEGIN
  SELECT perfil, empresa_id INTO v_perfil, v_minha_empresa FROM public.profiles WHERE id = auth.uid();
  IF v_perfil NOT IN ('admin', 'consultor') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_link FROM public.crm_documentos_links WHERE id = p_link_id FOR UPDATE;
  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'Link não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_link.empresa_id <> v_minha_empresa AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Link não pertence ao seu tenant.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.crm_documentos_links SET revogado_em = COALESCE(revogado_em, now()) WHERE id = p_link_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_revogar_link_documento(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_revogar_link_documento(uuid) TO authenticated;
