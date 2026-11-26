-- הגדרת Automated Triggers
-- הרץ את הקובץ הזה ב-SQL Editor של Supabase

-- 1. פונקציה לעדכון יומי של Economic Events
CREATE OR REPLACE FUNCTION trigger_daily_economic_sync()
RETURNS void AS $$
BEGIN
  -- קריאה ל-Edge Function
  PERFORM net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/daily-economic-sync',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql;

-- 2. פונקציה לעדכון יומי של Earnings
CREATE OR REPLACE FUNCTION trigger_daily_earnings_sync()
RETURNS void AS $$
BEGIN
  -- קריאה ל-Edge Function
  PERFORM net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/daily-earnings-sync',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql;

-- 3. פונקציה ל-Smart Poller
CREATE OR REPLACE FUNCTION trigger_smart_poller()
RETURNS void AS $$
BEGIN
  -- קריאה ל-Edge Function
  PERFORM net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/smart-economic-poller',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql;

-- טריגרים שרצים על בסיס אירועים
-- לדוגמה: טריגר שרץ כשמשתמש חדש נרשם
CREATE OR REPLACE FUNCTION on_user_signup()
RETURNS trigger AS $$
BEGIN
  -- הפעלת סנכרון ראשוני
  PERFORM trigger_daily_economic_sync();
  PERFORM trigger_daily_earnings_sync();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- חיבור הטריגר לטבלת המשתמשים
CREATE TRIGGER user_signup_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION on_user_signup();

-- טריגר שרץ כשמתעדכן אירוע כלכלי
CREATE OR REPLACE FUNCTION on_economic_event_update()
RETURNS trigger AS $$
BEGIN
  -- אם האירוע חשוב, הפעל Smart Poller
  IF NEW.importance = 'high' THEN
    PERFORM trigger_smart_poller();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- חיבור הטריגר לטבלת האירועים הכלכליים
CREATE TRIGGER economic_event_update_trigger
  AFTER UPDATE ON economic_events
  FOR EACH ROW
  EXECUTE FUNCTION on_economic_event_update();

