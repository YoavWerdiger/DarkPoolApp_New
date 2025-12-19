-- Storage Policies for chat-media bucket
-- הרץ את זה ב-Supabase SQL Editor

-- מחק פוליסיס קיימות אם יש (כדי למנוע כפילויות)
DROP POLICY IF EXISTS "Users can upload to chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can read from chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete from chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update in chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for chat-media" ON storage.objects;

-- פוליסיס להעלאת קבצים (INSERT) - רק משתמשים מאומתים
CREATE POLICY "Users can upload to chat-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND auth.role() = 'authenticated'
);

-- פוליסיס לקריאת קבצים (SELECT) - גישה ציבורית (כי ה-bucket הוא public)
CREATE POLICY "Public read access for chat-media"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'chat-media'
);

-- פוליסיס למחיקת קבצים (DELETE) - רק משתמשים מאומתים
CREATE POLICY "Users can delete from chat-media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND auth.role() = 'authenticated'
);

-- פוליסיס לעדכון קבצים (UPDATE) - רק משתמשים מאומתים
CREATE POLICY "Users can update in chat-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND auth.role() = 'authenticated'
);

-- בדוק שהפוליסיס נוצרו
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' AND policyname LIKE '%chat-media%'
ORDER BY policyname;








