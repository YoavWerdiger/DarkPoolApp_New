-- סקריפט פשוט לפתרון סופי
-- הרץ את זה ב-Supabase SQL Editor

-- מחיקת כל הפוליסות הקיימות
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Allow logged-in users to read files" ON storage.objects;
DROP POLICY IF EXISTS "Allow logged-in users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload media" ON storage.objects;

-- יצירת פוליסה אחת פשוטה - נותנת הרשאות מלאות לכל אחד
CREATE POLICY "Allow everything for everyone" ON storage.objects
  FOR ALL USING (true)
  WITH CHECK (true);

-- בדיקה שהפוליסה נוצרה
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
ORDER BY policyname;
