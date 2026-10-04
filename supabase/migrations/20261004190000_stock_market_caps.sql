-- שווי שוק לסימבולים אמריקאים — לסינון דיווחי רווחים (>= 1B)
CREATE TABLE IF NOT EXISTS public.stock_market_caps (
  symbol      TEXT PRIMARY KEY,
  market_cap  NUMERIC(24,2) NOT NULL,
  name        TEXT,
  sector      TEXT,
  country     TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_market_caps_cap_idx ON public.stock_market_caps (market_cap);

ALTER TABLE public.stock_market_caps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read market caps" ON public.stock_market_caps;
CREATE POLICY "Authenticated can read market caps"
  ON public.stock_market_caps FOR SELECT
  TO authenticated
  USING (true);

-- cron: רענון יומי לפני סנכרון הדיווחים של הבוקר (03:00 UTC)
CREATE OR REPLACE FUNCTION public.invoke_refresh_market_caps()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $$
DECLARE
  v_url        TEXT;
  v_key        TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'refresh_market_caps: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in vault';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := v_url || '/functions/v1/refresh-market-caps',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_refresh_market_caps() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('refresh-market-caps')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-market-caps');
SELECT cron.schedule('refresh-market-caps', '30 2 * * *', $$ SELECT public.invoke_refresh_market_caps(); $$);
