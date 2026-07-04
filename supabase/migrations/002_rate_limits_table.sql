-- Rate limiting table for server-side enforcement
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  UNIQUE(user_id, action, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_rate_limits_user_action ON public.rate_limits(user_id, action, window_start DESC);

-- Auto-cleanup old rate limit entries (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$;
