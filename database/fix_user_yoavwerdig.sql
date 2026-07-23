-- תיקון מהיר למשתמש yoavwerdig@gmail.com
-- סקריפט זה יוצר את המשתמש ב-auth.users אם הוא לא קיים

-- וידוא שה-extension pgcrypto מופעל
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_public_user_id UUID;
  v_email TEXT := 'yoavwerdig@gmail.com';
  v_password TEXT := 'yoavwerdig';
  v_encrypted_password TEXT;
  v_instance_id UUID;
  v_auth_user_id UUID;
  v_display_name TEXT;
  v_full_name TEXT;
BEGIN
  -- 1. בדיקה אם המשתמש קיים ב-public.users
  SELECT id, display_name, full_name 
  INTO v_public_user_id, v_display_name, v_full_name
  FROM public.users 
  WHERE email = v_email;
  
  IF v_public_user_id IS NULL THEN
    RAISE NOTICE '❌ המשתמש % לא נמצא ב-public.users', v_email;
    RAISE NOTICE '💡 צריך ליצור את המשתמש קודם דרך האפליקציה או SQL';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ נמצא משתמש ב-public.users:';
  RAISE NOTICE '   ID: %', v_public_user_id;
  RAISE NOTICE '   Email: %', v_email;
  RAISE NOTICE '   Display Name: %', v_display_name;
  
  -- 2. בדיקה אם המשתמש כבר קיים ב-auth.users
  SELECT id INTO v_auth_user_id 
  FROM auth.users 
  WHERE email = v_email OR id = v_public_user_id;
  
  IF v_auth_user_id IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ המשתמש כבר קיים ב-auth.users:';
    RAISE NOTICE '   ID: %', v_auth_user_id;
    RAISE NOTICE '';
    RAISE NOTICE '💡 אם הסיסמה לא עובדת, אפשר לאפס אותה:';
    RAISE NOTICE '   DELETE FROM auth.users WHERE id = ''%'';', v_auth_user_id;
    RAISE NOTICE '   ואז להריץ את הסקריפט הזה שוב';
    RETURN;
  END IF;
  
  -- 3. קבלת instance_id
  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;
  
  -- 4. יצירת hash לסיסמה
  v_encrypted_password := crypt(v_password, gen_salt('bf'));
  
  -- 5. יצירת משתמש ב-auth.users עם אותו ID כמו ב-public.users
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
    v_public_user_id,
    v_instance_id,
    v_email,
    v_encrypted_password,
    NOW(),
    NULL,
    NULL,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object(
      'display_name', COALESCE(v_display_name, v_email),
      'full_name', COALESCE(v_full_name, v_display_name, v_email)
    ),
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    'authenticated',
    'authenticated'
  );
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ משתמש נוצר ב-auth.users בהצלחה!';
  RAISE NOTICE '';
  RAISE NOTICE '📧 Email: %', v_email;
  RAISE NOTICE '🔑 Password: %', v_password;
  RAISE NOTICE '🆔 User ID: %', v_public_user_id;
  RAISE NOTICE '';
  RAISE NOTICE 'עכשיו תוכל להתחבר עם המייל והסיסמה שלמעלה';
  
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE '⚠️ המשתמש כבר קיים ב-auth.users (unique violation)';
    RAISE NOTICE '💡 נסה למחוק אותו קודם:';
    RAISE NOTICE '   DELETE FROM auth.users WHERE email = ''%'';', v_email;
  WHEN OTHERS THEN
    RAISE NOTICE '❌ שגיאה: %', SQLERRM;
    RAISE NOTICE '   SQLSTATE: %', SQLSTATE;
END $$;

-- 6. בדיקה שהמשתמש נוצר בהצלחה
SELECT 
  '✅ auth.users' as status,
  id,
  email,
  email_confirmed_at IS NOT NULL as email_confirmed,
  encrypted_password IS NOT NULL as has_password,
  created_at
FROM auth.users
WHERE email = 'yoavwerdig@gmail.com';

SELECT 
  '✅ public.users' as status,
  id,
  email,
  display_name,
  created_at
FROM public.users
WHERE email = 'yoavwerdig@gmail.com';




