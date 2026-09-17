-- User-to-user follows for community feed "Following" tab
CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT user_follows_no_self CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower
  ON public.user_follows (follower_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_following
  ON public.user_follows (following_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_follows_select ON public.user_follows;
CREATE POLICY user_follows_select ON public.user_follows
  FOR SELECT TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid());

DROP POLICY IF EXISTS user_follows_insert ON public.user_follows;
CREATE POLICY user_follows_insert ON public.user_follows
  FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS user_follows_delete ON public.user_follows;
CREATE POLICY user_follows_delete ON public.user_follows
  FOR DELETE TO authenticated
  USING (follower_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.user_follows TO authenticated;

COMMENT ON TABLE public.user_follows IS
  'מעקב אחרי משתמשים — לפיד «עוקבים» בציוצי קהילה';
