-- תיקון RLS Policies עבור earnings_calendar
-- הבעיה: המשתמשים לא רואים את הנתונים

-- 1. ביטול כל ה-policies הקיימים
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.earnings_calendar;
DROP POLICY IF EXISTS "Enable insert for service role" ON public.earnings_calendar;
DROP POLICY IF EXISTS "Enable update for service role" ON public.earnings_calendar;

-- 2. יצירת policy חדש שמאפשר קריאה לכולם (כולל anon)
CREATE POLICY "Enable read access for all users"
  ON public.earnings_calendar
  FOR SELECT
  USING (true);

-- 3. policy להוספה ועדכון רק ל-service_role
CREATE POLICY "Enable insert for service role"
  ON public.earnings_calendar
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Enable update for service role"
  ON public.earnings_calendar
  FOR UPDATE
  TO service_role
  USING (true);

-- 4. ודא שה-RLS מופעל
ALTER TABLE public.earnings_calendar ENABLE ROW LEVEL SECURITY;

-- 5. ודא שהטבלה ב-realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.earnings_calendar;

-- 6. בדיקה - אמור להחזיר את מספר הרשומות
SELECT COUNT(*) as total FROM public.earnings_calendar;