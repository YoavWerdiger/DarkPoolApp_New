-- Form4API — שדות נוספים לעסקאות + cluster signals

ALTER TABLE public.dark_pool_insider_buys
  ADD COLUMN IF NOT EXISTS is_10b5_plan BOOLEAN,
  ADD COLUMN IF NOT EXISTS shares_owned_after NUMERIC,
  ADD COLUMN IF NOT EXISTS return_1d NUMERIC,
  ADD COLUMN IF NOT EXISTS return_1w NUMERIC,
  ADD COLUMN IF NOT EXISTS return_1m NUMERIC,
  ADD COLUMN IF NOT EXISTS return_3m NUMERIC,
  ADD COLUMN IF NOT EXISTS return_6m NUMERIC;

COMMENT ON COLUMN public.dark_pool_insider_buys.is_10b5_plan IS 'Rule 10b5-1 pre-scheduled plan (Form4API)';
COMMENT ON COLUMN public.dark_pool_insider_buys.return_3m IS 'Post-filing return horizon from Form4API (decimal, e.g. 0.05 = 5%)';

CREATE TABLE IF NOT EXISTS public.dark_pool_insider_signals (
  ticker           TEXT NOT NULL,
  signal_date      DATE NOT NULL,
  company_name     TEXT,
  is_cluster_buy   BOOLEAN NOT NULL DEFAULT FALSE,
  is_cluster_sell  BOOLEAN NOT NULL DEFAULT FALSE,
  insider_count    INT,
  buy_sell_ratio   NUMERIC,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ticker, signal_date)
);

CREATE INDEX IF NOT EXISTS idx_dpis_cluster_buy
  ON public.dark_pool_insider_signals (signal_date DESC)
  WHERE is_cluster_buy = TRUE;

ALTER TABLE public.dark_pool_insider_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dpis_public_select ON public.dark_pool_insider_signals;
CREATE POLICY dpis_public_select ON public.dark_pool_insider_signals FOR SELECT USING (TRUE);

GRANT SELECT ON public.dark_pool_insider_signals TO anon, authenticated;
