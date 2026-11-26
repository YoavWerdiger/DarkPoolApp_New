-- סקריפט לבדיקה פשוטה של העלאה
-- הרץ את זה ב-Supabase SQL Editor

-- בדוק אם יש בעיה עם הגדרות ה-RLS הכלליות
-- בדוק אם RLS מופעל על storage.objects
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename = 'objects';

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
-- בדוק אם יש מדיניות שמונעת הכל
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND (qual LIKE '%false%' OR qual LIKE '%deny%')
ORDER BY policyname;
