-- סקריפט עם מדיניות פשוטה יותר
-- הרץ את זה ב-Supabase SQL Editor

-- מחק את המדיניות הקיימת
DROP POLICY IF EXISTS "Allow all for authenticated users" ON storage.objects;

-- צור מדיניות פשוטה מאוד - כל משתמש מאומת יכול לעשות הכל
-- הפעם בלי הגבלות נוספות
CREATE POLICY "Simple authenticated access" ON storage.objects
  FOR ALL USING (auth.role() = 'authenticated');

-- בדוק שהמדיניות נוצרה
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects'
ORDER BY policyname;

-- עכשיו נסה להעלות תמונה מהאפליקציה
