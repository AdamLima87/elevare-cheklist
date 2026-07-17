-- Auditoria mínima para o fluxo de cadastro público: empresa_criada,
-- convite de equipe, tentativas de signup bloqueadas/inconsistentes. Não é
-- um sistema de auditoria abrangente para todas as ações do app — só os
-- eventos deste trabalho.
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- ON DELETE SET NULL (não RESTRICT/CASCADE): apagar uma empresa de teste
-- (rollback, cleanup de staging, exclusão administrativa) não pode ficar
-- bloqueado por linhas de log dependentes, e apagar a empresa não deve
-- apagar o histórico de auditoria junto. O evento continua existindo, só
-- perde a referência. provision_tenant() já grava o empresa_id/actor_id
-- originais dentro de metadata no momento da criação — serve de cópia de
-- segurança caso a FK vire NULL depois. Essa cópia segue a mesma retenção
-- de 12 meses da linha (purgada junto, não é um repositório à parte).

CREATE INDEX audit_log_empresa_idx ON public.audit_log (empresa_id, created_at);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa() AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'
    ))
  );
-- Zero policy de INSERT/UPDATE/DELETE para authenticated/anon — só
-- service_role grava (Edge Functions, provision_tenant). Um log de
-- auditoria que o próprio usuário pudesse escrever não seria confiável.

-- Log de tentativas de cadastro público — rate limiting e investigação de
-- abuso. Campos deliberadamente mínimos: nunca senha, token, ou corpo
-- completo da requisição.
CREATE TABLE public.signup_attempts (
  id bigserial PRIMARY KEY,
  ip inet,
  email text,
  success boolean NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signup_attempts_ip_idx ON public.signup_attempts (ip, created_at);
CREATE INDEX signup_attempts_email_idx ON public.signup_attempts (lower(email), created_at);

ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;
-- Zero policies: tabela só acessível via service_role (a Edge Function),
-- nunca pelo app autenticado. Log de segurança interno.

-- Retenção: audit_log 12 meses, signup_attempts 30 dias. Reaproveita o
-- padrão de pg_cron já usado no projeto (20260708120000_document_email_
-- cron_job.sql), mas sem depender de vault/http — é um DELETE direto.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-audit-log') THEN
      PERFORM cron.unschedule('purge-audit-log');
    END IF;
    PERFORM cron.schedule(
      'purge-audit-log',
      '0 3 * * *',
      $cron$ DELETE FROM public.audit_log WHERE created_at < now() - interval '12 months'; $cron$
    );

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-signup-attempts') THEN
      PERFORM cron.unschedule('purge-signup-attempts');
    END IF;
    PERFORM cron.schedule(
      'purge-signup-attempts',
      '0 3 * * *',
      $cron$ DELETE FROM public.signup_attempts WHERE created_at < now() - interval '30 days'; $cron$
    );
  END IF;
END $$;

-- Verificar após aplicar:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'purge-%';
