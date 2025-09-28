-- 1. ביטול RLS זמנית לבדיקה
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. מחיקת כל ה-policies הקיימים
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;

-- 3. יצירת policies חדשים ופשוטים
CREATE POLICY "Enable all operations for authenticated users" ON public.users
  FOR ALL USING (auth.role() = 'authenticated');

-- 4. עדכון הפונקציה handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, display_name, email, full_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', NEW.email)
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. מחיקת trigger ישן ויצירת חדש
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. וידוא שהפונקציות קיימות
CREATE OR REPLACE FUNCTION check_email_exists(email_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM public.users WHERE email = email_to_check);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_phone_exists(phone_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM public.users WHERE phone = phone_to_check);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION complete_user_registration(
  user_id UUID,
  user_full_name TEXT,
  user_phone TEXT,
  user_track_id TEXT,
  user_intro_data JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  -- בדיקה שהמשתמש קיים
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id = user_id) THEN
    RETURN FALSE;
  END IF;
  
  -- בדיקה שהטלפון לא קיים אצל משתמש אחר
  IF user_phone IS NOT NULL AND EXISTS(SELECT 1 FROM public.users WHERE phone = user_phone AND id != user_id) THEN
    RETURN FALSE;
  END IF;
  
  -- עדכון הנתונים
  UPDATE public.users 
  SET 
    full_name = user_full_name,
    phone = user_phone,
    track_id = user_track_id,
    intro_data = user_intro_data,
    registration_completed = TRUE,
    updated_at = NOW()
  WHERE id = user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. הפעלת RLS מחדש
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 8. יצירת policy פשוט שמאפשר הכל למשתמשים מחוברים
CREATE POLICY "Allow all for authenticated users" ON public.users
  FOR ALL USING (auth.role() = 'authenticated');

-- 9. בדיקה שהכל עובד - יצירת משתמש בדיקה
-- (הערה: זה רק לבדיקה, לא להרצה בסביבת ייצור)
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
-- VALUES (
--   gen_random_uuid(),
--   'test@example.com',
--   crypt('password123', gen_salt('bf')),
--   NOW(),
--   NOW(),
--   NOW(),
--   '{"display_name": "משתמש בדיקה", "full_name": "משתמש בדיקה"}'
-- ); 