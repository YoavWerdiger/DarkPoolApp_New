-- מעקב אחרי פוליטיקאים / בכירים (social investing — לא תיקי Portfolios)

CREATE TABLE IF NOT EXISTS public.dark_pool_followed_investors (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id   TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('politician', 'insider')),
  name        TEXT NOT NULL DEFAULT '',
  image_url   TEXT,
  ticker      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, person_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_dpfi_user_created
  ON public.dark_pool_followed_investors(user_id, created_at DESC);

COMMENT ON TABLE public.dark_pool_followed_investors IS 'משקיעים/בכירים שהמשתמש עוקב אחריהם במודול Dark Pool';

ALTER TABLE public.dark_pool_followed_investors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dpfi_owner_select ON public.dark_pool_followed_investors;
CREATE POLICY dpfi_owner_select ON public.dark_pool_followed_investors
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS dpfi_owner_insert ON public.dark_pool_followed_investors;
CREATE POLICY dpfi_owner_insert ON public.dark_pool_followed_investors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dpfi_owner_delete ON public.dark_pool_followed_investors;
CREATE POLICY dpfi_owner_delete ON public.dark_pool_followed_investors
  FOR DELETE USING (auth.uid() = user_id);
