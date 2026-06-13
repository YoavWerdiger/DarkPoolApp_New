ALTER TABLE public.dark_pool_insider_buys
  ADD COLUMN IF NOT EXISTS insider_cik TEXT,
  ADD COLUMN IF NOT EXISTS insider_logo_url TEXT;

COMMENT ON COLUMN public.dark_pool_insider_buys.insider_cik IS 'SEC CIK — Form4API / התאמה ל-Unusual Whales';
COMMENT ON COLUMN public.dark_pool_insider_buys.insider_logo_url IS 'תמונת פרופיל מ-UW: GET /api/insider/{ticker}';

CREATE INDEX IF NOT EXISTS idx_dpi_logo_missing
  ON public.dark_pool_insider_buys(ticker)
  WHERE insider_logo_url IS NULL;
