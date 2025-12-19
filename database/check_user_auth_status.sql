-- בדיקת מצב המשתמש yoavwerdig@gmail.com

-- 1. בדיקה אם המשתמש קיים ב-public.users
SELECT 
  'public.users' as table_name,
  id,
  email,
  display_name,
  created_at
FROM public.users
WHERE email = 'yoavwerdig@gmail.com';

-- 2. בדיקה אם המשתמש קיים ב-auth.users
SELECT 
  'auth.users' as table_name,
  id,
  email,
  email_confirmed_at,
  encrypted_password IS NOT NULL as has_password,
  created_at
FROM auth.users
WHERE email = 'yoavwerdig@gmail.com';

-- 3. בדיקה משולבת - האם יש התאמה בין הטבלאות
SELECT 
  pu.id as public_id,
  pu.email as public_email,
  au.id as auth_id,
  au.email as auth_email,
  CASE 
    WHEN au.id IS NULL THEN '❌ חסר ב-auth.users'
    WHEN pu.id IS NULL THEN '❌ חסר ב-public.users'
    ELSE '✅ קיים בשתי הטבלאות'
  END as status
FROM public.users pu
FULL OUTER JOIN auth.users au ON pu.id = au.id
WHERE pu.email = 'yoavwerdig@gmail.com' OR au.email = 'yoavwerdig@gmail.com';



