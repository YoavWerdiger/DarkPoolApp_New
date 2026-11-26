-- תיקון שגיאת character varying(10) - הארכת שדות במסד הנתונים
-- קובץ זה מתקן שדות שקצרים מדי

-- 1. בדיקה של השדות הקיימים
-- נבדוק אילו שדות יכולים לגרום לשגיאה character varying(10)

-- בדיקת טבלת economic_events
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'economic_events' 
AND data_type = 'character varying' 
AND character_maximum_length <= 10;

-- בדיקת טבלת economic_data_cache_meta
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'economic_data_cache_meta' 
AND data_type = 'character varying' 
AND character_maximum_length <= 10;

-- בדיקת טבלת economic_webhook_events
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'economic_webhook_events' 
AND data_type = 'character varying' 
AND character_maximum_length <= 10;

-- 2. תיקון שדות נפוצים שעלולים לגרום לבעיה

-- תיקון שדה status בטבלת economic_events
ALTER TABLE economic_events ALTER COLUMN status TYPE VARCHAR(50);

-- תיקון שדה event_type בטבלת economic_events
ALTER TABLE economic_events ALTER COLUMN event_type TYPE VARCHAR(50);

-- תיקון שדה country_code בטבלת economic_events
ALTER TABLE economic_events ALTER COLUMN country_code TYPE VARCHAR(10);

-- תיקון שדה currency בטבלת economic_events
ALTER TABLE economic_events ALTER COLUMN currency TYPE VARCHAR(10);

-- תיקון שדה impact בטבלת economic_events
ALTER TABLE economic_events ALTER COLUMN impact TYPE VARCHAR(20);

-- 3. תיקון שדות בטבלת cache_meta
-- נניח שיש שדה cache_key או status
ALTER TABLE economic_data_cache_meta ALTER COLUMN cache_key TYPE VARCHAR(255);
ALTER TABLE economic_data_cache_meta ALTER COLUMN status TYPE VARCHAR(20);

-- 4. תיקון שדות בטבלת webhook_events
ALTER TABLE economic_webhook_events ALTER COLUMN event_type TYPE VARCHAR(50);
ALTER TABLE economic_webhook_events ALTER COLUMN status TYPE VARCHAR(20);

-- 5. תיקון שדות בטבלת users
ALTER TABLE users ALTER COLUMN full_name TYPE VARCHAR(100);
ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(20);

-- 6. הוספת שדות חסרים אם נדרש
-- וידוא שיש את כל השדות הנדרשים בטבלת users
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 7. עדכון ה-trigger לעדכון updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- הוספת trigger לטבלת users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. וידוא שה-RLS עובד על הטבלאות
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 9. הוספת policies לטבלת users
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 10. הרשאות
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;

-- הודעת הצלחה
SELECT 'Character varying fields fixed successfully!' as message;
