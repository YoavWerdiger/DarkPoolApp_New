-- ============================================================
-- טריגר התראות יומן כלכלי
-- ============================================================
-- יופעל כאשר actual מתעדכן (מהמערכת החיה) ב-economic_events
-- שולח התראה לכל משתמש שהפעיל economic_calendar_notifications
-- ============================================================

-- מחיקת פונקציה קיימת אם יש
DROP FUNCTION IF EXISTS send_economic_calendar_notification() CASCADE;

-- פונקציה שתרוץ על כל UPDATE של actual
CREATE OR REPLACE FUNCTION send_economic_calendar_notification()
RETURNS TRIGGER AS $$
DECLARE
  notification_title  TEXT;
  notification_body   TEXT;
  country_emoji       TEXT;
  importance_stars    TEXT;
  supabase_url        TEXT := 'https://wpmrtczbfcijoocguime.supabase.co';
  supabase_service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A';
  http_response_id    BIGINT;
BEGIN
  -- הפעל את הטריגר רק כאשר:
  -- 1. actual השתנה מ-NULL או ריק לערך אמיתי
  -- 2. האירוע הוא של היום (לא עתידי)
  IF (NEW.actual IS NULL OR TRIM(NEW.actual) = '')
    OR (OLD.actual IS NOT NULL AND TRIM(OLD.actual) != '' AND OLD.actual = NEW.actual)
  THEN
    RETURN NEW; -- אין שינוי רלוונטי, יוצא
  END IF;

  -- רק אירועים של היום ואתמול (לא עתידיים)
  IF NEW.date > CURRENT_DATE THEN
    RETURN NEW;
  END IF;

  -- אמוג'י דגל לפי מדינה
  country_emoji := CASE NEW.country
    WHEN 'US' THEN '🇺🇸'
    WHEN 'EU' THEN '🇪🇺'
    WHEN 'GB' THEN '🇬🇧'
    WHEN 'JP' THEN '🇯🇵'
    WHEN 'DE' THEN '🇩🇪'
    WHEN 'CN' THEN '🇨🇳'
    WHEN 'CA' THEN '🇨🇦'
    WHEN 'AU' THEN '🇦🇺'
    ELSE '🌍'
  END;

  -- כוכבי חשיבות
  importance_stars := CASE NEW.importance
    WHEN 'high'   THEN '🔴'
    WHEN 'medium' THEN '🟡'
    WHEN 'low'    THEN '🟢'
    ELSE '⚪'
  END;

  -- כותרת: דגל + שם האירוע + חשיבות
  notification_title := country_emoji || ' ' || LEFT(NEW.title, 60) || ' ' || importance_stars;

  -- גוף: תוצאות הדוח לעומת הצפיות
  notification_body := 'תוצאות הדוח: ' || NEW.actual || ' לעומת הצפיות: ' || COALESCE(NULLIF(TRIM(NEW.forecast), ''), 'N/A');

  -- הכנסה ל-pending_notifications רק למשתמשים שהפעילו התראות יומן כלכלי
  INSERT INTO public.pending_notifications (
    user_id, title, body, data, notification_type
  )
  SELECT DISTINCT
    dt.user_id,
    notification_title,
    notification_body,
    jsonb_build_object(
      'type',       'economic_calendar',
      'eventId',    NEW.id,
      'title',      NEW.title,
      'actual',     NEW.actual,
      'forecast',   COALESCE(NEW.forecast, ''),
      'previous',   COALESCE(NEW.previous, ''),
      'country',    NEW.country,
      'importance', NEW.importance,
      'date',       NEW.date::TEXT
    ),
    'economic_calendar'
  FROM public.device_tokens dt
  LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL
    AND (uns.economic_calendar_notifications = true OR uns.economic_calendar_notifications IS NULL)
    AND (uns.notifications_enabled = true OR uns.notifications_enabled IS NULL);

  -- קריאה מיידית ל-process-pending-notifications דרך pg_net
  SELECT net.http_post(
    url     := supabase_url || '/functions/v1/process-pending-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || supabase_service_key
    ),
    body    := '{}'::jsonb
  ) INTO http_response_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- גיבוי: הכנסה גם אחרי שגיאה, ה-cron (כל 2 דקות) יטפל בה
    INSERT INTO public.pending_notifications (
      user_id, title, body, data, notification_type
    )
    SELECT DISTINCT
      dt.user_id,
      notification_title,
      notification_body,
      jsonb_build_object(
        'type',       'economic_calendar',
        'eventId',    NEW.id,
        'title',      NEW.title,
        'actual',     NEW.actual,
        'forecast',   COALESCE(NEW.forecast, ''),
        'previous',   COALESCE(NEW.previous, ''),
        'country',    NEW.country,
        'importance', NEW.importance,
        'date',       NEW.date::TEXT
      ),
      'economic_calendar'
    FROM public.device_tokens dt
    LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
    WHERE dt.is_active = true
      AND dt.user_id IS NOT NULL
      AND (uns.economic_calendar_notifications = true OR uns.economic_calendar_notifications IS NULL)
      AND (uns.notifications_enabled = true OR uns.notifications_enabled IS NULL);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- מחיקת טריגר קיים אם יש
DROP TRIGGER IF EXISTS on_economic_event_result ON public.economic_events;

-- יצירת הטריגר
CREATE TRIGGER on_economic_event_result
  AFTER UPDATE OF actual ON public.economic_events
  FOR EACH ROW
  EXECUTE FUNCTION send_economic_calendar_notification();

-- ============================================================
-- הערות:
-- 1. יופעל רק כשעמודת actual מתעדכנת (AFTER UPDATE OF actual)
-- 2. בודק שהערך אכן השתנה מריק/NULL לערך אמיתי
-- 3. לא שולח על אירועים עתידיים
-- 4. מכבד הגדרות משתמש: economic_calendar_notifications + notifications_enabled
-- 5. ה-cron של process-pending-notifications (כל 2 דקות) הוא גיבוי נוסף
-- ============================================================
