-- ============================================
-- S&P 500 Constituents — auto-filtering for earnings_calendar
-- ============================================
-- מטרה: לסנן את כל הסנכרונים השונים של דיווחי הרווח כך שרק חברות
-- מ-S&P 500 ייכנסו ל-`earnings_calendar`. הסינון נעשה בצד ה-DB ע״י
-- טריגר BEFORE INSERT/UPDATE — מכסה את כל סקריפטי ה-sync יחד
-- (daily-earnings-sync-*, earnings-daily-sync, וכו׳) בלי לגעת בכל אחד.
--
-- הטבלה `sp500_constituents` מתעדכנת מ-EODHD ע״י Edge Function
-- חיצוני (`sync-sp500-constituents`) שאמור לרוץ פעם בשבוע.
-- ============================================

CREATE TABLE IF NOT EXISTS public.sp500_constituents (
  -- e.g. "AAPL.US" — מתאים ישירות ל-`earnings_calendar.code`
  symbol      TEXT PRIMARY KEY,
  -- e.g. "AAPL" — לבדיקות חוצות-פורמט
  ticker      TEXT NOT NULL,
  name        TEXT,
  sector      TEXT,
  industry    TEXT,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sp500_ticker ON public.sp500_constituents(ticker);

ALTER TABLE public.sp500_constituents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read sp500_constituents"        ON public.sp500_constituents;
DROP POLICY IF EXISTS "Service role can manage sp500_constituents" ON public.sp500_constituents;

CREATE POLICY "Anyone can read sp500_constituents"
  ON public.sp500_constituents FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage sp500_constituents"
  ON public.sp500_constituents FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- Trigger: סינון אוטומטי ב-INSERT/UPDATE על earnings_calendar
-- ============================================
-- אם החברה לא נמצאת ב-sp500_constituents — מחזירים NULL מטריגר BEFORE
-- וזה מדלג על השורה בלי שגיאה. אם הטבלה ריקה (לפני seed ראשון) —
-- fail-open (מאפשר הכל) כדי לא לחסום סנכרון לפני שיש נתוני constituents.
-- ============================================

CREATE OR REPLACE FUNCTION public.filter_earnings_sp500_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_constituents INTEGER;
  is_sp500 BOOLEAN;
  candidate_ticker TEXT;
BEGIN
  -- fail-open אם הטבלה ריקה
  SELECT COUNT(*) INTO total_constituents FROM public.sp500_constituents;
  IF total_constituents = 0 THEN
    RETURN NEW;
  END IF;

  -- מנסים לפי `code` (פורמט EODHD) ולפי `ticker` הטהור (Benzinga / EODHD-pure)
  candidate_ticker := COALESCE(NEW.ticker, REPLACE(NEW.code, '.US', ''));

  SELECT EXISTS (
    SELECT 1 FROM public.sp500_constituents
    WHERE symbol = NEW.code
       OR ticker = candidate_ticker
  ) INTO is_sp500;

  IF is_sp500 THEN
    RETURN NEW;
  ELSE
    -- BEFORE trigger שמחזיר NULL = השורה לא נכנסת/לא מתעדכנת
    RETURN NULL;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS earnings_calendar_sp500_filter ON public.earnings_calendar;
CREATE TRIGGER earnings_calendar_sp500_filter
  BEFORE INSERT OR UPDATE ON public.earnings_calendar
  FOR EACH ROW EXECUTE FUNCTION public.filter_earnings_sp500_only();

-- ============================================
-- Cleanup function: מחיקה חד-פעמית של מה שכבר נכנס לפני הטריגר
-- ============================================
-- שימוש: SELECT public.cleanup_non_sp500_earnings();
-- מתבצע אוטומטית בסוף ה-Edge Function `sync-sp500-constituents`.
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_non_sp500_earnings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_constituents INTEGER;
  deleted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_constituents FROM public.sp500_constituents;
  IF total_constituents = 0 THEN
    RAISE NOTICE 'sp500_constituents is empty — skipping cleanup';
    RETURN 0;
  END IF;

  WITH del AS (
    DELETE FROM public.earnings_calendar
    WHERE code NOT IN (SELECT symbol FROM public.sp500_constituents)
      AND COALESCE(ticker, REPLACE(code, '.US', ''))
          NOT IN (SELECT ticker FROM public.sp500_constituents)
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM del;

  RAISE NOTICE 'cleanup_non_sp500_earnings: deleted % rows', deleted_count;
  RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_non_sp500_earnings() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cleanup_non_sp500_earnings() TO service_role;

-- הודעת סיום
DO $$
BEGIN
  RAISE NOTICE '✅ sp500_constituents table + filter trigger ready';
  RAISE NOTICE '   Run the `sync-sp500-constituents` edge function to seed the table.';
END $$;
