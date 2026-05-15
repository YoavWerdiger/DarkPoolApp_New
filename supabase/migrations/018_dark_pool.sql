-- ============================================================================
-- 018_dark_pool.sql
-- Dark Pool Intelligence – ליבת המודול
--
-- טבלאות:
--   1. dark_pool_trades             – הדפסות בודדות (prints) ממאגר ה-Dark Pool
--   2. dark_pool_signals            – סיגנלים שהמנוע ייצר (Unusual / Sweep / Whale / Confluence)
--   3. dark_pool_watchlists         – טיקרים שמשתמש עוקב אחריהם לצורך התראות
--   4. dark_pool_daily_aggregates   – אגרגציות יומיות לכל טיקר (לחישוב Relative Volume)
--   5. dark_pool_insider_buys       – Mirror של Form4 / רכישות בכירים (לחיתוך עם דארק-פול)
--   6. dark_pool_provider_state     – cursor של ספק הנתונים (Polygon/UW/Intrinio) לסנכרון 30s
--   7. dark_pool_alerts_log         – לוג התראות שנשלחו (Idempotency + Audit)
--
-- כל הטבלאות מוגנות RLS:
--   - dark_pool_trades / signals / aggregates / insider_buys → SELECT ל-authenticated, INSERT/UPDATE ל-service_role
--   - dark_pool_watchlists / alerts_log → owner-only
--
-- הפיצ'ר תומך ב-Premium Lock ברמת השאילתה (delayed_at) — clients חינמיים יראו רק
-- שורות עם detected_at < now() - 15 minutes (ה-Premium gating נעשה בלקוח/Edge).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. dark_pool_trades  (raw prints)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dark_pool_trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     TEXT,                                          -- מזהה ייחודי מהספק (לדה־דופ)
  ticker          TEXT NOT NULL,
  company_name    TEXT,
  ts              TIMESTAMPTZ NOT NULL,                          -- timestamp של ה-print
  price           NUMERIC(20,6) NOT NULL CHECK (price >= 0),
  size            BIGINT NOT NULL CHECK (size > 0),              -- כמות מניות
  premium         NUMERIC(20,2) NOT NULL CHECK (premium >= 0),   -- price * size
  volume          BIGINT,                                        -- volume מצטבר יומי (אופציונלי)
  side            TEXT NOT NULL DEFAULT 'unknown'
                  CHECK (side IN ('buy','sell','unknown')),
  exchange        TEXT,
  market_cap      NUMERIC(20,2),
  provider        TEXT NOT NULL DEFAULT 'polygon',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ייחודיות מול הספק (external_id+provider). אין external_id → ניפול על (ticker,ts,size,price).
