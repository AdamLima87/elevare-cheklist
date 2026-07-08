-- Document and (where possible) reproduce the email queue cron job.
--
-- Background: 20260609185704/185719/185805/192707_email_infra.sql are four
-- byte-identical copies of the same idempotent setup, re-emitted by the
-- Lovable migration tool on repeated runs. They are safe no-ops on replay
-- (every statement uses IF NOT EXISTS / CREATE OR REPLACE / exception
-- handlers) and are kept as-is for history. Do not edit or squash them —
-- any future change to email infrastructure should go in a new timestamped
-- migration like this one.
--
-- The pg_cron job that actually drains the email queue ('process-email-queue',
-- polling every 5s) was never captured in a migration. Per the note at the
-- bottom of 20260609192707_email_infra.sql, it was applied out-of-band via
-- the Supabase Management API because it needs a project-specific service
-- role key and URL. That means a fresh `supabase db reset` / migration
-- replay leaves the queue tables in place but nothing draining them.
--
-- This migration reproduces that job idempotently, but ONLY when the
-- prerequisites are already present (pg_cron extension enabled and a vault
-- secret named 'email_queue_service_role_key', as documented in
-- 20260609192707_email_infra.sql). If either is missing — e.g. a local
-- `supabase start` or a CI database with no Management-API-provisioned
-- secret — this is a safe no-op.
--
-- IMPORTANT — validate before relying on this in production:
--   * Confirm this project's pg_cron version supports the 3-arg
--     `cron.schedule(name, interval_text, command)` form used below
--     (`SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';`).
--   * Confirm `vault.decrypted_secrets` is the correct view name for this
--     project's Supabase/Postgres version (Vault's internals have changed
--     across versions).
--   * Confirm `current_setting('app.settings.supabase_url', true)` actually
--     resolves to this project's URL below — that setting is a common
--     Supabase convention but isn't guaranteed to be configured on every
--     project. If it resolves to NULL/empty, replace it with the project's
--     literal URL before relying on this job.
-- A wrong function/view name makes the DO block below a silent no-op
-- (caught by the outer IF EXISTS guard), not a hard failure — so re-run the
-- verification query in this migration's rollback notes after applying.
--
-- To revert: SELECT cron.unschedule('process-email-queue');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key') THEN

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
      PERFORM cron.unschedule('process-email-queue');
    END IF;

    PERFORM cron.schedule(
      'process-email-queue',
      '5 seconds',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.settings.supabase_url', true) || '/lovable/email/queue/process',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (
              SELECT decrypted_secret FROM vault.decrypted_secrets
              WHERE name = 'email_queue_service_role_key'
            ),
            'Content-Type', 'application/json'
          )
        );
      $cron$
    );
  END IF;
END $$;

-- Verify after applying: SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'process-email-queue';
