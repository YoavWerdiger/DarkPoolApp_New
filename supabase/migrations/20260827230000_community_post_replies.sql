-- Replies on community microblog posts (in-app, not external X/Twitter)

CREATE TABLE IF NOT EXISTS public.community_post_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_post_replies_body_len CHECK (
    char_length(btrim(body)) >= 1 AND char_length(body) <= 1000
  )
);

CREATE INDEX IF NOT EXISTS idx_community_post_replies_post_created
  ON public.community_post_replies (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_community_post_replies_user_id
  ON public.community_post_replies (user_id);

ALTER TABLE public.community_post_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_post_replies_select ON public.community_post_replies;
CREATE POLICY community_post_replies_select ON public.community_post_replies
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS community_post_replies_insert ON public.community_post_replies;
CREATE POLICY community_post_replies_insert ON public.community_post_replies
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS community_post_replies_update ON public.community_post_replies;
CREATE POLICY community_post_replies_update ON public.community_post_replies
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS community_post_replies_delete ON public.community_post_replies;
CREATE POLICY community_post_replies_delete ON public.community_post_replies
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_app_admin(auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_post_replies TO authenticated;

COMMENT ON TABLE public.community_post_replies IS
  'תגובות לציוצי קהילה — שיחה פנימית באפליקציה';
