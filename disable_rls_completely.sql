-- כיבוי RLS לחלוטין על Storage
-- זה יאפשר לכל אחד לגשת לכל הבאקטים

-- מחיקת כל הפוליסות
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Allow logged-in users to read files" ON storage.objects;
DROP POLICY IF EXISTS "Allow logged-in users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload media" ON storage.objects;

-- כיבוי RLS על הטבלה
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- בדיקה שהמצב
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'objects' AND schemaname = 'storage';
