-- יצירת טבלת הגדרות התראות למשתמשים
-- ======================================
-- טבלה זו מאפשרת לשרת לדעת את ההעדפות של המשתמשים
-- ולהתאים את ההתראות שנשלחות להם

-- מחיקת הטבלה אם היא קיימת (להיזהר!)
-- DROP TABLE IF EXISTS public.user_notification_settings CASCADE;

-- יצירת הטבלה
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- הגדרות כלליות
  notifications_enabled BOOLEAN DEFAULT true NOT NULL,
  sound_enabled BOOLEAN DEFAULT true NOT NULL,
  vibration_enabled BOOLEAN DEFAULT true NOT NULL,
  
  -- התראות לפי סוג
  news_notifications BOOLEAN DEFAULT true NOT NULL,
  earnings_notifications BOOLEAN DEFAULT true NOT NULL,
  economic_calendar_notifications BOOLEAN DEFAULT true NOT NULL,
  message_notifications BOOLEAN DEFAULT true NOT NULL,
  
  -- צלילים
  news_sound BOOLEAN DEFAULT true NOT NULL,
  community_sound BOOLEAN DEFAULT true NOT NULL,
  
  -- עדכונים
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_user_notification_settings_user_id 
  ON public.user_notification_settings(user_id);

-- אינדקסים לשאילתות נפוצות
CREATE INDEX IF NOT EXISTS idx_user_notification_settings_news 
  ON public.user_notification_settings(news_notifications) 
  WHERE news_notifications = true;

CREATE INDEX IF NOT EXISTS idx_user_notification_settings_earnings 
  ON public.user_notification_settings(earnings_notifications) 
  WHERE earnings_notifications = true;

CREATE INDEX IF NOT EXISTS idx_user_notification_settings_economic 
  ON public.user_notification_settings(economic_calendar_notifications) 
  WHERE economic_calendar_notifications = true;

CREATE INDEX IF NOT EXISTS idx_user_notification_settings_messages 
  ON public.user_notification_settings(message_notifications) 
  WHERE message_notifications = true;

-- RLS Policies
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

-- מחיקת פוליסיות קיימות (אם קיימות)
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_notification_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_notification_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_notification_settings;
DROP POLICY IF EXISTS "Service role can manage all settings" ON public.user_notification_settings;

-- משתמשים יכולים לראות רק את ההגדרות שלהם
CREATE POLICY "Users can view their own settings"
  ON public.user_notification_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- משתמשים יכולים לעדכן רק את ההגדרות שלהם
CREATE POLICY "Users can update their own settings"
  ON public.user_notification_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- משתמשים יכולים להוסיף רק את ההגדרות שלהם
CREATE POLICY "Users can insert their own settings"
  ON public.user_notification_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role יכול לעשות הכל (לצורך Edge Functions)
CREATE POLICY "Service role can manage all settings"
  ON public.user_notification_settings
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- טריגר לעדכון updated_at אוטומטי
CREATE OR REPLACE FUNCTION update_user_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_notification_settings_updated_at 
  ON public.user_notification_settings;

CREATE TRIGGER trigger_update_user_notification_settings_updated_at
  BEFORE UPDATE ON public.user_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_notification_settings_updated_at();

-- פונקציה ליצירת הגדרות ברירת מחדל למשתמש חדש
CREATE OR REPLACE FUNCTION create_default_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגר ליצירת הגדרות ברירת מחדל כשמשתמש נרשם
DROP TRIGGER IF EXISTS on_user_created_notification_settings 
  ON auth.users;

CREATE TRIGGER on_user_created_notification_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_settings();

-- הערות:
-- 1. הטבלה משתמשת ב-RLS כדי שכל משתמש יראה רק את ההגדרות שלו
-- 2. Service role יכול לראות הכל - זה נחוץ ל-Edge Functions
-- 3. טריגר אוטומטי יוצר הגדרות ברירת מחדל לכל משתמש חדש
-- 4. האינדקסים משפרים ביצועים כשמסננים לפי סוג התראה



