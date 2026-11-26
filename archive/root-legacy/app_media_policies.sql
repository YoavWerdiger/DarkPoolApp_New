-- סקריפט ליצירת פוליסיס בסיסיים ל-bucket app-media
-- הרץ את זה ב-Supabase SQL Editor

-- מחק פוליסיס קיימות אם יש (כדי למנוע כפילויות)
DROP POLICY IF EXISTS "Users can upload to app-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can read from app-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete from app-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update in app-media" ON storage.objects;

-- פוליסיס להעלאת קבצים (INSERT)
CREATE POLICY "Users can upload to app-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-media'
  AND auth.role() = 'authenticated'
);

-- פוליסיס לקריאת קבצים (SELECT)
CREATE POLICY "Users can read from app-media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'app-media'
  AND auth.role() = 'authenticated'
);

-- פוליסיס למחיקת קבצים (DELETE)
CREATE POLICY "Users can delete from app-media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'app-media'
  AND auth.role() = 'authenticated'
);

-- פוליסיס לעדכון קבצים (UPDATE)
CREATE POLICY "Users can update in app-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'app-media'
  AND auth.role() = 'authenticated'
);

-- בדוק שהפוליסיס נוצרו
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' AND policyname LIKE '%app-media%'
ORDER BY policyname;

-- עכשיו נסה להעלות תמונה מהאפליקציה
