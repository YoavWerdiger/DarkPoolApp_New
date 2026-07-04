-- =============================================
-- Delivery status: add delivered_at to read receipts
-- =============================================
ALTER TABLE public.chat_message_reads
ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- =============================================
-- Pinned messages table
-- =============================================
CREATE TABLE IF NOT EXISTS public.chat_pinned_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  pinned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, message_id)
);

ALTER TABLE public.chat_pinned_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view pinned messages"
ON public.chat_pinned_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE chat_group_members.group_id = chat_pinned_messages.group_id
      AND chat_group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can pin messages"
ON public.chat_pinned_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE chat_group_members.group_id = chat_pinned_messages.group_id
      AND chat_group_members.user_id = auth.uid()
      AND chat_group_members.role IN ('admin', 'owner')
  )
);

CREATE POLICY "Admins can unpin messages"
ON public.chat_pinned_messages FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE chat_group_members.group_id = chat_pinned_messages.group_id
      AND chat_group_members.user_id = auth.uid()
      AND chat_group_members.role IN ('admin', 'owner')
  )
);

-- =============================================
-- Mute per group
-- =============================================
ALTER TABLE public.chat_group_members
ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS muted_until timestamptz;

-- =============================================
-- RPC: increment unread for other members
-- =============================================
CREATE OR REPLACE FUNCTION increment_unread_count(
  p_group_id uuid,
  p_sender_id uuid,
  p_mentioned_users uuid[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chat_group_members
  SET unread_count = unread_count + 1,
      mentioned_count = CASE
        WHEN user_id = ANY(p_mentioned_users) THEN mentioned_count + 1
        ELSE mentioned_count
      END
  WHERE group_id = p_group_id
    AND user_id != p_sender_id;
END;
$$;
