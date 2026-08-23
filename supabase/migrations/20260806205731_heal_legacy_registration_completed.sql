-- Heal users stuck with registration_completed=false who are clearly not mid-onboarding.
-- Keeps fresh pending signups (created in last 6h without completion evidence) on onboarding.

UPDATE public.users u
SET
  registration_completed = TRUE,
  updated_at = NOW()
WHERE u.registration_completed IS DISTINCT FROM TRUE
  AND (
    -- Questionnaire / intro already saved
    (
      u.intro_data IS NOT NULL
      AND jsonb_typeof(u.intro_data) = 'object'
      AND u.intro_data <> '{}'::jsonb
      AND (
        u.intro_data ? 'age_range'
        OR u.intro_data ? 'experience_level'
        OR u.intro_data ? 'trading_focus'
        OR u.intro_data ? 'experience'
        OR u.intro_data ? 'markets'
        OR u.intro_data ? 'level'
        OR u.intro_data ? 'goal'
      )
    )
    -- Successful payment
    OR EXISTS (
      SELECT 1
      FROM public.payment_transactions p
      WHERE p.user_id = u.id
        AND p.status = 'success'
    )
    -- Active paid subscription
    OR EXISTS (
      SELECT 1
      FROM public.user_subscriptions s
      WHERE s.user_id = u.id
        AND s.status = 'active'
        AND s.plan_id IS DISTINCT FROM 'free'
    )
    -- Legacy accounts created before the pending-auth / registration gate
    OR u.created_at < NOW() - INTERVAL '6 hours'
  );
