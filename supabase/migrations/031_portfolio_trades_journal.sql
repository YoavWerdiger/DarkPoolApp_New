-- ============================================================================
-- Migration: 031_portfolio_trades_journal.sql
--
-- מיזוג של "יומן מסחר" לתוך תיקי השקעות:
--   1) הוספת עמודת `direction` ('long' / 'short') ל-portfolio_transactions
--      כדי לתמוך בשורט (פתיחה במכירה / סגירה בקנייה).
--   2) טבלת `portfolio_trade_meta` — מטה-דאטה לטרייד לוגי שנגזר מקבוצות
--      טרנזקציות (stop_loss, target, אסטרטגיה, journal_details JSONB).
--
-- אין שינוי לוגיקה ב-views/functions הקיימים — הם ממשיכים לעבוד as-is.
-- שלב 2 (TS service layer) יחשב מתוך הטבלאות הללו "trades" נגזרים ב-FIFO.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. direction column ב-portfolio_transactions
--   ברירת מחדל 'long' — תאימות לאחור עבור כל הרשומות הקיימות.
--   רלוונטי רק ל-buy/sell. עבור deposit/withdrawal/fee/dividend הערך מוחזק
--   ב-'long' (ניטרלי) — האפליקציה מתעלמת ממנו לטיפוסים האלו.
-- ----------------------------------------------------------------------------
ALTER TABLE public.portfolio_transactions
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'long'
    CHECK (direction IN ('long', 'short'));

COMMENT ON COLUMN public.portfolio_transactions.direction IS
  'כיוון הטרייד עבור buy/sell. long: קניה פותחת. short: מכירה פותחת. מתעלמים מהשדה עבור cash/dividend.';

CREATE INDEX IF NOT EXISTS idx_portfolio_tx_portfolio_symbol_direction
  ON public.portfolio_transactions(portfolio_id, symbol, direction)
  WHERE symbol IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. portfolio_trade_meta — מטה-דאטה לטרייד לוגי
--    מפתח: (portfolio_id, symbol, direction, opened_at)
--    opened_at = תאריך הטרנזקציה הראשונה שפתחה את הטרייד.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_trade_meta (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol          TEXT NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  opened_at       TIMESTAMPTZ NOT NULL,
  stop_loss       NUMERIC(20,8),
  target_price    NUMERIC(20,8),
  strategy_name   TEXT,
  journal_details JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portfolio_trade_meta_unique
    UNIQUE (portfolio_id, symbol, direction, opened_at)
);

CREATE INDEX IF NOT EXISTS idx_trade_meta_portfolio
  ON public.portfolio_trade_meta(portfolio_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_trade_meta_user
  ON public.portfolio_trade_meta(user_id);

COMMENT ON TABLE public.portfolio_trade_meta IS
  'מטה-דאטה לטרייד לוגי (סטופ/יעד/אסטרטגיה/יומן). הטרייד עצמו נגזר אוטומטית מ-portfolio_transactions ב-FIFO.';

-- ----------------------------------------------------------------------------
-- 3. updated_at trigger ל-portfolio_trade_meta
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_portfolio_trade_meta_updated_at ON public.portfolio_trade_meta;
CREATE TRIGGER trg_portfolio_trade_meta_updated_at
  BEFORE UPDATE ON public.portfolio_trade_meta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_portfolio();

-- ----------------------------------------------------------------------------
-- 4. Row Level Security ל-portfolio_trade_meta
--    בעלי התיק יכולים לקרוא/לכתוב. שיתוף לקהילה לא חושף את ה-meta
--    (כדי להגן על מידע פסיכולוגי אישי).
-- ----------------------------------------------------------------------------
ALTER TABLE public.portfolio_trade_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portfolio_trade_meta_owner_select ON public.portfolio_trade_meta;
CREATE POLICY portfolio_trade_meta_owner_select
  ON public.portfolio_trade_meta FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS portfolio_trade_meta_owner_insert ON public.portfolio_trade_meta;
CREATE POLICY portfolio_trade_meta_owner_insert
  ON public.portfolio_trade_meta FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS portfolio_trade_meta_owner_update ON public.portfolio_trade_meta;
CREATE POLICY portfolio_trade_meta_owner_update
  ON public.portfolio_trade_meta FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND p.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS portfolio_trade_meta_owner_delete ON public.portfolio_trade_meta;
CREATE POLICY portfolio_trade_meta_owner_delete
  ON public.portfolio_trade_meta FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND p.user_id = auth.uid()
    )
  );
