-- בדיקת שעת עדכון התוצאות (actual) של אירועים מאתמול
-- ============================================

-- 1. בדיקת אירועים מאתמול שיש להם actual
SELECT 
  id,
  title,
  date,
  time,
  actual,
  forecast,
  previous,
  created_at,
  updated_at,
  -- חישוב מתי התעדכן (אם updated_at שונה מ-created_at, זה אומר שהתעדכן)
  CASE 
    WHEN updated_at != created_at THEN updated_at
    ELSE created_at
  END as last_updated,
  -- חישוב שעה
  EXTRACT(HOUR FROM (
    CASE 
      WHEN updated_at != created_at THEN updated_at
      ELSE created_at
    END
  )) as update_hour,
  EXTRACT(MINUTE FROM (
    CASE 
      WHEN updated_at != created_at THEN updated_at
      ELSE created_at
    END
  )) as update_minute
FROM economic_events
WHERE 
  date = (CURRENT_DATE - INTERVAL '1 day')::TEXT
  AND actual IS NOT NULL
  AND actual != ''
ORDER BY 
  CASE 
    WHEN updated_at != created_at THEN updated_at
    ELSE created_at
  END DESC;

-- 2. סיכום - כמה אירועים התעדכנו בכל שעה
SELECT 
  EXTRACT(HOUR FROM (
    CASE 
      WHEN updated_at != created_at THEN updated_at
      ELSE created_at
    END
  )) as hour,
  COUNT(*) as events_count,
  MIN(
    CASE 
      WHEN updated_at != created_at THEN updated_at
      ELSE created_at
    END
  ) as first_update,
  MAX(
    CASE 
      WHEN updated_at != created_at THEN updated_at
      ELSE created_at
    END
  ) as last_update
FROM economic_events
WHERE 
  date = (CURRENT_DATE - INTERVAL '1 day')::TEXT
  AND actual IS NOT NULL
  AND actual != ''
GROUP BY 
  EXTRACT(HOUR FROM (
    CASE 
      WHEN updated_at != created_at THEN updated_at
      ELSE created_at
    END
  ))
ORDER BY hour;

-- 3. בדיקה כללית - מתי התעדכנו אירועים עם actual בשבוע האחרון
SELECT 
  date,
  COUNT(*) as events_with_actual,
  MIN(
    CASE 
      WHEN updated_at != created_at THEN updated_at
      ELSE created_at
    END
  ) as first_update_time,
  MAX(
    CASE 
      WHEN updated_at != created_at THEN updated_at
      ELSE created_at
    END
  ) as last_update_time,
  -- ממוצע שעת עדכון
  AVG(
    EXTRACT(HOUR FROM (
      CASE 
        WHEN updated_at != created_at THEN updated_at
        ELSE created_at
      END
    ))
  ) as avg_update_hour
FROM economic_events
WHERE 
  date >= (CURRENT_DATE - INTERVAL '7 days')::TEXT
  AND actual IS NOT NULL
  AND actual != ''
GROUP BY date
ORDER BY date DESC;




