-- ============================================================================
-- 014_portfolio_public_community.sql
-- שיתוף תיקים עם הקהילה: שדה is_public + RLS לקריאה למשתמשים מאומתים
-- ============================================================================

ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.portfolios.is_public IS
  'כאשר true – משתמשים מאומתים אחרים יכולים לצפות בתיק (קריאה בלבד)';

CREATE INDEX IF NOT EXISTS idx_portfolios_public_updated
  ON public.portfolios(updated_at DESC)
  WHERE is_public = TRUE AND is_archived = FALSE;

-- קריאה לתיקים ציבוריים (בנוסף למדיניות הבעלים הקיימת)
DROP POLICY IF EXISTS portfolios_public_read ON public.portfolios;
CREATE POLICY portfolios_public_read ON public.portfolios
  FOR SELECT TO authenticated
  USING (is_public = TRUE);

-- טרנזקציות של תיק ציבורי — קריאה בלבד לצופים
DROP POLICY IF EXISTS portfolio_tx_public_read ON public.portfolio_transactions;
CREATE POLICY portfolio_tx_public_read ON public.portfolio_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_transactions.portfolio_id
        AND p.is_public = TRUE
    )
  );

-- היסטוריית שווי לגרפים — תיק ציבורי
DROP POLICY IF EXISTS portfolio_value_history_public_read ON public.portfolio_value_history;
CREATE POLICY portfolio_value_history_public_read ON public.portfolio_value_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_value_history.portfolio_id
        AND p.is_public = TRUE
    )
  );
