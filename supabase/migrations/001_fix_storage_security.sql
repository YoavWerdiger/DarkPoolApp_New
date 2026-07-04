-- Remove public access from chat-media bucket
UPDATE storage.buckets
SET public = false
WHERE id = 'chat-media';

-- Drop existing overly-permissive policies
DROP POLICY IF EXISTS "Public read access for chat-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- Only group members can read media from their group
-- Media path format: chat-media/{group_id}/{filename}
CREATE POLICY "Group members can read media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE chat_group_members.group_id = (storage.foldername(name))[1]::uuid
      AND chat_group_members.user_id = auth.uid()
  )
);

-- Authenticated users can upload to groups they belong to
CREATE POLICY "Group members can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE chat_group_members.group_id = (storage.foldername(name))[1]::uuid
      AND chat_group_members.user_id = auth.uid()
  )
);

-- Users can delete their own uploads
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND owner = auth.uid()
);
