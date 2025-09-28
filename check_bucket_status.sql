-- סקריפט לבדיקת מצב ה-bucket
-- הרץ את זה ב-Supabase SQL Editor

-- בדוק את כל ה-buckets הקיימים
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
ORDER BY created_at;

-- בדוק אם יש קבצים ב-chat-files bucket
SELECT 
  COUNT(*) as file_count,
  bucket_id
FROM storage.objects
GROUP BY bucket_id;

-- בדוק אם יש בעיה עם הגדרות ה-bucket
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'storage' AND tablename = 'buckets';

-- בדוק אם יש מדיניות על storage.buckets
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'buckets'
ORDER BY policyname;
