-- ============================================================
-- Migration: Setup daily cron job for birthday emails
-- Run this in Supabase Dashboard SQL editor
-- ============================================================

-- Enable pg_cron extension (required for scheduling)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create or replace the function that calls the edge function
CREATE OR REPLACE FUNCTION public.trigger_birthday_emails()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result text;
BEGIN
  SELECT content::text INTO result
  FROM http(('POST', 'https://atvdorphwnpzhobvfmtz.supabase.co/functions/v1/send-birthday-emails', ARRAY[http_header('Content-Type', 'application/json'), http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwV8Hdp7f7vC5xWw3Wxqo')], '{}', 'application/json')::http_request);
  RETURN result;
END;
$$;

-- Schedule the job to run daily at 8:00 AM
SELECT cron.schedule(
  'birthday-emails-daily',     -- job name
  '0 8 * * *',                 -- every day at 8:00 AM
  'SELECT public.trigger_birthday_emails()'
);

-- Also schedule a second run at 12:00 PM as backup
SELECT cron.schedule(
  'birthday-emails-noon',
  '0 12 * * *',
  'SELECT public.trigger_birthday_emails()'
);