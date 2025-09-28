-- סקריפט עם מדיניות פשוטה יותר לפתרון בעיית ההרשאות
-- הרץ את זה ב-Supabase SQL Editor

-- מחק את המדיניות הקיימות
DROP POLICY IF EXISTS "Allow all for authenticated users" ON storage.objects;

-- צור מדיניות פשוטה מאוד - כל משתמש מאומת יכול לעשות הכל
CREATE POLICY "Allow all for authenticated users" ON storage.objects
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
-- אם זה עובד, הבעיה הייתה עם המדיניות הקודמות
-- אם זה לא עובד, הבעיה עמוקה יותר
