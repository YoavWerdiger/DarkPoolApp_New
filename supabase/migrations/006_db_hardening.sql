-- =============================================
-- Soft delete timestamp (instead of just boolean)
-- =============================================
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Backfill existing soft-deleted messages
UPDATE public.chat_messages
SET deleted_at = COALESCE(edited_at, created_at)
WHERE is_deleted = true AND deleted_at IS NULL;

-- =============================================
-- Message length constraint (idempotent)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_message_content_length'
  ) THEN
    ALTER TABLE public.chat_messages
    ADD CONSTRAINT chk_message_content_length
    CHECK (content IS NULL OR char_length(content) <= 10000);
  END IF;
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'Skipping chk_message_content_length – existing data violates constraint';
END $$;

-- =============================================
-- Archive function for old messages
-- =============================================
CREATE TABLE IF NOT EXISTS public.chat_messages_archive (
  LIKE public.chat_messages INCLUDING ALL
);

CREATE OR REPLACE FUNCTION archive_old_messages(months_old integer DEFAULT 6)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archived_count integer;
BEGIN
  WITH moved AS (
    DELETE FROM public.chat_messages
    WHERE created_at < now() - (months_old || ' months')::interval
      AND is_deleted = true
    RETURNING *
  )
  INSERT INTO public.chat_messages_archive
  SELECT * FROM moved;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;

-- =============================================
-- Cleanup function
-- =============================================
CREATE OR REPLACE FUNCTION auto_cleanup_expired_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 hour';
  DELETE FROM public.chat_typing_indicators WHERE started_typing_at < now() - interval '30 seconds';
END;
$$;

-- =============================================
-- Additional constraints for data integrity
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_member_role'
  ) THEN
    ALTER TABLE public.chat_group_members
    ADD CONSTRAINT chk_member_role
    CHECK (role IN ('member', 'admin', 'owner'));
  END IF;
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'Skipping chk_member_role – existing data violates constraint';
END $$;

-- Note: chat_groups uses JSONB settings for group type, no column-level constraint needed
