-- ---------------------------------------------------------------------------
-- שימור שדות התשואה של Quiver על עסקאות קונגרס.
--
-- ExcessReturn / PriceChange / SPYChange כבר חוזרים בכל קריאה שאנחנו עושים
-- ל-/beta/live/congresstrading, /beta/historical/congresstrading/{ticker}
-- ו-/beta/bulk/trumpstocktrades — ונזרקו עד היום.
-- אפס קריאות API נוספות, אפס שינוי cron.
--
-- הערכים הם אחוזים (24.11 = +24.11%), מחושבים ע"י Quiver מיום העסקה.
-- NULL = אין נתון. אין להציג 0 במקום NULL.
-- ---------------------------------------------------------------------------

ALTER TABLE public.dark_pool_congress_trades
  ADD COLUMN IF NOT EXISTS excess_return_pct NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS price_change_pct  NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS spy_change_pct    NUMERIC(12, 4);

COMMENT ON COLUMN public.dark_pool_congress_trades.excess_return_pct IS
  'Quiver ExcessReturn — תשואת המניה מול S&P 500 מיום העסקה, באחוזים. NULL = לא זמין.';

COMMENT ON COLUMN public.dark_pool_congress_trades.price_change_pct IS
  'Quiver PriceChange — שינוי מחיר המניה מיום העסקה, באחוזים. NULL = לא זמין.';

COMMENT ON COLUMN public.dark_pool_congress_trades.spy_change_pct IS
  'Quiver SPYChange — שינוי S&P 500 מיום העסקה, באחוזים. NULL = לא זמין.';

-- שליפת "פעילות אחרונה של אותו אדם באותו טיקר" במסך פרטי העסקה.
CREATE INDEX IF NOT EXISTS idx_dpct_politician_ticker
  ON public.dark_pool_congress_trades (politician_id, ticker, transaction_date DESC);
