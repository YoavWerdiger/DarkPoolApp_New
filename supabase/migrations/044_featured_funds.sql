-- מומלצים + מנהלי קרנות (13F) + הרחבת kind במעקב

-- ---------------------------------------------------------------------------
-- Featured profiles (curated — גילוי «מומלצים»)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dark_pool_featured_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order    INT NOT NULL DEFAULT 0,
  name          TEXT NOT NULL,
  subtitle      TEXT,
  image_url     TEXT,
  person_id     TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('politician', 'insider', 'fund_manager')),
  ticker        TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpfp_sort
  ON public.dark_pool_featured_profiles (sort_order ASC)
  WHERE is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dpfp_person_kind
  ON public.dark_pool_featured_profiles (person_id, kind);

COMMENT ON TABLE public.dark_pool_featured_profiles IS
  'פרופילים מומלצים לגילוי — קישור לפרופיל קיים (politician / insider / fund_manager).';

ALTER TABLE public.dark_pool_featured_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dpfp_public_select ON public.dark_pool_featured_profiles;
CREATE POLICY dpfp_public_select ON public.dark_pool_featured_profiles
  FOR SELECT USING (is_active = TRUE);

GRANT SELECT ON public.dark_pool_featured_profiles TO anon, authenticated;

INSERT INTO public.dark_pool_featured_profiles
  (sort_order, name, subtitle, image_url, person_id, kind, ticker)
VALUES
  (1, 'Elon Musk', 'CEO · Tesla', NULL, 'TSLA:Musk', 'insider', 'TSLA'),
  (2, 'Tim Cook', 'CEO · Apple', NULL, 'AAPL:Cook', 'insider', 'AAPL'),
  (3, 'Nancy Pelosi', 'House · דמוקרטית', 'https://unitedstates.github.io/images/congress/225x275/P000197.jpg', 'P000197', 'politician', NULL),
  (4, 'Warren Buffett', 'Berkshire Hathaway · 13F', NULL, '1067983', 'fund_manager', NULL),
  (5, 'Cathie Wood', 'ARK Invest · 13F', NULL, '1697748', 'fund_manager', NULL),
  (6, 'Bill Ackman', 'Pershing Square · 13F', NULL, '1336528', 'fund_manager', NULL)
ON CONFLICT (person_id, kind) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Fund managers (13F)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dark_pool_fund_managers (
  cik              TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  manager_name     TEXT,
  image_url        TEXT,
  last_filing_date DATE,
  last_value_usd   NUMERIC,
  holdings_count   INT NOT NULL DEFAULT 0,
  synced_at        TIMESTAMPTZ,
  source           TEXT NOT NULL DEFAULT 'secapi'
);

COMMENT ON TABLE public.dark_pool_fund_managers IS
  'מנהלי השקעות מוסדיים — מסונכרן מ-Form 13F (sec-api).';

CREATE TABLE IF NOT EXISTS public.dark_pool_fund_holdings (
  id               BIGSERIAL PRIMARY KEY,
  fund_cik         TEXT NOT NULL REFERENCES public.dark_pool_fund_managers(cik) ON DELETE CASCADE,
  filing_date      DATE NOT NULL,
  ticker           TEXT NOT NULL,
  issuer_name      TEXT,
  cusip            TEXT,
  shares           NUMERIC,
  value_usd        NUMERIC,
  allocation_pct   NUMERIC,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fund_cik, filing_date, ticker)
);

CREATE INDEX IF NOT EXISTS idx_dpfh_fund_date
  ON public.dark_pool_fund_holdings (fund_cik, filing_date DESC);

CREATE INDEX IF NOT EXISTS idx_dpfh_ticker
  ON public.dark_pool_fund_holdings (ticker);

ALTER TABLE public.dark_pool_fund_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dark_pool_fund_holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dpfm_public_select ON public.dark_pool_fund_managers;
CREATE POLICY dpfm_public_select ON public.dark_pool_fund_managers FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS dpfh_public_select ON public.dark_pool_fund_holdings;
CREATE POLICY dpfh_public_select ON public.dark_pool_fund_holdings FOR SELECT USING (TRUE);

GRANT SELECT ON public.dark_pool_fund_managers TO anon, authenticated;
GRANT SELECT ON public.dark_pool_fund_holdings TO anon, authenticated;

INSERT INTO public.dark_pool_fund_managers (cik, name, manager_name)
VALUES
  ('1067983', 'Berkshire Hathaway Inc', 'Warren Buffett'),
  ('1697748', 'ARK Investment Management LLC', 'Cathie Wood'),
  ('1336528', 'Pershing Square Capital Management LP', 'Bill Ackman')
ON CONFLICT (cik) DO NOTHING;

-- ---------------------------------------------------------------------------
-- הרחבת kind במעקב
-- ---------------------------------------------------------------------------
ALTER TABLE public.dark_pool_followed_investors
  DROP CONSTRAINT IF EXISTS dark_pool_followed_investors_kind_check;

ALTER TABLE public.dark_pool_followed_investors
  ADD CONSTRAINT dark_pool_followed_investors_kind_check
  CHECK (kind IN ('politician', 'insider', 'fund_manager'));
