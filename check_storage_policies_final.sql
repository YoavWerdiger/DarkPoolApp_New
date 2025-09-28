-- בדיקת פוליסות קיימות
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
ORDER BY policyname;

-- מחיקת כל הפוליסות הקיימות
DROP POLICY IF EXISTS "Allow all for app-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow all for media" ON storage.objects;
DROP POLICY IF EXISTS "Allow all for chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow all for chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow all for files" ON storage.objects;

-- יצירת פוליסה פשוטה וחזקה לכל הבאקטים
CREATE POLICY "Allow all operations for authenticated users" ON storage.objects
  FOR ALL USING (
    auth.role() = 'authenticated'
  );

-- בדיקה שהפוליסה נוצרה
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
ORDER BY policyname;
