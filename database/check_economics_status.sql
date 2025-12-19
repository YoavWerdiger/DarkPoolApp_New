-- ============================================
-- בדיקת סטטוס אירועים כלכליים
-- ============================================

-- 1. בדיקת כמה אירועים יש בטבלה economic_events
SELECT 
  'economic_events' as table_name,
  COUNT(*) as total_events,
  COUNT(DISTINCT date) as unique_dates,
  MIN(date)::text as earliest_date,
  MAX(date)::text as latest_date,
  COUNT(CASE WHEN source = 'Benzinga' THEN 1 END) as benzinga_events
FROM economic_events;

-- 2. בדיקת כמה אירועים יש בטבלה economic_events_cache (אם קיימת)
SELECT 
  'economic_events_cache' as table_name,
  COUNT(*) as total_events,
  COUNT(DISTINCT date) as unique_dates,
  MIN(date)::text as earliest_date,
  MAX(date)::text as latest_date,
  COUNT(CASE WHEN source = 'Benzinga' THEN 1 END) as benzinga_events
FROM economic_events_cache
WHERE source = 'Benzinga';

-- 3. בדיקת אירועים לפי תאריך (10 האחרונים)
SELECT 
  date,
  COUNT(*) as events_count,
  COUNT(CASE WHEN importance = 'high' THEN 1 END) as high_importance,
  COUNT(CASE WHEN importance = 'medium' THEN 1 END) as medium_importance,
  COUNT(CASE WHEN importance = 'low' THEN 1 END) as low_importance
FROM economic_events
WHERE source = 'Benzinga'
GROUP BY date
ORDER BY date DESC
LIMIT 10;

-- 4. בדיקת metadata (אם קיים)
SELECT 
  id,
  source,
  country,
  last_update,
  total_events,
  date_range_start,
  date_range_end
FROM economic_cache_metadata
WHERE source = 'Benzinga';

-- 5. בדיקת אירועים היום ומחר
SELECT 
  date,
  COUNT(*) as events_today,
  STRING_AGG(title, ', ' ORDER BY time) as event_titles
FROM economic_events
WHERE source = 'Benzinga'
  AND date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '1 day')
GROUP BY date
ORDER BY date;




