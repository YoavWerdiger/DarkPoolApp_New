-- ============================================
-- תיקון JWT Token - שימוש ב-apikey במקום Authorization
-- ============================================

-- הערה: Edge Functions ב-Supabase דורשות apikey header
-- לא Authorization Bearer token

-- בדוק את ה-anon key שלך:
-- 1. לך ל-Supabase Dashboard
-- 2. Settings → API
-- 3. העתק את ה-anon/public key

-- דוגמה לשימוש נכון:
SELECT net.http_post(
  url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
  headers := jsonb_build_object(
    'apikey', 'YOUR_ANON_KEY_HERE',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
);

-- או עם Authorization (אם זה עובד):
SELECT net.http_post(
  url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
  headers := jsonb_build_object(
    'Authorization', 'Bearer YOUR_ANON_KEY_HERE',
    'apikey', 'YOUR_ANON_KEY_HERE',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
);








