-- קריאה ציבורית לפיד בכירים (נתוני SEC / UW) — בלי זה RLS מחזיר [] לאנונימי ונראה "ריק"

DROP POLICY IF EXISTS dpi_public_select ON public.dark_pool_insider_buys;
CREATE POLICY dpi_public_select ON public.dark_pool_insider_buys
  FOR SELECT TO anon, authenticated
  USING (TRUE);
