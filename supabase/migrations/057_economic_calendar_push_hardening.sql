-- ============================================================================
-- 057_economic_calendar_push_hardening.sql
-- תיקון הצפת התראות יומן כלכלי (44k+ שורות היסטוריות).
--
-- בעיות שתוקנו:
--   1. טריגר ירה על כל שינוי actual (גם עדכון חוזר / דיווחים ישנים)
--   2. אין dedup — אותו אירוע × משתמש נכנס שוב ושוב לתור
--   3. שליחה כפולה: טריגר + Edge Function ישירות ל-Expo
--
-- כלל חדש: התראה רק כש-actual מתמלא לראשונה, לאירוע של היום/אתמול בלבד.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- מניעת כפילות: משתמש + אירוע = התראה אחת בלבד (לכל הזמנים)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_notifications_economic_dedup
  ON public.pending_notifications (user_id, article_id)
  WHERE notification_type = 'economic_calendar'
    AND article_id IS NOT NULL;

COMMENT ON INDEX idx_pending_notifications_economic_dedup IS
  'User receives at most one economic_calendar push per economic_events row';

CREATE OR REPLACE FUNCTION public.send_economic_calendar_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  notification_title  TEXT;
  notification_body   TEXT;
  country_emoji       TEXT;
  importance_stars    TEXT;
  v_url               TEXT;
  v_key               TEXT;
  http_response_id    BIGINT;
  old_actual_text     TEXT;
  new_actual_text     TEXT;
BEGIN
  old_actual_text := NULLIF(TRIM(COALESCE(OLD.actual::TEXT, '')), '');
  new_actual_text := NULLIF(TRIM(COALESCE(NEW.actual::TEXT, '')), '');

  -- רק מעבר מ"אין תוצאה" ל"יש תוצאה" (פרסום ראשון)
  IF old_actual_text IS NOT NULL OR new_actual_text IS NULL THEN
    RETURN NEW;
  END IF;

  -- רק היום ואתמול — לא דיווחים היסטוריים שמתעדכנים בסנכרון
  IF NEW.date < CURRENT_DATE - INTERVAL '1 day' OR NEW.date > CURRENT_DATE THEN
    RETURN NEW;
  END IF;

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

  importance_stars := CASE NEW.importance
    WHEN 'high'   THEN '🔴'
    WHEN 'medium' THEN '🟡'
    WHEN 'low'    THEN '🟢'
    ELSE '⚪'
  END;

  notification_title := country_emoji || ' ' || LEFT(NEW.title, 60) || ' ' || importance_stars;
  notification_body := 'תוצאות הדוח: ' || new_actual_text
    || ' לעומת הצפיות: ' || COALESCE(NULLIF(TRIM(COALESCE(NEW.forecast::TEXT, '')), ''), 'N/A');

  INSERT INTO public.pending_notifications (
    user_id, title, body, data, notification_type, article_id
  )
  SELECT DISTINCT
    dt.user_id,
    notification_title,
    notification_body,
    jsonb_build_object(
      'type',       'economic_calendar',
      'eventId',    NEW.id,
      'title',      NEW.title,
      'actual',     new_actual_text,
      'forecast',   COALESCE(NEW.forecast::TEXT, ''),
      'previous',   COALESCE(NEW.previous::TEXT, ''),
      'country',    NEW.country,
      'importance', NEW.importance,
      'date',       NEW.date::TEXT
    ),
    'economic_calendar',
    NEW.id::TEXT
  FROM public.device_tokens dt
  LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL
    AND COALESCE(uns.notifications_enabled, true)
    AND COALESCE(uns.economic_calendar_notifications, true)
    AND NOT EXISTS (
      SELECT 1
      FROM public.pending_notifications pn
      WHERE pn.user_id = dt.user_id
        AND pn.notification_type = 'economic_calendar'
        AND pn.article_id = NEW.id::TEXT
    );

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
    SELECT net.http_post(
      url     := rtrim(v_url, '/') || '/functions/v1/process-pending-notifications',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body    := '{}'::jsonb
    ) INTO http_response_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'send_economic_calendar_notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_economic_event_result ON public.economic_events;

CREATE TRIGGER on_economic_event_result
  AFTER UPDATE OF actual ON public.economic_events
  FOR EACH ROW
  EXECUTE FUNCTION public.send_economic_calendar_notification();
