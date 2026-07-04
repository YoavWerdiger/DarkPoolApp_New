-- ============================================
-- יצירת משתמש חדש - התחברות מהירה
-- ============================================
-- קובץ זה יוצר משתמש חדש ב-auth.users וב-public.users
-- כך שתוכל להתחבר ישירות בלי לעבור את תהליך הרישום
-- ============================================

-- וידוא שה-extension pgcrypto מופעל (נדרש להצפנת סיסמאות)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- פונקציה ליצירת משתמש עם הרשאות מתאימות
CREATE OR REPLACE FUNCTION create_user_quick(
  p_email TEXT,
  p_password TEXT,
  p_display_name TEXT DEFAULT 'משתמש חדש',
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_encrypted_password TEXT;
  v_instance_id UUID;
BEGIN
  -- קבלת instance_id מהטבלה הראשונה
  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  
  -- אם אין instance, נשתמש בערך ברירת מחדל
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;
  
  -- יצירת hash לסיסמה
  v_encrypted_password := crypt(p_password, gen_salt('bf'));
  
  -- יצירת משתמש ב-auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    aud,
    role
  ) VALUES (
    v_user_id,
    v_instance_id,
    p_email,
    v_encrypted_password,
    NOW(),  -- אימות מייל אוטומטי
    NULL,
    NULL,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object(
      'display_name', p_display_name,
      'full_name', COALESCE(p_full_name, p_display_name)
    ),
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    'authenticated',
    'authenticated'
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_user_id;
  
  -- אם המשתמש כבר קיים, נקבל את ה-ID שלו
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  END IF;
  
  RETURN v_user_id;
END;
$$;

-- הגדר כאן את הפרטים שלך:
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'test@example.com';  -- שנה למייל שלך
  v_password TEXT := 'password123';    -- שנה לסיסמה שלך
  v_display_name TEXT := 'משתמש חדש';  -- שנה לשם התצוגה
  v_full_name TEXT := 'משתמש חדש';     -- שם מלא (אופציונלי)
  v_phone TEXT := NULL;                 -- טלפון (אופציונלי, בפורמט: 0501234567)
BEGIN
  -- יצירת משתמש ב-auth.users
  v_user_id := create_user_quick(
    v_email,
    v_password,
    v_display_name,
    v_full_name
  );
  
  -- יצירת פרופיל ב-public.users
  INSERT INTO public.users (
    id,
    display_name,
    full_name,
    email,
    phone,
    profile_picture,
    account_type,
    track_id,
    intro_data,
    registration_completed,
    created_at,
    updated_at,
    is_online
  ) VALUES (
    v_user_id,
    v_display_name,
    COALESCE(v_full_name, v_display_name),
    v_email,
    v_phone,
    NULL,
    'free',
    '1',  -- track_id: '1', '2', או '3'
    '{}'::jsonb,
    TRUE,  -- רישום הושלם
    NOW(),
    NOW(),
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    updated_at = NOW();
  
  -- הוספת המשתמש לקבוצות החובה (אם הן קיימות)
  INSERT INTO public.chat_group_members (group_id, user_id, role, notifications_enabled)
  SELECT 
    '00000000-0000-0000-0000-000000000001', -- הכרזות
    v_user_id,
    'member',
    true
  WHERE EXISTS (SELECT 1 FROM public.chat_groups WHERE id = '00000000-0000-0000-0000-000000000001')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.chat_group_members (group_id, user_id, role, notifications_enabled)
  SELECT 
    '00000000-0000-0000-0000-000000000002', -- דיונים כללי
    v_user_id,
    'member',
    true
  WHERE EXISTS (SELECT 1 FROM public.chat_groups WHERE id = '00000000-0000-0000-0000-000000000002')
  ON CONFLICT DO NOTHING;
  
  -- הצגת פרטי המשתמש שנוצר
  RAISE NOTICE '✅ משתמש נוצר בהצלחה!';
  RAISE NOTICE '📧 Email: %', v_email;
  RAISE NOTICE '🔑 Password: %', v_password;
  RAISE NOTICE '🆔 User ID: %', v_user_id;
  RAISE NOTICE '';
  RAISE NOTICE 'עכשיו תוכל להתחבר עם המייל והסיסמה שלמעלה';
  
END $$;

-- ============================================
-- בדיקה שהמשתמש נוצר בהצלחה
-- ============================================
SELECT 
  u.id,
  u.email,
  u.display_name,
  u.full_name,
  u.phone,
  u.registration_completed,
  u.created_at
FROM public.users u
WHERE u.email = 'test@example.com'  -- שנה למייל שהגדרת למעלה
ORDER BY u.created_at DESC
LIMIT 1;

-- ============================================
-- הוראות שימוש:
-- ============================================
-- 1. שנה את הערכים בחלק העליון של הקובץ:
--    - v_email: המייל שלך
--    - v_password: הסיסמה שלך
--    - v_display_name: שם התצוגה
--    - v_full_name: שם מלא (אופציונלי)
--    - v_phone: טלפון (אופציונלי)
--
-- 2. הרץ את הקובץ ב-Supabase SQL Editor
--
-- 3. התחבר לאפליקציה עם המייל והסיסמה שהגדרת
--
-- ============================================




