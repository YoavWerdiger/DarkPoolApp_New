-- סקריפט לתיקון משתמשים שנוצרו רק ב-public.users ללא auth.users
-- משתמשים כאלה לא יכולים להתחבר כי אין להם רשומה ב-auth.users

-- 1. מציאת משתמשים שנוצרו רק ב-public.users ללא auth.users
SELECT 
  u.id,
  u.email,
  u.display_name,
  u.created_at
FROM public.users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE au.id IS NULL
ORDER BY u.created_at DESC;

-- 2. מחיקת משתמשים יתומים (רק אם אתה בטוח!)
-- ⚠️ אזהרה: זה ימחק את המשתמשים האלה לגמרי!
-- UNCOMMENT רק אם אתה רוצה למחוק אותם:
/*
DELETE FROM public.users
WHERE id IN (
  SELECT u.id
  FROM public.users u
  LEFT JOIN auth.users au ON u.id = au.id
  WHERE au.id IS NULL
);
*/

-- 3. בדיקה של משתמשים שיש להם גם auth.users וגם public.users
SELECT 
  au.id,
  au.email as auth_email,
  u.email as public_email,
  au.email_confirmed_at,
  u.registration_completed
FROM auth.users au
INNER JOIN public.users u ON au.id = u.id
ORDER BY au.created_at DESC
LIMIT 10;




