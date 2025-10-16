-- תיקון RLS Policies עבור earnings_calendar
-- (ללא שורת realtime שכבר קיימת)

-- 1. ביטול כל ה-policies הקיימים
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.earnings_calendar;
DROP POLICY IF EXISTS "Enable insert for service role" ON public.earnings_calendar;
DROP POLICY IF EXISTS "Enable update for service role" ON public.earnings_calendar;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.earnings_calendar;

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

-- 5. בדיקה - אמור להחזיר את מספר הרשומות
SELECT COUNT(*) as total_records FROM public.earnings_calendar;

-- 6. בדיקת policies
SELECT schemaname, tablename, policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'earnings_calendar';