CREATE UNIQUE INDEX IF NOT EXISTS uq_dpt_external
  ON public.dark_pool_trades(provider, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dpt_natural
  ON public.dark_pool_trades(provider, ticker, ts, size, price)
  WHERE external_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_dpt_ticker_ts        ON public.dark_pool_trades(ticker, ts DESC);
CREATE INDEX IF NOT EXISTS idx_dpt_ts               ON public.dark_pool_trades(ts DESC);
CREATE INDEX IF NOT EXISTS idx_dpt_premium          ON public.dark_pool_trades(premium DESC);

COMMENT ON TABLE  public.dark_pool_trades IS 'Dark pool prints – נורמליזציה של דאטה מספקים שונים';
COMMENT ON COLUMN public.dark_pool_trades.premium  IS 'שווי הדפסה ב-$ (price * size)';
COMMENT ON COLUMN public.dark_pool_trades.side     IS 'buy/sell/unknown — מוסק מקרבת ה-bid/ask';

-- ----------------------------------------------------------------------------
-- 2. dark_pool_signals
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dark_pool_signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker        TEXT NOT NULL,
  signal_type   TEXT NOT NULL
                CHECK (signal_type IN (
                  'UNUSUAL_VOLUME',
                  'SWEEP',
                  'WHALE',
                  'HIDDEN_ACCUMULATION',
                  'INSIDER_DARKPOOL_CONFLUENCE'
                )),
  score         NUMERIC(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  reason        TEXT,                                         -- תיאור קצר
  ai_summary    TEXT,                                         -- AI insight (אופציונלי)
  metrics       JSONB NOT NULL DEFAULT '{}'::jsonb,           -- premium_total, prints, side_ratio וכו'
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,                                  -- TTL לתצוגה ב-feed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ייחודיות פר טיקר+סוג+חלון זמן (קוואנט של 5 דק') — מחושב ע"י trigger
  bucket_5m     TIMESTAMPTZ
);

-- Trigger to compute 5-minute bucket (avoids immutability issue with GENERATED columns)
CREATE OR REPLACE FUNCTION public.set_dark_pool_signal_bucket()
RETURNS TRIGGER AS $$
BEGIN
  NEW.bucket_5m := to_timestamp(floor(extract(epoch from NEW.detected_at) / 300) * 300);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DROP TRIGGER IF EXISTS trg_dps_bucket ON public.dark_pool_signals;
CREATE TRIGGER trg_dps_bucket
  BEFORE INSERT OR UPDATE OF detected_at ON public.dark_pool_signals
  FOR EACH ROW EXECUTE FUNCTION public.set_dark_pool_signal_bucket();

CREATE UNIQUE INDEX IF NOT EXISTS uq_dps_ticker_type_bucket
  ON public.dark_pool_signals(ticker, signal_type, bucket_5m);

CREATE INDEX IF NOT EXISTS idx_dps_detected_at ON public.dark_pool_signals(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_dps_ticker_detected_at
  ON public.dark_pool_signals(ticker, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_dps_score ON public.dark_pool_signals(score DESC);
CREATE INDEX IF NOT EXISTS idx_dps_type  ON public.dark_pool_signals(signal_type);

COMMENT ON TABLE public.dark_pool_signals IS 'סיגנלים שמיוצרים על-ידי מנוע ה-Dark Pool';

-- ----------------------------------------------------------------------------
-- 3. dark_pool_watchlists
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dark_pool_watchlists (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker      TEXT NOT NULL,
  alerts_on   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_dpw_ticker
  ON public.dark_pool_watchlists(ticker) WHERE alerts_on = TRUE;

COMMENT ON TABLE public.dark_pool_watchlists IS 'מניות שמשתמש עוקב אחריהן לקבלת התראות';

-- ----------------------------------------------------------------------------
-- 4. dark_pool_daily_aggregates
--   ל-Relative Volume / Unusual Volume detection.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dark_pool_daily_aggregates (
  ticker            TEXT NOT NULL,
  date              DATE NOT NULL,
  prints            INT NOT NULL DEFAULT 0,
  total_volume      BIGINT NOT NULL DEFAULT 0,                 -- סך שורט-וולום ב-DP
  total_premium     NUMERIC(20,2) NOT NULL DEFAULT 0,
  buy_premium       NUMERIC(20,2) NOT NULL DEFAULT 0,
  sell_premium      NUMERIC(20,2) NOT NULL DEFAULT 0,
  whale_count       INT NOT NULL DEFAULT 0,                    -- >$1M prints
  avg30_premium     NUMERIC(20,2),                             -- ממוצע 30 ימים אחורה
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_dpda_date ON public.dark_pool_daily_aggregates(date DESC);
CREATE INDEX IF NOT EXISTS idx_dpda_ticker_date
  ON public.dark_pool_daily_aggregates(ticker, date DESC);

COMMENT ON TABLE public.dark_pool_daily_aggregates IS 'אגרגציה יומית — בסיס לחישוב Relative Volume / Accumulation';

-- ----------------------------------------------------------------------------
-- 5. dark_pool_insider_buys
--   רכישות בכירים (Form4 / SEC) – לחיתוך עם דארק-פול ל-CONFLUENCE.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dark_pool_insider_buys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id       TEXT,                                        -- accession + line מ-SEC
  ticker            TEXT NOT NULL,
  insider_name      TEXT,
  insider_role      TEXT,
  transaction_type  TEXT NOT NULL DEFAULT 'P'
                    CHECK (transaction_type IN ('P','S','A','M','G','F','O','D')),
  shares            NUMERIC(20,4) NOT NULL,
  price             NUMERIC(20,6) NOT NULL CHECK (price >= 0),
  value             NUMERIC(20,2) NOT NULL CHECK (value >= 0),
  filed_at          TIMESTAMPTZ NOT NULL,
  transaction_date  DATE NOT NULL,
  source            TEXT NOT NULL DEFAULT 'form4',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dpi_external
  ON public.dark_pool_insider_buys(source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dpi_ticker_date
  ON public.dark_pool_insider_buys(ticker, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_dpi_recent_buys
  ON public.dark_pool_insider_buys(ticker, transaction_date DESC)
  WHERE transaction_type = 'P';

COMMENT ON TABLE public.dark_pool_insider_buys IS 'רכישות בכירים (Form 4 P-type) – לחיתוך עם Dark Pool';

-- ----------------------------------------------------------------------------
-- 6. dark_pool_provider_state
--   שומר את ה-cursor האחרון פר ספק לסנכרון Edge Function.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dark_pool_provider_state (
  provider     TEXT PRIMARY KEY,
  last_ts      TIMESTAMPTZ,
  last_cursor  TEXT,
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.dark_pool_provider_state IS 'state של סנכרון פר ספק (timestamp/cursor)';

-- ----------------------------------------------------------------------------
-- 7. dark_pool_alerts_log
--   Audit + Idempotency של התראות Push שנשלחו.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dark_pool_alerts_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_id   UUID NOT NULL REFERENCES public.dark_pool_signals(id) ON DELETE CASCADE,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, signal_id)
);

CREATE INDEX IF NOT EXISTS idx_dpal_user_sent
  ON public.dark_pool_alerts_log(user_id, sent_at DESC);

COMMENT ON TABLE public.dark_pool_alerts_log IS 'לוג התראות Dark Pool שנשלחו — מונע כפילויות';

-- ============================================================================
-- updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at_dark_pool()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dpda_updated_at ON public.dark_pool_daily_aggregates;
CREATE TRIGGER trg_dpda_updated_at
  BEFORE UPDATE ON public.dark_pool_daily_aggregates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_dark_pool();

DROP TRIGGER IF EXISTS trg_dpps_updated_at ON public.dark_pool_provider_state;
CREATE TRIGGER trg_dpps_updated_at
  BEFORE UPDATE ON public.dark_pool_provider_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_dark_pool();

-- ============================================================================
-- VIEW: v_dark_pool_top_accumulation (3D)
--   חישוב buy-flow מינוס sell-flow ב-3 ימים אחרונים — בסיס ל-Top Accumulation.
-- ============================================================================
CREATE OR REPLACE VIEW public.v_dark_pool_top_accumulation_3d AS
WITH agg AS (
  SELECT
    ticker,
    SUM(buy_premium)         AS buy_3d,
    SUM(sell_premium)        AS sell_3d,
    SUM(total_premium)       AS total_3d,
    SUM(total_volume)        AS volume_3d,
    SUM(whale_count)         AS whales_3d,
    MAX(date)                AS last_date
  FROM public.dark_pool_daily_aggregates
  WHERE date >= (CURRENT_DATE - INTERVAL '3 days')::date
  GROUP BY ticker
)
SELECT
  ticker,
  buy_3d,
  sell_3d,
  total_3d,
  volume_3d,
  whales_3d,
  (buy_3d - sell_3d)                                          AS net_flow_3d,
  CASE
    WHEN total_3d > 0 THEN (buy_3d - sell_3d) / total_3d
    ELSE 0
  END                                                          AS net_flow_ratio,
  last_date
FROM agg
ORDER BY (buy_3d - sell_3d) DESC NULLS LAST;

COMMENT ON VIEW public.v_dark_pool_top_accumulation_3d IS 'Top accumulation 3-day rolling — buy minus sell premium';

-- ============================================================================
-- VIEW: v_dark_pool_recent_whales
--   הדפסות ענק מהשעה האחרונה (>$1M)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_dark_pool_recent_whales AS
SELECT *
FROM public.dark_pool_trades
WHERE premium >= 1000000
  AND ts >= NOW() - INTERVAL '24 hours'
ORDER BY premium DESC, ts DESC;

COMMENT ON VIEW public.v_dark_pool_recent_whales IS 'Whale orders – הדפסות מעל $1M ב-24 שעות אחרונות';

-- ============================================================================
-- RLS – Row Level Security
-- ============================================================================
ALTER TABLE public.dark_pool_trades             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dark_pool_signals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dark_pool_watchlists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dark_pool_daily_aggregates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dark_pool_insider_buys       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dark_pool_provider_state     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dark_pool_alerts_log         ENABLE ROW LEVEL SECURITY;

-- dark_pool_trades / signals / aggregates / insider_buys: כל משתמש מאומת קורא, רק service_role כותב
-- (הסינון delayed-by-15min ל-free users נעשה בקוד הלקוח; ה-DB מאפשר read מלא).
DROP POLICY IF EXISTS dpt_authenticated_select ON public.dark_pool_trades;
CREATE POLICY dpt_authenticated_select ON public.dark_pool_trades
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS dps_authenticated_select ON public.dark_pool_signals;
CREATE POLICY dps_authenticated_select ON public.dark_pool_signals
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS dpda_authenticated_select ON public.dark_pool_daily_aggregates;
CREATE POLICY dpda_authenticated_select ON public.dark_pool_daily_aggregates
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS dpi_authenticated_select ON public.dark_pool_insider_buys;
CREATE POLICY dpi_authenticated_select ON public.dark_pool_insider_buys
  FOR SELECT TO authenticated USING (TRUE);

-- provider_state: רק service_role
DROP POLICY IF EXISTS dpps_service_only ON public.dark_pool_provider_state;
CREATE POLICY dpps_service_only ON public.dark_pool_provider_state
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- watchlists: owner only
DROP POLICY IF EXISTS dpw_owner_select ON public.dark_pool_watchlists;
CREATE POLICY dpw_owner_select ON public.dark_pool_watchlists
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS dpw_owner_insert ON public.dark_pool_watchlists;
CREATE POLICY dpw_owner_insert ON public.dark_pool_watchlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dpw_owner_update ON public.dark_pool_watchlists;
CREATE POLICY dpw_owner_update ON public.dark_pool_watchlists
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dpw_owner_delete ON public.dark_pool_watchlists;
CREATE POLICY dpw_owner_delete ON public.dark_pool_watchlists
  FOR DELETE USING (auth.uid() = user_id);

-- alerts_log: owner read-only (write נעשה רק ע"י service role).
DROP POLICY IF EXISTS dpal_owner_select ON public.dark_pool_alerts_log;
CREATE POLICY dpal_owner_select ON public.dark_pool_alerts_log
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- GRANTs
-- ============================================================================
GRANT SELECT ON public.v_dark_pool_top_accumulation_3d TO authenticated;
GRANT SELECT ON public.v_dark_pool_recent_whales       TO authenticated;
