-- סקריפט לבדיקת בעיית ה-authentication
-- הרץ את זה ב-Supabase SQL Editor

-- בדוק אם יש בעיה עם הגדרות ה-RLS הכלליות
-- בדוק אם יש מדיניות ברירת מחדל
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname LIKE '%default%'
ORDER BY policyname;

-- בדוק אם יש בעיה עם הגדרות ה-RLS הכלליות
-- בדוק אם יש מדיניות שמונעות הכל
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND (qual LIKE '%false%' OR qual LIKE '%deny%')
ORDER BY policyname;

-- בדוק אם יש בעיה עם הגדרות ה-RLS הכלליות
-- בדוק אם יש מדיניות שמונעות הכל
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND (qual LIKE '%false%' OR qual LIKE '%deny%')
ORDER BY policyname;
