-- 🔍 בדיקת הפונקציה ידנית
-- =========================

-- בדיקה 1: האם הפונקציה קיימת?
SELECT 
  'בדיקה 1: הפונקציה' as check_name,
  proname as function_name,
  prosrc as function_source
FROM pg_proc
WHERE proname = 'send_news_notification_immediately';

-- בדיקה 2: נסה להריץ את הפונקציה ידנית על החדשה האחרונה
-- (זה לא יעבוד ישירות, אבל נוכל לבדוק את הלוגיקה)

-- בדיקה 3: בדוק אם יש RLS Policies על pending_notifications
SELECT 
  'בדיקה 3: RLS Policies על pending_notifications' as check_name,
  policyname,
  cmd as command_type
FROM pg_policies
WHERE tablename = 'pending_notifications';

-- בדיקה 4: נסה להוסיף התראה ידנית (כדי לבדוק אם יש בעיה ב-RLS)
-- ⚠️ זה צריך להיות עם user_id של משתמש שיש לו device token
INSERT INTO pending_notifications (user_id, title, body, notification_type, article_id)
SELECT 
  dt.user_id,
  'בדיקה ידנית',
  'זה בדיקה ידנית של הוספת התראה',
  'news',
  'test_manual'
FROM device_tokens dt
WHERE dt.is_active = true
LIMIT 1
RETURNING id, user_id, title, is_sent;

-- בדיקה 5: בדוק אם ההתראה נוצרה
SELECT 
  'בדיקה 5: התראה שנוצרה' as check_name,
  id,
  user_id,
  title,
  body,
  is_sent,
  created_at
FROM pending_notifications
WHERE article_id = 'test_manual'
ORDER BY created_at DESC
LIMIT 1;


