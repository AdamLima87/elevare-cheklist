-- Fase C — RPCs de assinatura eletrônica (OTP por e-mail). Duas classes de
-- RPC bem distintas aqui:
--  - crm_habilitar_assinatura_eletronica: chamada pelo consultor autenticado
--    (mesmo padrão de permissão das demais RPCs de contrato).
--  - crm_solicitar_otp_assinatura / crm_registrar_tentativa_otp_assinatura /
--    crm_verificar_e_assinar_otp: chamadas SÓ pela Edge Function
--    crm-documento-publico via service-role. O signatário externo não tem
--    linha em profiles, então nenhuma dessas confia em auth.uid() — a
--    "autenticação" dele é o token do link público + o código OTP. Por isso
--    NENHUMA delas recebe GRANT EXECUTE para authenticated/anon: só
--    service_role (que ignora GRANT) consegue chamá-las.

CREATE OR REPLACE FUNCTION public.crm_habilitar_assinatura_eletronica(p_contrato_id uuid, p_email_signatario text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_perfil text;
  v_minha_empresa uuid;
  v_contrato public.crm_contratos;
  v_email text;
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
    RAISE EXCEPTION 'CONTRATO_NAO_ASSINAVEL: só é possível habilitar assinatura eletrônica pra um contrato enviado (status atual: %).', v_contrato.status;
  END IF;

  v_email := lower(trim(p_email_signatario));
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'E-mail do signatário inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.crm_contratos SET assinatura_email_solicitado = v_email WHERE id = p_contrato_id;

  PERFORM public.crm_registrar_timeline_sistema(
    v_contrato.crm_oportunidade_id, 'assinatura_eletronica_habilitada', 'Assinatura eletrônica habilitada para este contrato.',
    jsonb_build_object('contrato_id', p_contrato_id)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_habilitar_assinatura_eletronica(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_habilitar_assinatura_eletronica(uuid, text) TO authenticated;


-- Gera um novo código de 6 dígitos, superando (expirando) qualquer OTP
-- anterior ainda não-verificado do mesmo contrato — só existe um OTP ativo
-- por vez. Retorna o código em texto puro SÓ pro caller (service-role); a
-- função nunca grava o código bruto em lugar nenhum, só o hash.
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

  -- Supera qualquer OTP anterior ainda ativo — nunca mais de um vigente.
  UPDATE public.crm_assinatura_otp SET expira_em = now()
    WHERE contrato_id = p_contrato_id AND verificado_em IS NULL AND expira_em > now();

  -- pgcrypto vive em "extensions", não "public" — mesmo padrão de
  -- crm_gerar_link_documento. Converte 4 bytes aleatórios pra um inteiro via
  -- o literal de bit string 'x...' (hex), depois módulo 1e6 pra um código de
  -- 6 dígitos com distribuição uniforme.
  v_codigo := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');

  INSERT INTO public.crm_assinatura_otp (contrato_id, empresa_id, codigo_hash, expira_em)
    VALUES (p_contrato_id, v_contrato.empresa_id, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), now() + interval '10 minutes');

  PERFORM public.crm_registrar_timeline_sistema(
    v_contrato.crm_oportunidade_id, 'assinatura_otp_solicitado', 'Código de verificação de assinatura eletrônica enviado ao signatário.',
    jsonb_build_object('contrato_id', p_contrato_id)
  );

  RETURN v_codigo;
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_solicitar_otp_assinatura(uuid) FROM PUBLIC;


-- Incrementa a contagem de tentativas do OTP ativo em sua PRÓPRIA transação
-- (chamada separadamente de crm_verificar_e_assinar_otp pela Edge Function),
-- pra que o contador persista mesmo quando a verificação seguinte falha e
-- reverte — senão o rate-limit de tentativas nunca avançaria em códigos
-- errados, já que o RAISE EXCEPTION da verificação desfaria tudo dentro da
-- mesma transação.
CREATE OR REPLACE FUNCTION public.crm_registrar_tentativa_otp_assinatura(p_contrato_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE public.crm_assinatura_otp SET tentativas = tentativas + 1
    WHERE id = (
      SELECT id FROM public.crm_assinatura_otp
      WHERE contrato_id = p_contrato_id AND verificado_em IS NULL AND expira_em > now()
      ORDER BY created_at DESC LIMIT 1
      FOR UPDATE
    );
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_registrar_tentativa_otp_assinatura(uuid) FROM PUBLIC;


-- Verifica o código e, se válido, assina o contrato — tudo em uma única
-- transação atômica. O hash de integridade é sempre calculado aqui dentro,
-- direto de crm_contratos.dados já persistido — nunca aceito como parâmetro
-- do chamador. Concorrência: duas chamadas simultâneas com o mesmo código
-- disputam o lock de linha do OTP (via a subquery WHERE verificado_em IS
-- NULL); a segunda, depois que a primeira commita, não encontra mais OTP
-- ativo e é rejeitada com a mesma mensagem genérica — nunca duas assinaturas.
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

  -- Hash de integridade: sempre derivado server-side do conteúdo já
  -- persistido e congelado, nunca de nada vindo do navegador.
  v_hash := encode(extensions.digest(v_contrato.dados::text, 'sha256'), 'hex');

  UPDATE public.crm_assinatura_otp SET verificado_em = now() WHERE id = v_otp.id;
  -- Defensivo: invalida qualquer outro OTP não-verificado do mesmo contrato
  -- (na prática só deveria existir 0, já que solicitar sempre supera o
  -- anterior, mas garante atomicamente mesmo em cenários inesperados).
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

  PERFORM public.crm_registrar_timeline_sistema(
    v_contrato.crm_oportunidade_id, 'contrato_assinado_eletronicamente', 'Contrato assinado eletronicamente pelo signatário.',
    jsonb_build_object('contrato_id', p_contrato_id, 'email_mascarado',
      regexp_replace(v_contrato.assinatura_email_solicitado, '^(.).*(@.*)$', '\1***\2'))
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.crm_verificar_e_assinar_otp(uuid, text, text, text, text) FROM PUBLIC;
