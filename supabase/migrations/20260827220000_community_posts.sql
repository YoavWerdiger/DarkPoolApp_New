-- Community microblog posts (in-app member tweets — not external news)
-- Authenticated members can read all posts; authors manage their own rows.

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_posts_body_len CHECK (
    char_length(btrim(body)) >= 1 AND char_length(body) <= 2000
  )
);

CREATE INDEX IF NOT EXISTS idx_community_posts_created_at
  ON public.community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id
  ON public.community_posts (user_id);

CREATE TABLE IF NOT EXISTS public.community_post_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_post_likes_user_id
  ON public.community_post_likes (user_id);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_posts_select ON public.community_posts;
CREATE POLICY community_posts_select ON public.community_posts
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS community_posts_insert ON public.community_posts;
CREATE POLICY community_posts_insert ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS community_posts_update ON public.community_posts;
CREATE POLICY community_posts_update ON public.community_posts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS community_posts_delete ON public.community_posts;
CREATE POLICY community_posts_delete ON public.community_posts
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_app_admin(auth.uid())
  );

DROP POLICY IF EXISTS community_post_likes_select ON public.community_post_likes;
CREATE POLICY community_post_likes_select ON public.community_post_likes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS community_post_likes_insert ON public.community_post_likes;
CREATE POLICY community_post_likes_insert ON public.community_post_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS community_post_likes_delete ON public.community_post_likes;
CREATE POLICY community_post_likes_delete ON public.community_post_likes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_post_likes TO authenticated;

COMMENT ON TABLE public.community_posts IS
  'פיד ציוצים/פוסטים של חברי הקהילה — בלוג פנימי, לא חדשות חיצוניות';

-- Realtime for live feed updates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'community_posts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
    END IF;
  END IF;
END $$;
