-- ============================================
-- דוגמה ל-cURL command ל-Benzinga Earnings API (v2.0)
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📋 cURL command ל-Benzinga Earnings API';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE 'curl --request GET \';
  RAISE NOTICE '  --url ''https://api.benzinga.com/api/v2.0/calendar/earnings?token=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC&date_from=2025-12-07&date_to=2026-12-07&importance=4,5&limit=1000&exchange=NYSE,NASDAQ'' \';
  RAISE NOTICE '  --header ''accept: application/json''';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📝 פירוט הפרמטרים:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '🔗 URL Base:';
  RAISE NOTICE '   https://api.benzinga.com/api/v2.0/calendar/earnings';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Query Parameters:';
  RAISE NOTICE '   token = bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC';
  RAISE NOTICE '   date_from = 2025-12-07';
  RAISE NOTICE '   date_to = 2026-12-07';
  RAISE NOTICE '   importance = 4,5 (חשיבות 4 או 5)';
  RAISE NOTICE '   limit = 1000 (מספר תוצאות מקסימלי)';
  RAISE NOTICE '   exchange = NYSE,NASDAQ (בורסות)';
  RAISE NOTICE '';
  RAISE NOTICE '📥 Headers:';
  RAISE NOTICE '   accept: application/json';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '💡 הערות:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ שים לב: זה API v2.0 (לא v2)';
  RAISE NOTICE '   • הפרמטרים ישירות ב-query (לא parameters[...])';
  RAISE NOTICE '   • משתמש ב-limit במקום pagesize';
  RAISE NOTICE '   • importance יכול להיות רשימה (4,5)';
  RAISE NOTICE '   • exchange יכול להיות רשימה (NYSE,NASDAQ)';
  RAISE NOTICE '';
END $$;







