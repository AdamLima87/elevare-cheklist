-- Fix encontrado pelo script de testes: crm_registrar_timeline_sistema()
-- exige auth.uid() válido e can_access_crm()/get_minha_empresa() (revalida
-- tenant a partir da sessão) — mas crm_solicitar_otp_assinatura e
-- crm_verificar_e_assinar_otp são chamadas via service-role pela Edge
-- Function/rota Node (nunca por um usuário autenticado; o "autenticado" é o
-- signatário externo, que não tem linha em profiles). Chamar o helper
-- fazia toda a transação falhar com "Sem permissão para registrar evento
-- nesta oportunidade." — inclusive revertendo a assinatura já concluída,
-- já que o INSERT de timeline era o último passo da função.
--
-- Correção: essas duas RPCs passam a inserir em crm_timeline diretamente
-- (já são SECURITY DEFINER e já validam o próprio acesso via o contrato
-- resolvido internamente — não precisam da revalidação de sessão que o
-- helper faz pra RPCs chamadas por staff autenticado).

CREATE OR REPLACE FUNCTION public.crm_solicitar_otp_assinatura(p_contrato_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_contrato public.crm_contratos;
  v_codigo text;
BEGIN
  SELECT * INTO v_contrato FROM public.crm_contratos WHERE id = p_contrato_id FOR UPDATE;
  IF v_contrato.id IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_contrato.status <> 'enviado' THEN
    RAISE EXCEPTION 'CONTRATO_NAO_ASSINAVEL: contrato não está em estado assinável (status atual: %).', v_contrato.status;
  END IF;
  IF v_contrato.assinatura_email_solicitado IS NULL THEN
    RAISE EXCEPTION 'ASSINATURA_ELETRONICA_NAO_HABILITADA: assinatura eletrônica não foi habilitada para este contrato.';
  END IF;

  UPDATE public.crm_assinatura_otp SET expira_em = now()
    WHERE contrato_id = p_contrato_id AND verificado_em IS NULL AND expira_em > now();

  v_codigo := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');

  INSERT INTO public.crm_assinatura_otp (contrato_id, empresa_id, codigo_hash, expira_em)
    VALUES (p_contrato_id, v_contrato.empresa_id, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), now() + interval '10 minutes');

  INSERT INTO public.crm_timeline (empresa_id, crm_empresa_id, crm_oportunidade_id, autor_id, origem, evento_tipo, descricao, metadata)
    VALUES (v_contrato.empresa_id, v_contrato.crm_empresa_id, v_contrato.crm_oportunidade_id, NULL, 'sistema',
      'assinatura_otp_solicitado', 'Código de verificação de assinatura eletrônica enviado ao signatário.',
      jsonb_build_object('contrato_id', p_contrato_id));

  RETURN v_codigo;
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_solicitar_otp_assinatura(uuid) FROM PUBLIC;


CREATE OR REPLACE FUNCTION public.crm_verificar_e_assinar_otp(
  p_contrato_id uuid,
  p_codigo text,
  p_nome_signatario text,
  p_ip text,
  p_user_agent text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_otp public.crm_assinatura_otp;
  v_contrato public.crm_contratos;
  v_hash text;
BEGIN
  SELECT * INTO v_otp FROM public.crm_assinatura_otp
    WHERE contrato_id = p_contrato_id AND verificado_em IS NULL AND expira_em > now()
    ORDER BY created_at DESC LIMIT 1
    FOR UPDATE;

  IF v_otp.id IS NULL THEN
    RAISE EXCEPTION 'OTP_INVALIDO: código inválido, expirado ou sem tentativas disponíveis.';
  END IF;
  IF v_otp.tentativas > 5 THEN
    RAISE EXCEPTION 'OTP_INVALIDO: código inválido, expirado ou sem tentativas disponíveis.';
  END IF;
  IF v_otp.codigo_hash <> encode(extensions.digest(p_codigo, 'sha256'), 'hex') THEN
    RAISE EXCEPTION 'OTP_INVALIDO: código inválido, expirado ou sem tentativas disponíveis.';
  END IF;

  SELECT * INTO v_contrato FROM public.crm_contratos WHERE id = p_contrato_id FOR UPDATE;
  IF v_contrato.id IS NULL OR v_contrato.status <> 'enviado' THEN
    RAISE EXCEPTION 'OTP_INVALIDO: código inválido, expirado ou sem tentativas disponíveis.';
  END IF;

  v_hash := encode(extensions.digest(v_contrato.dados::text, 'sha256'), 'hex');

  UPDATE public.crm_assinatura_otp SET verificado_em = now() WHERE id = v_otp.id;
  UPDATE public.crm_assinatura_otp SET expira_em = now()
    WHERE contrato_id = p_contrato_id AND id <> v_otp.id AND verificado_em IS NULL;

  UPDATE public.crm_contratos SET
    status = 'assinado',
    assinado_em = now(),
    origem_assinatura = 'assinatura_eletronica',
    assinatura_signatario_nome = trim(p_nome_signatario),
    assinatura_signatario_email = v_contrato.assinatura_email_solicitado,
    assinatura_ip = p_ip,
    assinatura_user_agent = p_user_agent,
    assinatura_hash_conteudo = v_hash
  WHERE id = p_contrato_id AND status = 'enviado';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OTP_INVALIDO: código inválido, expirado ou sem tentativas disponíveis.';
  END IF;

  INSERT INTO public.crm_timeline (empresa_id, crm_empresa_id, crm_oportunidade_id, autor_id, origem, evento_tipo, descricao, metadata)
    VALUES (v_contrato.empresa_id, v_contrato.crm_empresa_id, v_contrato.crm_oportunidade_id, NULL, 'sistema',
      'contrato_assinado_eletronicamente', 'Contrato assinado eletronicamente pelo signatário.',
      jsonb_build_object('contrato_id', p_contrato_id, 'email_mascarado',
        regexp_replace(v_contrato.assinatura_email_solicitado, '^(.).*(@.*)$', '\1***\2')));
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_verificar_e_assinar_otp(uuid, text, text, text, text) FROM PUBLIC;
