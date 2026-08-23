-- Multi-threshold watchlist alerts (arrays) + migrate legacy single columns

ALTER TABLE public.stock_watchlist_items
  ADD COLUMN IF NOT EXISTS alert_above_prices NUMERIC[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alert_below_prices NUMERIC[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alert_change_pcts NUMERIC[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alert_entry_gain_pcts NUMERIC[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alert_entry_loss_pcts NUMERIC[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.stock_watchlist_items.alert_above_prices IS 'ספי מחיר עליון — אפשר כמה';
COMMENT ON COLUMN public.stock_watchlist_items.alert_below_prices IS 'ספי מחיר תחתון — אפשר כמה';
COMMENT ON COLUMN public.stock_watchlist_items.alert_change_pcts IS 'ספי |שינוי יומי %| — אפשר כמה';
COMMENT ON COLUMN public.stock_watchlist_items.alert_entry_gain_pcts IS 'ספי רווח % מהכניסה — אפשר כמה';
COMMENT ON COLUMN public.stock_watchlist_items.alert_entry_loss_pcts IS 'ספי הפסד % מהכניסה — אפשר כמה';

UPDATE public.stock_watchlist_items
SET
  alert_above_prices = CASE
    WHEN alert_above IS NOT NULL AND cardinality(alert_above_prices) = 0
      THEN ARRAY[alert_above]
    ELSE alert_above_prices
  END,
  alert_below_prices = CASE
    WHEN alert_below IS NOT NULL AND cardinality(alert_below_prices) = 0
      THEN ARRAY[alert_below]
    ELSE alert_below_prices
  END,
  alert_change_pcts = CASE
    WHEN alert_change_pct IS NOT NULL AND cardinality(alert_change_pcts) = 0
      THEN ARRAY[alert_change_pct]
    ELSE alert_change_pcts
  END,
  alert_entry_gain_pcts = CASE
    WHEN alert_entry_gain_pct IS NOT NULL AND cardinality(alert_entry_gain_pcts) = 0
      THEN ARRAY[alert_entry_gain_pct]
    ELSE alert_entry_gain_pcts
  END,
  alert_entry_loss_pcts = CASE
    WHEN alert_entry_loss_pct IS NOT NULL AND cardinality(alert_entry_loss_pcts) = 0
      THEN ARRAY[alert_entry_loss_pct]
    ELSE alert_entry_loss_pcts
  END;
