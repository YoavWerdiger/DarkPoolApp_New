-- ============================================================================
-- Stock Watchlists — רשימות מעקב מניות אישיות (מחליף את טאב השווקים)
-- ============================================================================
-- טבלאות:
--   1. stock_watchlists       – רשימות מעקב (ברירת מחדל + רשימות נוספות)
--   2. stock_watchlist_items  – סימבולים בתוך רשימה
--
-- RLS: owner-only על שתי הטבלאות.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_watchlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'הרשימה שלי',
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_watchlists_user
  ON public.stock_watchlists(user_id, sort_order);

-- לכל משתמש רק רשימת ברירת מחדל אחת
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_watchlists_user_default
  ON public.stock_watchlists(user_id)
  WHERE is_default = TRUE;

COMMENT ON TABLE public.stock_watchlists IS 'רשימות מעקב מניות — בעלות משתמש';

CREATE TABLE IF NOT EXISTS public.stock_watchlist_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id   UUID NOT NULL REFERENCES public.stock_watchlists(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol         TEXT NOT NULL,
  company_name   TEXT,
  notes          TEXT,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_watchlist_items_symbol_nonempty CHECK (char_length(trim(symbol)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_watchlist_items_list_symbol
  ON public.stock_watchlist_items(watchlist_id, symbol);

CREATE INDEX IF NOT EXISTS idx_stock_watchlist_items_user
  ON public.stock_watchlist_items(user_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_stock_watchlist_items_watchlist
  ON public.stock_watchlist_items(watchlist_id, sort_order);

COMMENT ON TABLE public.stock_watchlist_items IS 'סימבולים ברשימת מעקב — מחירים נשלפים בזמן ריצה מ-Finnhub/Yahoo';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_stock_watchlists_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_watchlists_updated_at ON public.stock_watchlists;
CREATE TRIGGER trg_stock_watchlists_updated_at
  BEFORE UPDATE ON public.stock_watchlists
  FOR EACH ROW
  EXECUTE FUNCTION public.set_stock_watchlists_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.stock_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_watchlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sw_owner_select ON public.stock_watchlists;
CREATE POLICY sw_owner_select ON public.stock_watchlists
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS sw_owner_insert ON public.stock_watchlists;
CREATE POLICY sw_owner_insert ON public.stock_watchlists
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS sw_owner_update ON public.stock_watchlists;
CREATE POLICY sw_owner_update ON public.stock_watchlists
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS sw_owner_delete ON public.stock_watchlists;
CREATE POLICY sw_owner_delete ON public.stock_watchlists
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS swi_owner_select ON public.stock_watchlist_items;
CREATE POLICY swi_owner_select ON public.stock_watchlist_items
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS swi_owner_insert ON public.stock_watchlist_items;
CREATE POLICY swi_owner_insert ON public.stock_watchlist_items
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS swi_owner_update ON public.stock_watchlist_items;
CREATE POLICY swi_owner_update ON public.stock_watchlist_items
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS swi_owner_delete ON public.stock_watchlist_items;
CREATE POLICY swi_owner_delete ON public.stock_watchlist_items
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- GRANTs — חשיפה ל-Data API
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_watchlists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_watchlist_items TO authenticated;
