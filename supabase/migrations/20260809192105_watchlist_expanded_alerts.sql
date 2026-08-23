-- Expanded watchlist alerts: range highs/lows, entry return, target, earnings

ALTER TABLE public.stock_watchlist_items
  ADD COLUMN IF NOT EXISTS alert_day_high BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_week_high BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_week_low BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_52w_high BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_52w_low BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_entry_gain_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS alert_entry_loss_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS alert_target_hit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_earnings BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.stock_watchlist_items.alert_day_high IS 'התראה על שיא יומי חדש';
COMMENT ON COLUMN public.stock_watchlist_items.alert_week_high IS 'התראה על שיא שבועי';
COMMENT ON COLUMN public.stock_watchlist_items.alert_week_low IS 'התראה על שפל שבועי';
COMMENT ON COLUMN public.stock_watchlist_items.alert_52w_high IS 'התראה על שיא 52 שבועות';
COMMENT ON COLUMN public.stock_watchlist_items.alert_52w_low IS 'התראה על שפל 52 שבועות';
COMMENT ON COLUMN public.stock_watchlist_items.alert_entry_gain_pct IS 'התראה כש-vsEntryPct >= סף';
COMMENT ON COLUMN public.stock_watchlist_items.alert_entry_loss_pct IS 'התראה כש-vsEntryPct <= -סף';
COMMENT ON COLUMN public.stock_watchlist_items.alert_target_hit IS 'התראה כשמחיר מגיע ליעד';
COMMENT ON COLUMN public.stock_watchlist_items.alert_earnings IS 'התראה על דיווח רווח היום/מחר';

ALTER TABLE public.stock_watchlist_alert_events
  DROP CONSTRAINT IF EXISTS stock_watchlist_alert_events_alert_kind_check;

ALTER TABLE public.stock_watchlist_alert_events
  ADD CONSTRAINT stock_watchlist_alert_events_alert_kind_check
  CHECK (alert_kind IN (
    'above',
    'below',
    'change_pct',
    'day_high',
    'week_high',
    'week_low',
    'y52_high',
    'y52_low',
    'entry_gain',
    'entry_loss',
    'target_hit',
    'earnings'
  ));
