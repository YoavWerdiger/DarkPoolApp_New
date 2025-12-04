-- 🔍 בדיקת הטריגר של app_news_clean
-- ===========================================

-- שלב 1: בדוק אם הטריגר קיים
SELECT 
  '🔍 טריגרים על app_news_clean' as check_name,
  tg.trigger_name,
  tg.event_manipulation as event,
  tg.action_timing as timing,
  tg.action_statement as function_name
FROM information_schema.triggers tg
WHERE tg.event_object_table = 'app_news_clean'
  AND tg.event_object_schema = 'public'
ORDER BY tg.trigger_name;

-- שלב 2: בדוק את הפונקציה שהטריגר קורא לה
SELECT 
  '📋 פונקציות התראות' as check_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (p.proname LIKE '%notification%' OR p.proname LIKE '%news%')
ORDER BY p.proname;

-- שלב 3: בדוק את החדשה האחרונה שנוספה
SELECT 
  '📰 החדשה האחרונה' as check_name,
  anc.id,
  anc.label,
  LEFT(anc.text, 50) || '...' as text_preview,
  anc.source,
  anc.time,
  anc.created_at
FROM app_news_clean anc
WHERE anc.id LIKE 'test_%'
ORDER BY anc.created_at DESC
LIMIT 5;

-- שלב 4: בדוק אם יש התראות ב-pending_notifications (כל ההתראות האחרונות)
SELECT 
  '📋 כל ההתראות האחרונות' as check_name,
  pn.id,
  pn.user_id,
  pn.title,
  pn.body,
  pn.notification_type,
  pn.is_sent,
  pn.created_at,
  pn.sent_at,
  u.email as user_email
FROM pending_notifications pn
LEFT JOIN auth.users u ON pn.user_id = u.id
WHERE pn.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY pn.created_at DESC
LIMIT 10;

-- שלב 5: בדוק את המבנה של app_news_clean
SELECT 
  '📊 מבנה הטבלה app_news_clean' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'app_news_clean'
  AND table_schema = 'public'
ORDER BY ordinal_position;


