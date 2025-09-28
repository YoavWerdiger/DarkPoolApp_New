-- סקריפט סופי לפתרון בעיית ה-Storage
-- הרץ את זה ב-Supabase SQL Editor

-- מחק את כל המדיניות הקיימות על storage.objects
DROP POLICY IF EXISTS "Allow all for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own user-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update own user-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload own user-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public read user-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view media files" ON storage.objects;

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
