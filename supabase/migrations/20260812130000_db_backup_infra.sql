-- Backup lógico diário 100% dentro do Supabase (sem serviço externo),
-- decisão do usuário em vez de upgrade pro plano Pro (que teria PITR/backup
-- gerenciado). Arquitetura: pg_cron chama a Edge Function `db-backup`
-- (supabase/functions/db-backup/index.ts) 1x/dia; ela exporta cada tabela de
-- `public` via PostgREST (service role, bypassa RLS), comprime em gzip e
-- sobe pro bucket privado `db-backups`, apagando o que passar de 7 dias.
--
-- Mesmo idioma já usado em 20260708120000_document_email_cron_job.sql e
-- 20260708130000_reinspection_reminder_cron.sql: guard por pg_cron +
-- vault.decrypted_secrets, unschedule-then-reschedule idempotente. Os
-- valores dos secrets (service role key + URL do projeto) NUNCA vão em
-- texto puro numa migration — são inseridos manualmente fora do git via:
--   select vault.create_secret('<service_role_key>', 'db_backup_service_role_key');
--   select vault.create_secret('<https://PROJECT_REF>.supabase.co', 'db_backup_project_url');
-- Sem os dois secrets presentes, o bloco abaixo é um no-op seguro (mesma
-- garantia dos dois crons anteriores).
--
-- IMPORTANT — confirmado em staging (2026-08-12) que
-- `current_setting('app.settings.supabase_url', true)` resolve VAZIO neste
-- projeto (não é um GUC configurado aqui, ao contrário do que os dois crons
-- irmãos presumiam sem checar) — por isso a URL também vai por Vault, nunca
-- por esse `current_setting`. Reconfirmar o mesmo em produção antes de
-- ativar o secret lá.
--
-- To revert: SELECT cron.unschedule('daily-db-backup');
--            DROP FUNCTION IF EXISTS public.listar_tabelas_backup();
--            DELETE FROM storage.buckets WHERE id = 'db-backups'; (só depois de esvaziar objects)

-- Bucket privado — sem policy de leitura/escrita pra `authenticated`/`anon`;
-- só o service role (que sempre bypassa RLS) grava/lê, exatamente como
-- pretendido para um backup interno, não uma feature de usuário.
INSERT INTO storage.buckets (id, name, public)
VALUES ('db-backups', 'db-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Lista as tabelas base de `public`, pra Edge Function não precisar de
-- conexão Postgres direta (só PostgREST) nem hardcodar a lista de tabelas
-- (que muda a cada migration nova).
CREATE OR REPLACE FUNCTION public.listar_tabelas_backup()
RETURNS TABLE (tabela text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT tablename::text
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
$function$;

-- Só o service role chama isso (via Edge Function) — sem grant a
-- authenticated/anon, mesma lógica de acesso restrito das outras RPCs
-- internas deste projeto.
REVOKE ALL ON FUNCTION public.listar_tabelas_backup() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'db_backup_service_role_key')
     AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'db_backup_project_url') THEN

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-db-backup') THEN
      PERFORM cron.unschedule('daily-db-backup');
    END IF;

    -- 05:00 UTC (02:00 em Brasília) — fora do horário comercial.
    PERFORM cron.schedule(
      'daily-db-backup',
      '0 5 * * *',
      $cron$
        SELECT net.http_post(
          url := (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'db_backup_project_url'
          ) || '/functions/v1/db-backup',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (
              SELECT decrypted_secret FROM vault.decrypted_secrets
              WHERE name = 'db_backup_service_role_key'
            ),
            'Content-Type', 'application/json'
          )
        );
      $cron$
    );
  END IF;
END $$;

-- Verify after applying: SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'daily-db-backup';
