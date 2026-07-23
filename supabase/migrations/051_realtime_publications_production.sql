-- ============================================================
-- 051: Production Realtime publications (non-chat features)
-- ============================================================
-- מוסיף טבלאות שהקליינט מאזין להן ב-postgres_changes אבל חסרות
-- במיגרציות הרשמיות (במיוחד Dark Pool + News + Calendar).
--
-- צ'אט כבר ב-047. ברוקר ב-027.
-- הרץ ב-Supabase SQL Editor או: supabase db push
--
-- אימות:
--   SELECT tablename FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' AND tablename IN (
--     'dark_pool_signals','dark_pool_trades','app_news_clean',
--     'economic_events','earnings_calendar'
--   );
-- ============================================================

DO $$
DECLARE
  tables text[] := ARRAY[
    -- Dark Pool (subscribeDarkPool in darkPoolService.ts)
    'dark_pool_trades',
    'dark_pool_signals',
    -- News (BreakingNewsTab, newsService)
    'app_news_clean',
    -- Calendar / earnings (EconomicCalendarTab, EarningsReportsTab)
    'economic_events',
    'earnings_calendar',
    'earnings_trends',
    'ipos_calendar',
    'splits_calendar',
    'dividends_calendar',
    'earnings_events'
  ];
  t text;
  tbl_exists boolean;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) INTO tbl_exists;

    IF NOT tbl_exists THEN
      RAISE NOTICE '051: skip % — table does not exist in this database', t;
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE '051: added % to supabase_realtime', t;
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE '051: % already in publication', t;
      WHEN OTHERS THEN
        IF SQLERRM LIKE '%already member of publication%' THEN
          RAISE NOTICE '051: % already member', t;
        ELSE
          RAISE WARNING '051: failed to add % — %', t, SQLERRM;
        END IF;
    END;
  END LOOP;
END $$;

-- אימות מרוכז
SELECT
  tablename,
  'in supabase_realtime' AS status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = ANY(ARRAY[
    'chat_messages',
    'chat_group_members',
    'dark_pool_signals',
    'dark_pool_trades',
    'app_news_clean',
    'economic_events',
    'earnings_calendar',
    'broker_positions'
  ])
ORDER BY tablename;
