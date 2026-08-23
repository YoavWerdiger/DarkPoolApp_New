-- Fix: the same Expo push token could be is_active=true under multiple user_ids
-- (account switching / reinstall on the same device). That caused the physical
-- device to receive chat push notifications meant for a *different* account —
-- e.g. a push for a message you sent yourself, or for a group you muted.
--
-- A device (Expo token) must map to exactly one active account. Deactivate all
-- duplicate active rows for a token, keeping only the most recently updated one.

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
SET is_active = false
FROM ranked
WHERE dt.id = ranked.id
  AND ranked.rn > 1;
