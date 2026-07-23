-- ============================================
-- Storage: chat-media — bucket פרטי + RLS לפי חברות בקבוצה
-- ============================================
-- הרץ ב-Supabase SQL Editor.
-- נתיב קבצים חייב להיות: {group_uuid}/שם-קובץ (כמו ב-chatMediaService).
-- הלקוח משתמש ב-createSignedUrl עם JWT של המשתמש (אחרי פוליסיות אלה).
-- ============================================

-- Bucket לא ציבורי — ללא גישת אנונימית ישירה ל-URL
UPDATE storage.buckets SET public = false WHERE id = 'chat-media';

DROP POLICY IF EXISTS "Users can upload to chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can read from chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete from chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update in chat-media" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_select_group_members" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_insert_group_members" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_delete_group_members" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_update_group_members" ON storage.objects;

-- SELECT — חבר בקבוצה (לפי תיקיית group_id בנתיב)
CREATE POLICY "chat_media_select_group_members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members cgm
    WHERE cgm.user_id = auth.uid()
      AND cgm.group_id::text = split_part(name, '/', 1)
  )
);

-- INSERT — רק לנתיב של קבוצה שאתה חבר בה
CREATE POLICY "chat_media_insert_group_members"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members cgm
    WHERE cgm.user_id = auth.uid()
      AND cgm.group_id::text = split_part(name, '/', 1)
  )
);

-- DELETE — חבר בקבוצה (אותו תיק)
CREATE POLICY "chat_media_delete_group_members"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members cgm
    WHERE cgm.user_id = auth.uid()
      AND cgm.group_id::text = split_part(name, '/', 1)
  )
);

-- UPDATE — חבר בקבוצה
CREATE POLICY "chat_media_update_group_members"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members cgm
    WHERE cgm.user_id = auth.uid()
      AND cgm.group_id::text = split_part(name, '/', 1)
  )
)
WITH CHECK (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members cgm
    WHERE cgm.user_id = auth.uid()
      AND cgm.group_id::text = split_part(name, '/', 1)
  )
);

SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'objects' AND policyname LIKE 'chat_media_%'
ORDER BY policyname;
