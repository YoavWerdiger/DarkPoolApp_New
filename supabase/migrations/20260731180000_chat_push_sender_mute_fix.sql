-- Chat push: exclude sender + muted members reliably; stop shared Expo tokens
-- from delivering another account's notification to the physical device.

-- 1) One-time cleanup: keep newest active row per expo_push_token
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY expo_push_token
      ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.device_tokens
  WHERE is_active = true
)
UPDATE public.device_tokens dt
SET is_active = false,
    updated_at = timezone('utc', now())
FROM ranked
WHERE dt.id = ranked.id
  AND ranked.rn > 1;

-- 2) Enforce: at most one active account per Expo push token
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_one_active_per_expo_token
  ON public.device_tokens (expo_push_token)
  WHERE is_active = true;

-- 3) SECURITY DEFINER claim — client RLS cannot update other users' token rows
CREATE OR REPLACE FUNCTION public.claim_device_push_token(
  p_expo_push_token text,
  p_device_id text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_app_version text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing_id uuid;
BEGIN
  IF v_uid IS NULL OR coalesce(trim(p_expo_push_token), '') = '' THEN
    RETURN false;
  END IF;

  -- Release this physical device from every other account
  UPDATE public.device_tokens
  SET is_active = false,
      updated_at = timezone('utc', now())
  WHERE expo_push_token = p_expo_push_token
    AND user_id IS DISTINCT FROM v_uid
    AND is_active = true;

  -- Prefer a single active token per user
  UPDATE public.device_tokens
  SET is_active = false,
      updated_at = timezone('utc', now())
  WHERE user_id = v_uid
    AND expo_push_token IS DISTINCT FROM p_expo_push_token
    AND is_active = true;

  SELECT id INTO v_existing_id
  FROM public.device_tokens
  WHERE user_id = v_uid
    AND expo_push_token = p_expo_push_token
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.device_tokens
    SET is_active = true,
        device_id = COALESCE(p_device_id, device_id),
        platform = COALESCE(p_platform, platform),
        app_version = COALESCE(p_app_version, app_version),
        updated_at = timezone('utc', now())
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.device_tokens (
      user_id, expo_push_token, device_id, platform, app_version, is_active
    ) VALUES (
      v_uid, p_expo_push_token, p_device_id, p_platform, p_app_version, true
    );
  END IF;

  RETURN true;
EXCEPTION
  WHEN unique_violation THEN
    -- Race on partial unique index: retry deactivate + activate own row
    UPDATE public.device_tokens
    SET is_active = false,
        updated_at = timezone('utc', now())
    WHERE expo_push_token = p_expo_push_token
      AND user_id IS DISTINCT FROM v_uid
      AND is_active = true;

    UPDATE public.device_tokens
    SET is_active = true,
        device_id = COALESCE(p_device_id, device_id),
        platform = COALESCE(p_platform, platform),
        app_version = COALESCE(p_app_version, app_version),
        updated_at = timezone('utc', now())
    WHERE user_id = v_uid
      AND expo_push_token = p_expo_push_token;

    IF FOUND THEN
      RETURN true;
    END IF;

    INSERT INTO public.device_tokens (
      user_id, expo_push_token, device_id, platform, app_version, is_active
    ) VALUES (
      v_uid, p_expo_push_token, p_device_id, p_platform, p_app_version, true
    )
    ON CONFLICT (user_id, expo_push_token) DO UPDATE
    SET is_active = true,
        device_id = COALESCE(EXCLUDED.device_id, public.device_tokens.device_id),
        platform = COALESCE(EXCLUDED.platform, public.device_tokens.platform),
        app_version = COALESCE(EXCLUDED.app_version, public.device_tokens.app_version),
        updated_at = timezone('utc', now());

    RETURN true;
  WHEN OTHERS THEN
    RAISE WARNING 'claim_device_push_token failed: %', SQLERRM;
    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_device_push_token(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_device_push_token(text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.claim_device_push_token IS
  'Registers the caller''s Expo push token and deactivates the same token for other users (bypasses RLS).';

-- 4) Mute: keep muted + is_muted in sync; only the member themselves may toggle
CREATE OR REPLACE FUNCTION public.toggle_group_mute(
  p_group_id uuid,
  p_user_id uuid,
  p_muted boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized to toggle mute for another user';
  END IF;

  UPDATE public.chat_group_members
  SET muted = p_muted,
      is_muted = p_muted,
      notifications_enabled = NOT p_muted
  WHERE group_id = p_group_id
    AND user_id = p_user_id;

  RETURN FOUND;
END;
$$;

-- Backfill legacy is_muted from muted (source of truth used by app + notify path)
UPDATE public.chat_group_members
SET is_muted = muted
WHERE COALESCE(is_muted, false) IS DISTINCT FROM COALESCE(muted, false);
