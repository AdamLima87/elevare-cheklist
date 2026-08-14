-- Bloqueio temporário de login após tentativas erradas — mitigação de
-- força bruta contra credenciais (achado da auditoria de segurança).
-- Mesmo padrão já usado em signup_attempts: tabela de log mínima (nunca
-- senha), checagem por janela de tempo, sem estado externo. 10 tentativas
-- erradas com o mesmo e-mail em 2 minutos bloqueia novas tentativas por
-- 2 minutos a partir da última falha.

CREATE TABLE public.login_attempts (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON public.login_attempts (lower(email), created_at);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- Zero policies: tabela só acessível via SECURITY DEFINER (funções abaixo)
-- ou service_role. Mesmo modelo de signup_attempts.

-- Chamada pelo formulário de login (anon, antes de autenticar) para saber
-- se deve nem tentar. Só olha falhas — sucesso não é contado, então o
-- bloqueio expira sozinho quando a janela de 2 minutos passa sem novas
-- falhas (não há como acumular falha nova enquanto bloqueado, já que o
-- client não chama signInWithPassword se bloqueado==true).
CREATE OR REPLACE FUNCTION public.verificar_bloqueio_login(p_email text)
RETURNS TABLE (bloqueado boolean, tentativas_restantes int, desbloqueia_em timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_falhas int;
  v_ultima_falha timestamptz;
BEGIN
  SELECT count(*), max(created_at)
    INTO v_falhas, v_ultima_falha
    FROM public.login_attempts
    WHERE lower(email) = lower(p_email)
      AND success = false
      AND created_at > now() - interval '2 minutes';

  IF v_falhas >= 10 THEN
    RETURN QUERY SELECT true, 0, v_ultima_falha + interval '2 minutes';
  ELSE
    RETURN QUERY SELECT false, GREATEST(0, 10 - v_falhas), NULL::timestamptz;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.verificar_bloqueio_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_bloqueio_login(text) TO anon, authenticated;

-- Chamada pelo formulário de login logo após signInWithPassword falhar.
-- Sem checagem de perfil/auth — precisa ser chamável por anon (ainda não
-- autenticado nesse ponto do fluxo). Grava só e-mail (nunca senha) +
-- timestamp, mesma disciplina de signup_attempts.
CREATE OR REPLACE FUNCTION public.registrar_tentativa_login_falha(p_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  INSERT INTO public.login_attempts (email, success) VALUES (p_email, false);
$function$;

REVOKE ALL ON FUNCTION public.registrar_tentativa_login_falha(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_tentativa_login_falha(text) TO anon, authenticated;

-- Retenção de 30 dias, mesmo prazo de signup_attempts, mesmo padrão de
-- pg_cron já usado no projeto.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-login-attempts') THEN
      PERFORM cron.unschedule('purge-login-attempts');
    END IF;
    PERFORM cron.schedule(
      'purge-login-attempts',
      '0 3 * * *',
      $cron$ DELETE FROM public.login_attempts WHERE created_at < now() - interval '30 days'; $cron$
    );
  END IF;
END $$;

-- Verificar após aplicar: SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'purge-login-attempts';
