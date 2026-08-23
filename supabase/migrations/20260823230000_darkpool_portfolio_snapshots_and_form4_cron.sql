-- ============================================================================
-- dark_pool_person_portfolio_snapshots + market_daily_prices
-- Form4 cron: market-hours cadence (לא שעתי) — תקציב << 500 req/day
-- materialize-darkpool-portfolios: hourly hot + daily full
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- מחירי Yahoo יומיים — משותפים לכל materialize (טיקר אחד = fetch אחד)
-- series: { "YYYY-MM-DD": adjClose, ... }
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_daily_prices (
  ticker      TEXT PRIMARY KEY,
  series      JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_range TEXT NOT NULL DEFAULT '5y',
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.market_daily_prices IS
  'מחירי Yahoo יומיים (adj close) — cache משותף ל-materialize של פרופילי Dark Pool';

CREATE INDEX IF NOT EXISTS idx_market_daily_prices_fetched
  ON public.market_daily_prices (fetched_at DESC);

ALTER TABLE public.market_daily_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mdp_service_all ON public.market_daily_prices;
-- service_role עוקף RLS; אין גישה ל-anon/authenticated (Edge בלבד)
REVOKE ALL ON public.market_daily_prices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.market_daily_prices TO service_role;

-- ----------------------------------------------------------------------------
-- Snapshots ממומשים — profile open = קריאה מטבלה זו
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dark_pool_person_portfolio_snapshots (
  person_id         TEXT NOT NULL,
  kind              TEXT NOT NULL
    CHECK (kind IN ('politician', 'insider', 'fund_manager')),
  series            JSONB NOT NULL DEFAULT '[]'::jsonb,
  holdings          JSONB NOT NULL DEFAULT '[]'::jsonb,
  period_returns    JSONB NOT NULL DEFAULT '{}'::jsonb,
  portfolio_value   NUMERIC,
  total_return_pct  NUMERIC,
  metrics           JSONB,
  profile_meta      JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (person_id, kind)
);

COMMENT ON TABLE public.dark_pool_person_portfolio_snapshots IS
  'גרף + אחזקות + תשואות ממומשים (Yahoo batch ב-cron). פתיחת פרופיל קוראת מכאן בלבד.';

CREATE INDEX IF NOT EXISTS idx_dp_pps_computed
  ON public.dark_pool_person_portfolio_snapshots (computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dp_pps_kind_computed
  ON public.dark_pool_person_portfolio_snapshots (kind, computed_at DESC);

ALTER TABLE public.dark_pool_person_portfolio_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.dark_pool_person_portfolio_snapshots FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.dark_pool_person_portfolio_snapshots TO service_role;

-- ----------------------------------------------------------------------------
-- Form4 sync: כל 4 שעות בשעות מסחר US (UTC) + פעם בסופ״ש
-- lookback/pages מוגדרים ב-secrets (ברירת מחדל בקוד: 48h / 5 pages)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-insider-buys-hourly') THEN
    PERFORM cron.unschedule('sync-insider-buys-hourly');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-insider-buys-market-hours') THEN
    PERFORM cron.unschedule('sync-insider-buys-market-hours');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-insider-buys-weekend') THEN
    PERFORM cron.unschedule('sync-insider-buys-weekend');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-insider-buys-market-hours',
  '0 13,17,21 * * 1-5',
  $$ SELECT public.invoke_sync_insider_buys(); $$
);

SELECT cron.schedule(
  'sync-insider-buys-weekend',
  '0 16 * * 0,6',
  $$ SELECT public.invoke_sync_insider_buys(); $$
);

COMMENT ON FUNCTION public.invoke_sync_insider_buys IS
  'Cron → sync-insider-buys. Schedule: 13/17/21 UTC weekdays + 16 UTC weekends. Env: FORM4_LOOKBACK_HOURS=48, FORM4_MAX_PAGES=5.';

-- ----------------------------------------------------------------------------
-- materialize-darkpool-portfolios
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoke_materialize_darkpool_portfolios(p_mode TEXT DEFAULT 'hot')
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
    body    := jsonb_build_object('mode', v_mode),
    timeout_milliseconds := 300000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_materialize_darkpool_portfolios(TEXT) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.invoke_materialize_darkpool_portfolios(TEXT) TO service_role;

COMMENT ON FUNCTION public.invoke_materialize_darkpool_portfolios(TEXT) IS
  'Cron → materialize-darkpool-portfolios. mode=hot|full.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'materialize-darkpool-portfolios-hot') THEN
    PERFORM cron.unschedule('materialize-darkpool-portfolios-hot');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'materialize-darkpool-portfolios-daily') THEN
    PERFORM cron.unschedule('materialize-darkpool-portfolios-daily');
  END IF;
END $$;

-- שעות מסחר US בקירוב (14–21 UTC) — hot set כל שעה
SELECT cron.schedule(
  'materialize-darkpool-portfolios-hot',
  '15 14-21 * * 1-5',
  $$ SELECT public.invoke_materialize_darkpool_portfolios('hot'); $$
);

-- rebuild מלא לרשימה מאוצרת — פעם ביום
SELECT cron.schedule(
  'materialize-darkpool-portfolios-daily',
  '30 2 * * *',
  $$ SELECT public.invoke_materialize_darkpool_portfolios('full'); $$
);
