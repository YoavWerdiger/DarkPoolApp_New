-- Watchlist enrichment: reference/target prices + client-checkable alerts
ALTER TABLE public.stock_watchlist_items
  ADD COLUMN IF NOT EXISTS entry_price NUMERIC,
  ADD COLUMN IF NOT EXISTS target_price NUMERIC,
  ADD COLUMN IF NOT EXISTS alert_above NUMERIC,
  ADD COLUMN IF NOT EXISTS alert_below NUMERIC,
  ADD COLUMN IF NOT EXISTS alert_change_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.stock_watchlist_items.entry_price IS 'מחיר ייחוס אישי (כניסה / מאז הוספה)';
COMMENT ON COLUMN public.stock_watchlist_items.target_price IS 'יעד מחיר אישי';
COMMENT ON COLUMN public.stock_watchlist_items.alert_above IS 'התראה כשהמחיר עובר מעל';
COMMENT ON COLUMN public.stock_watchlist_items.alert_below IS 'התראה כשהמחיר יורד מתחת';
COMMENT ON COLUMN public.stock_watchlist_items.alert_change_pct IS 'התראה על שינוי יומי מוחלט באחוזים';

CREATE TABLE IF NOT EXISTS public.stock_watchlist_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.stock_watchlist_items(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  alert_kind TEXT NOT NULL CHECK (alert_kind IN ('above', 'below', 'change_pct')),
  threshold NUMERIC,
  price NUMERIC,
  message TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sw_alert_events_user_time
  ON public.stock_watchlist_alert_events(user_id, triggered_at DESC);

ALTER TABLE public.stock_watchlist_alert_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS swae_owner_select ON public.stock_watchlist_alert_events;
CREATE POLICY swae_owner_select ON public.stock_watchlist_alert_events
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS swae_owner_insert ON public.stock_watchlist_alert_events;
CREATE POLICY swae_owner_insert ON public.stock_watchlist_alert_events
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS swae_owner_update ON public.stock_watchlist_alert_events;
CREATE POLICY swae_owner_update ON public.stock_watchlist_alert_events
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE ON public.stock_watchlist_alert_events TO authenticated;
