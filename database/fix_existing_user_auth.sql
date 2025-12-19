-- תיקון משתמש קיים - יצירת רשומה ב-auth.users
-- משתמש: yoavwerdig@gmail.com
-- סיסמה: yoavwerdig

-- וידוא שה-extension pgcrypto מופעל
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. בדיקה אם המשתמש קיים ב-public.users
DO $$
DECLARE
  v_public_user_id UUID;
  v_public_email TEXT := 'yoavwerdig@gmail.com';
  v_password TEXT := 'yoavwerdig';
  v_encrypted_password TEXT;
  v_instance_id UUID;
  v_auth_user_id UUID;
BEGIN
  -- בדיקה אם המשתמש קיים ב-public.users
  SELECT id INTO v_public_user_id 
  FROM public.users 
  WHERE email = v_public_email;
  
  IF v_public_user_id IS NULL THEN
    RAISE NOTICE '❌ המשתמש % לא נמצא ב-public.users', v_public_email;
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ נמצא משתמש ב-public.users: % (ID: %)', v_public_email, v_public_user_id;
  
  -- בדיקה אם המשתמש כבר קיים ב-auth.users
  SELECT id INTO v_auth_user_id 
  FROM auth.users 
  WHERE email = v_public_email OR id = v_public_user_id;
  
  IF v_auth_user_id IS NOT NULL THEN
    RAISE NOTICE '⚠️ המשתמש כבר קיים ב-auth.users: % (ID: %)', v_public_email, v_auth_user_id;
    RAISE NOTICE '💡 אם אתה רוצה לאפס את הסיסמה, מחק את המשתמש מ-auth.users קודם';
    RETURN;
  END IF;
  
  -- קבלת instance_id
  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;
  
  -- יצירת hash לסיסמה
  v_encrypted_password := crypt(v_password, gen_salt('bf'));
  
  -- יצירת משתמש ב-auth.users עם אותו ID כמו ב-public.users
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
    v_public_user_id,  -- שימוש באותו ID כמו ב-public.users
    v_instance_id,
    v_public_email,
    v_encrypted_password,
    NOW(),  -- אימות מייל אוטומטי
    NULL,
    NULL,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object(
      'display_name', (SELECT display_name FROM public.users WHERE id = v_public_user_id),
      'full_name', (SELECT full_name FROM public.users WHERE id = v_public_user_id)
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
  
  RAISE NOTICE '✅ משתמש נוצר ב-auth.users בהצלחה!';
  RAISE NOTICE '📧 Email: %', v_public_email;
  RAISE NOTICE '🔑 Password: %', v_password;
  RAISE NOTICE '🆔 User ID: %', v_public_user_id;
  RAISE NOTICE '';
  RAISE NOTICE 'עכשיו תוכל להתחבר עם המייל והסיסמה שלמעלה';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ שגיאה: %', SQLERRM;
END $$;

-- 2. בדיקה שהמשתמש נוצר בהצלחה
SELECT 
  'auth.users' as table_name,
  id,
  email,
  email_confirmed_at IS NOT NULL as email_confirmed,
  encrypted_password IS NOT NULL as has_password,
  created_at
FROM auth.users
WHERE email = 'yoavwerdig@gmail.com';

SELECT 
  'public.users' as table_name,
  id,
  email,
  display_name,
  created_at
FROM public.users
WHERE email = 'yoavwerdig@gmail.com';



