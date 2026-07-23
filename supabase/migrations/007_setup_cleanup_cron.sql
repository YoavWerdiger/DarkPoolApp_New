-- Enable pg_cron extension (must be enabled in Supabase dashboard first)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Clean up expired rate limits every 10 minutes
SELECT cron.schedule(
  'cleanup-rate-limits',
  '*/10 * * * *',
  $$DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 hour'$$
);

-- Clean up stale typing indicators every 30 seconds
SELECT cron.schedule(
  'cleanup-typing-indicators',
  '*/1 * * * *',
  $$DELETE FROM public.chat_typing_indicators WHERE started_typing_at < now() - interval '15 seconds'$$
);

-- Archive old deleted messages monthly (keep 90 days)
SELECT cron.schedule(
  'archive-old-messages',
  '0 3 1 * *',
  $$SELECT archive_old_messages()$$
);

-- RLS policy on chat_messages_archive
ALTER TABLE IF EXISTS public.chat_messages_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on archive" ON public.chat_messages_archive
  FOR ALL TO service_role USING (true) WITH CHECK (true);
