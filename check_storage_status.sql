-- סקריפט לבדיקת מצב ה-Storage והרשאות
-- הרץ את זה ב-Supabase SQL Editor

-- 1. בדוק אם RLS מופעל על storage.objects
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 2. בדוק את כל המדיניות הקיימות על storage.objects
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects'
ORDER BY policyname;

-- 3. בדוק את ה-bucket chat-files
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'chat-files';

-- 4. בדוק אם יש קבצים ב-bucket
SELECT 
  COUNT(*) as file_count
FROM storage.objects 
WHERE bucket_id = 'chat-files';
