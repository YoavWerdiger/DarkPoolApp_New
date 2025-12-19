-- ============================================
-- הפעלת Edge Function ישירות לשליפה ראשונית
-- ============================================
-- 
-- זה מפעיל את daily-earnings-sync-simple ישירות

-- ============================================
-- אפשרות 1: דרך SQL (מומלץ)
-- ============================================
SELECT * FROM trigger_earnings_sync();

-- ============================================
-- אפשרות 2: קריאה ישירה ל-Edge Function דרך HTTP
-- ============================================
SELECT 
  net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := jsonb_build_object(
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'date_from', (CURRENT_DATE - INTERVAL '3 months')::TEXT,
      'date_to', (CURRENT_DATE + INTERVAL '3 months')::TEXT
    ),
    timeout_milliseconds := 300000
  ) as http_response_id;

-- ============================================
-- Edge Function: daily-earnings-sync-simple
-- ============================================
-- זה ה-Edge Function שמשתמש ב-Benzinga API
-- ושולף יום-יום את כל דיווחי הרווחים

-- ============================================
-- אחרי הרצה - המתן 2-5 דקות ואז בדוק:
-- ============================================
-- SELECT COUNT(*) FROM earnings_calendar;





