-- Multiple entity embeds + @mentions on community posts.
-- Keeps legacy `attachment` (single jsonb) in sync for older clients.

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS mentions jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.community_posts.attachments IS
  'ShareableAttachment[] snapshots (v1) — multiple embeds per post';
COMMENT ON COLUMN public.community_posts.mentions IS
  'CommunityPostMention[] — { userId, displayName } tagged members';

-- Backfill from single attachment only when attachments is still empty
UPDATE public.community_posts
SET attachments = jsonb_build_array(attachment)
WHERE attachment IS NOT NULL
  AND jsonb_typeof(attachment) = 'object'
  AND (
    attachments IS NULL
    OR attachments = '[]'::jsonb
    OR jsonb_array_length(attachments) = 0
  );

-- Soft guard: attachments must be a JSON array
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_posts_attachments_is_array'
      AND conrelid = 'public.community_posts'::regclass
  ) THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_attachments_is_array
      CHECK (jsonb_typeof(attachments) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_posts_mentions_is_array'
      AND conrelid = 'public.community_posts'::regclass
  ) THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_mentions_is_array
      CHECK (jsonb_typeof(mentions) = 'array');
  END IF;
END $$;
