-- ============================================================================
-- 042_uw_db_cache.sql
-- עסקאות קונגרס + snapshots (גילוי / metrics) — קריאה מהירה מהאפליקציה.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dark_pool_congress_trades (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id          TEXT NOT NULL,
  politician_id        TEXT NOT NULL,
  politician_name      TEXT NOT NULL,
  politician_image_url TEXT,
  ticker               TEXT NOT NULL,
  company_name         TEXT,
  transaction_type     TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  shares               NUMERIC(20, 4),
  price                NUMERIC(20, 6),
  amount_label         TEXT,
  filed_at             TIMESTAMPTZ NOT NULL,
  transaction_date     DATE NOT NULL,
  txn_label            TEXT,
  source               TEXT NOT NULL DEFAULT 'unusualwhales',
  synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dpct_external_id
  ON public.dark_pool_congress_trades (external_id);

CREATE INDEX IF NOT EXISTS idx_dpct_filed_at
  ON public.dark_pool_congress_trades (filed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dpct_politician
  ON public.dark_pool_congress_trades (politician_id, filed_at DESC);

COMMENT ON TABLE public.dark_pool_congress_trades IS
  'עסקאות STIR/קונגרס מ-UW — מסונכרן ע"י sync-congress-trades (cron).';

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dark_pool_uw_snapshots (
  cache_key   TEXT PRIMARY KEY,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.dark_pool_uw_snapshots IS
  'Cache JSON: explore, politician_metrics:{id}, וכו''';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.dark_pool_congress_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dark_pool_uw_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dpct_public_select ON public.dark_pool_congress_trades;
CREATE POLICY dpct_public_select ON public.dark_pool_congress_trades
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS dpct_service_all ON public.dark_pool_congress_trades;
CREATE POLICY dpct_service_all ON public.dark_pool_congress_trades
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS duws_public_select ON public.dark_pool_uw_snapshots;
CREATE POLICY duws_public_select ON public.dark_pool_uw_snapshots
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS duws_service_all ON public.dark_pool_uw_snapshots;
CREATE POLICY duws_service_all ON public.dark_pool_uw_snapshots
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT ON public.dark_pool_congress_trades TO anon, authenticated;
GRANT SELECT ON public.dark_pool_uw_snapshots TO anon, authenticated;
