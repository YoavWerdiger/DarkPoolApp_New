-- ============================================================================
-- Admin panel foundation
-- - mute / suspend fields on users
-- - audit log for admin actions
-- - push campaigns history
-- - helper: is_app_admin()
-- ============================================================================

-- Admin check used by RLS / SECURITY DEFINER helpers
CREATE OR REPLACE FUNCTION public.is_app_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = uid
      AND lower(COALESCE(u.subscription_role, '')) IN ('admin', 'super_admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_app_admin(uuid) TO authenticated, service_role;

-- Mute / moderation fields
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muted_at timestamptz,
  ADD COLUMN IF NOT EXISTS muted_reason text,
  ADD COLUMN IF NOT EXISTS muted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_is_muted ON public.users(is_muted) WHERE is_muted = true;
CREATE INDEX IF NOT EXISTS idx_users_is_suspended ON public.users(is_suspended) WHERE is_suspended = true;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_subscription_role ON public.users(subscription_role);

-- Audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log(action);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can read audit log"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin(auth.uid()));

-- Inserts only via service role / edge functions
DROP POLICY IF EXISTS "No direct client inserts to audit" ON public.admin_audit_log;

-- Push campaigns
CREATE TABLE IF NOT EXISTS public.admin_push_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  audience text NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all', 'free', 'premium', 'active_7d', 'custom')),
  target_user_ids uuid[] NULL,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_admin_push_campaigns_created_at
  ON public.admin_push_campaigns(created_at DESC);

ALTER TABLE public.admin_push_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read push campaigns" ON public.admin_push_campaigns;
CREATE POLICY "Admins can read push campaigns"
  ON public.admin_push_campaigns
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin(auth.uid()));

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT SELECT ON public.admin_push_campaigns TO authenticated;
