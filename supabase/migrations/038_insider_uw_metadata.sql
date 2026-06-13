-- מטא-דאטה מ-Unusual Whales לעסקאות בכירים (סקטור, S&P500, שווי שוק, רווחים)

ALTER TABLE public.dark_pool_insider_buys
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS is_sp500 BOOLEAN,
  ADD COLUMN IF NOT EXISTS marketcap NUMERIC,
  ADD COLUMN IF NOT EXISTS next_earnings_date DATE;

COMMENT ON COLUMN public.dark_pool_insider_buys.sector IS 'סקטור מ-UW insider/transactions';
COMMENT ON COLUMN public.dark_pool_insider_buys.is_sp500 IS 'האם הטיקר ב-S&P 500 לפי UW';
COMMENT ON COLUMN public.dark_pool_insider_buys.marketcap IS 'שווי שוק מ-UW';
COMMENT ON COLUMN public.dark_pool_insider_buys.next_earnings_date IS 'תאריך דיווח רווחים הבא מ-UW';

CREATE INDEX IF NOT EXISTS idx_dpi_uw_sp500
  ON public.dark_pool_insider_buys (filed_at DESC)
  WHERE source = 'unusualwhales' AND transaction_type = 'P';
