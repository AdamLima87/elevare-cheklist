-- Daily pg_cron job for re-inspection reminder emails.
--
-- Reuses the exact idempotent idiom from
-- 20260708120000_document_email_cron_job.sql (same pg_cron + vault guard,
-- same unschedule-then-reschedule pattern) — see that file for the fuller
-- explanation of why this can't just be a plain CREATE.
--
-- IMPORTANT — validate before relying on this in production, same caveats
-- as the previous cron migration:
--   * Confirm this project's pg_cron version supports the 3-arg
--     `cron.schedule(name, interval_text, command)` form used below.
--   * Confirm `vault.decrypted_secrets` is the correct view name for this
--     project's Supabase/Postgres version.
--   * Confirm the target URL below actually resolves to this project's
--     deployed app origin.
-- This migration cannot be applied or tested from this sandbox (no live
-- Supabase/pg_cron/vault connection) — it needs live validation.
--
-- To revert: SELECT cron.unschedule('check-reinspection-reminders');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key') THEN

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-reinspection-reminders') THEN
      PERFORM cron.unschedule('check-reinspection-reminders');
    END IF;

    -- Runs once a day (09:00 UTC) — pg_cron's 1-minute granularity isn't
    -- relevant here since the reminder window (14 days) tolerates a job
    -- that only fires daily.
    PERFORM cron.schedule(
      'check-reinspection-reminders',
      '0 9 * * *',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.settings.supabase_url', true) || '/lovable/email/reminders/check-reinspection',
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

-- Verify after applying: SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'check-reinspection-reminders';
