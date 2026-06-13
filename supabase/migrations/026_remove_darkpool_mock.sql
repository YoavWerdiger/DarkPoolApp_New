-- ============================================================
-- 026: Remove mock Dark Pool data inserted by 024_darkpool_mock_seed.sql
-- ------------------------------------------------------------
-- מסיר באופן מדויק את כל הנתונים המדומים מהטבלאות של Dark Pool
-- כדי שהאפליקציה תעבוד אך ורק עם נתונים אמיתיים שמגיעים מספקי
-- ה-API (Polygon / UnusualWhales / Intrinio + Finnhub וכו').
-- ============================================================

-- 1. trades: כל מה שנכנס דרך ה-mock provider
DELETE FROM public.dark_pool_trades
 WHERE provider = 'mock'
    OR external_id LIKE 'mock-%';

-- 2. cursor של ה-mock provider
DELETE FROM public.dark_pool_provider_state
 WHERE provider = 'mock';

-- 3. insider buys שנזרעו ידנית עם external_id 'form4-001'..'form4-006'
DELETE FROM public.dark_pool_insider_buys
 WHERE external_id LIKE 'form4-00%';

-- 4. signals שנזרעו עם reason/ai_summary בעברית מתוך ה-seed.
--    מזוהים גם לפי ה-bucket_5m (קוואנטים של 5 דקות) שלא חוזר על עצמו טבעית.
DELETE FROM public.dark_pool_signals
 WHERE ai_summary LIKE '%NVIDIA רושמת פעילות dark pool חריגה%'
    OR ai_summary LIKE '%Apple מציגה דפוס צבירה עקבי%'
    OR ai_summary LIKE '%S&P 500 ETF רושם נפח Dark Pool חריג%'
    OR ai_summary LIKE '%Microsoft — sweep מהיר%';

-- 5. aggregates: ה-seed הכניס שורות חדשות עבור התאריכים האחרונים
--    בטיקרים שמופיעים ב-mock. מסירים רק שורות שאין להן trades אמיתיים
--    (אחרי שמחקנו את ה-mock trades בשלב 1) — בטוח ושמרני.
DELETE FROM public.dark_pool_daily_aggregates a
 WHERE NOT EXISTS (
   SELECT 1 FROM public.dark_pool_trades t
    WHERE t.ticker = a.ticker
      AND t.ts::date = a.date
 );

DO $$
BEGIN
  RAISE NOTICE '✅ removed mock dark pool data — DB is now clean of seeds';
END $$;
