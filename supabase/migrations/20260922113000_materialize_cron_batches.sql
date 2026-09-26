-- materialize-darkpool-portfolios: שתי ריצות hot (offset 0 / 8) — פחות WORKER_RESOURCE_LIMIT

DROP FUNCTION IF EXISTS public.invoke_materialize_darkpool_portfolios(TEXT);

CREATE OR REPLACE FUNCTION public.invoke_materialize_darkpool_portfolios(
  p_mode TEXT DEFAULT 'hot',
  p_target_offset INT DEFAULT 0
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url        TEXT;
  v_key        TEXT;
  v_request_id BIGINT;
  v_mode       TEXT := COALESCE(NULLIF(trim(p_mode), ''), 'hot');
  v_offset     INT  := GREATEST(0, COALESCE(p_target_offset, 0));
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'materialize_darkpool_portfolios: missing vault secrets';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/materialize-darkpool-portfolios',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object(
      'mode', v_mode,
      'target_offset', v_offset
    ),
    timeout_milliseconds := 300000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_materialize_darkpool_portfolios(TEXT, INT) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.invoke_materialize_darkpool_portfolios(TEXT, INT) TO service_role;

COMMENT ON FUNCTION public.invoke_materialize_darkpool_portfolios(TEXT, INT) IS
  'Cron → materialize-darkpool-portfolios. hot uses target_offset batches (default cap in edge env).';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'materialize-darkpool-portfolios-hot') THEN
    PERFORM cron.unschedule('materialize-darkpool-portfolios-hot');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'materialize-darkpool-portfolios-hot-b') THEN
    PERFORM cron.unschedule('materialize-darkpool-portfolios-hot-b');
  END IF;
END $$;

-- batch A: פרופילים 0–7
SELECT cron.schedule(
  'materialize-darkpool-portfolios-hot',
  '15 14-21 * * 1-5',
  $$ SELECT public.invoke_materialize_darkpool_portfolios('hot', 0); $$
);

-- batch B: פרופילים 8–15 (30 דק אחרי — לא שתי Yahoo bursts במקביל)
SELECT cron.schedule(
  'materialize-darkpool-portfolios-hot-b',
  '45 14-21 * * 1-5',
  $$ SELECT public.invoke_materialize_darkpool_portfolios('hot', 8); $$
);

-- batch C: offset 16 (6 פרופילים נוספים — כיסוי כל המאוצרים בלי full Yahoo)
SELECT cron.schedule(
  'materialize-darkpool-portfolios-hot-c',
  '30 15,17,19,21 * * 1-5',
  $$ SELECT public.invoke_materialize_darkpool_portfolios('hot', 16); $$
);
