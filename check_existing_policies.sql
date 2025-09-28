-- בדוק את הפוליסיס הקיימות
-- הרץ את זה ב-Supabase SQL Editor

SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects'
ORDER BY policyname;
