-- ============================================================================
-- 067_person_portraits.sql
-- Cache תמונות פרופיל לפוליטיקאים / בכירים — congress + Wikipedia + known.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dark_pool_person_portraits (
  person_id     TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('politician', 'insider', 'fund_manager')),
  display_name  TEXT,
  ticker        TEXT,
  image_url     TEXT,
  source        TEXT CHECK (source IN ('congress', 'wikipedia', 'known', 'manual', 'none')),
  lookup_name   TEXT,
  fail_count    INT NOT NULL DEFAULT 0,
  last_error    TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dppp_kind ON public.dark_pool_person_portraits (kind);
CREATE INDEX IF NOT EXISTS idx_dppp_ticker ON public.dark_pool_person_portraits (ticker)
  WHERE ticker IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dppp_unresolved ON public.dark_pool_person_portraits (resolved_at)
  WHERE image_url IS NULL AND fail_count < 5;

COMMENT ON TABLE public.dark_pool_person_portraits IS
  'תמונות פרופיל ממוזגות — congress / Wikipedia / known. Client קורא מכאן בלבד.';

ALTER TABLE public.dark_pool_person_portraits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dppp_public_select ON public.dark_pool_person_portraits;
CREATE POLICY dppp_public_select ON public.dark_pool_person_portraits
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.dark_pool_person_portraits TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_person_portrait_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dppp_updated ON public.dark_pool_person_portraits;
CREATE TRIGGER trg_dppp_updated
  BEFORE UPDATE ON public.dark_pool_person_portraits
  FOR EACH ROW EXECUTE FUNCTION public.touch_person_portrait_updated_at();
