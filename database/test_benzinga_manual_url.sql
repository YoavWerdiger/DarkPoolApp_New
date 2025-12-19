-- ============================================
-- דוגמה לפרמטרים ידניים ל-Benzinga Earnings API
-- ============================================
-- 
-- זה מראה איך לבנות URL ידנית עם כל הפרמטרים

DO $$
DECLARE
  api_key TEXT := 'bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC';
  base_url TEXT := 'https://api.benzinga.com/api/v2/calendar/earnings';
  
  -- פרמטרים בסיסיים
  token TEXT := api_key;
  accept TEXT := 'application/json';
  
  -- פרמטרי pagination
  page INTEGER := 0; -- 0-100000
  pagesize INTEGER := 1000; -- מקסימום 1000
  
  -- פרמטרי תאריכים
  date_from TEXT := '2024-12-01'; -- YYYY-MM-DD
  date_to TEXT := '2025-12-31'; -- YYYY-MM-DD
  -- או להשתמש ב-parameters[date] לתאריך בודד:
  -- date_single TEXT := '2025-01-15';
  
  -- פרמטרי מיון וסינון
  date_sort TEXT := 'date:asc'; -- או 'date:desc'
  -- tickers TEXT := 'AAPL,MSFT,GOOGL'; -- מקסימום 50, מופרדים בפסיק
  -- importance INTEGER := 3; -- 0-5, רק >=
  -- updated BIGINT := 1704067200; -- Unix timestamp (UTC)
  
  -- בניית URL
  api_url TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📋 פרמטרים ידניים ל-Benzinga Earnings API';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  
  -- בניית URL עם כל הפרמטרים
  api_url := base_url || '?' ||
    'token=' || token ||
    '&accept=' || accept ||
    '&page=' || page ||
    '&pagesize=' || pagesize ||
    '&parameters[date_from]=' || date_from ||
    '&parameters[date_to]=' || date_to ||
    '&parameters[date_sort]=' || date_sort;
  
  -- פרמטרים אופציונליים (הסרת הערות כדי להפעיל):
  -- IF tickers IS NOT NULL THEN
  --   api_url := api_url || '&parameters[tickers]=' || tickers;
  -- END IF;
  -- IF importance IS NOT NULL THEN
  --   api_url := api_url || '&parameters[importance]=' || importance;
  -- END IF;
  -- IF updated IS NOT NULL THEN
  --   api_url := api_url || '&parameters[updated]=' || updated;
  -- END IF;
  
  RAISE NOTICE '🔗 URL מלא:';
  RAISE NOTICE '%', api_url;
  RAISE NOTICE '';
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📝 פירוט הפרמטרים:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Authorization:';
  RAISE NOTICE '   token = %', token;
  RAISE NOTICE '';
  RAISE NOTICE '📥 Headers:';
  RAISE NOTICE '   accept = %', accept;
  RAISE NOTICE '';
  RAISE NOTICE '📄 Pagination:';
  RAISE NOTICE '   page = % (0-100000)', page;
  RAISE NOTICE '   pagesize = % (מקסימום 1000)', pagesize;
  RAISE NOTICE '';
  RAISE NOTICE '📅 תאריכים:';
  RAISE NOTICE '   parameters[date_from] = %', date_from;
  RAISE NOTICE '   parameters[date_to] = %', date_to;
  RAISE NOTICE '   parameters[date_sort] = %', date_sort;
  RAISE NOTICE '';
  RAISE NOTICE '   💡 אלטרנטיבה לתאריך בודד:';
  RAISE NOTICE '      parameters[date] = 2025-01-15';
  RAISE NOTICE '      (זה שקול ל-date_from=date_to=2025-01-15)';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 סינון (אופציונלי):';
  RAISE NOTICE '   parameters[tickers] = AAPL,MSFT,GOOGL (מקסימום 50, מופרדים בפסיק)';
  RAISE NOTICE '   parameters[importance] = 3 (0-5, רק >=)';
  RAISE NOTICE '   parameters[updated] = 1704067200 (Unix timestamp UTC)';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📋 דוגמה ל-URL מינימלי (רק תאריכים):';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '%?token=%&accept=application/json&page=0&pagesize=1000&parameters[date_from]=%&parameters[date_to]=%&parameters[date_sort]=date:asc',
    base_url, token, date_from, date_to;
  RAISE NOTICE '';
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📋 דוגמה ל-URL עם תאריך בודד:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '%?token=%&accept=application/json&page=0&pagesize=1000&parameters[date]=2025-01-15&parameters[date_sort]=date:asc',
    base_url, token;
  RAISE NOTICE '';
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📋 דוגמה ל-URL עם סינון לפי מניות:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '%?token=%&accept=application/json&page=0&pagesize=1000&parameters[date_from]=%&parameters[date_to]=%&parameters[tickers]=AAPL,MSFT,GOOGL&parameters[date_sort]=date:asc',
    base_url, token, date_from, date_to;
  RAISE NOTICE '';
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ סיכום:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📌 פרמטרים חובה:';
  RAISE NOTICE '   • token (Header או Query)';
  RAISE NOTICE '   • accept (Header או Query)';
  RAISE NOTICE '';
  RAISE NOTICE '📌 פרמטרים מומלצים:';
  RAISE NOTICE '   • page (0-100000)';
  RAISE NOTICE '   • pagesize (מקסימום 1000)';
  RAISE NOTICE '   • parameters[date_from] או parameters[date]';
  RAISE NOTICE '   • parameters[date_to] (אם משתמשים ב-date_from)';
  RAISE NOTICE '';
  RAISE NOTICE '📌 פרמטרים אופציונליים:';
  RAISE NOTICE '   • parameters[date_sort] (date:asc או date:desc)';
  RAISE NOTICE '   • parameters[tickers] (מקסימום 50, מופרדים בפסיק)';
  RAISE NOTICE '   • parameters[importance] (0-5)';
  RAISE NOTICE '   • parameters[updated] (Unix timestamp UTC)';
  RAISE NOTICE '';
END $$;







