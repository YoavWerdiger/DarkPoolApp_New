-- ============================================================================
-- Durable dedup memory for earnings push (reminder + results)
-- Root cause: pending_notifications dedup by earnings_report_id alone is not enough —
-- evening/live sync bumps many rows, sweep re-processes all with actual+recent updated_at,
-- and UUID/delete+insert can reopen the same logical report. Users get a flood of
-- "all today's reports" with no stable memory of what was already notified.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.earnings_notifications_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  report_date date NOT NULL,
  notification_type text NOT NULL
    CHECK (notification_type IN ('reminder_15m', 'results_available')),
  earnings_report_id uuid NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_earnings_notifications_sent_user_ticker_date_type
    UNIQUE (user_id, ticker, report_date, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_earnings_notifications_sent_lookup
  ON public.earnings_notifications_sent (ticker, report_date, notification_type);

CREATE INDEX IF NOT EXISTS idx_earnings_notifications_sent_sent_at
  ON public.earnings_notifications_sent (sent_at DESC);

COMMENT ON TABLE public.earnings_notifications_sent IS
  'Durable per-user memory of earnings pushes (ticker+report_date+type). Survives pending cleanup and calendar row id changes.';

ALTER TABLE public.earnings_notifications_sent ENABLE ROW LEVEL SECURITY;

-- Service role / edge functions only — no client read/write needed
DROP POLICY IF EXISTS earnings_notifications_sent_deny_all ON public.earnings_notifications_sent;
CREATE POLICY earnings_notifications_sent_deny_all
  ON public.earnings_notifications_sent
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

GRANT SELECT, INSERT ON public.earnings_notifications_sent TO service_role;

-- Fast sweep exclusion on calendar rows (broadcast-level marker)
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS results_push_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_push_sent_at timestamptz;

COMMENT ON COLUMN public.earnings_calendar.results_push_sent_at IS
  'Set when results push was enqueued (or claimed) for opted-in users — sweep skips these rows';
COMMENT ON COLUMN public.earnings_calendar.reminder_push_sent_at IS
  'Set when 15m reminder push was enqueued for opted-in users';

CREATE INDEX IF NOT EXISTS idx_earnings_calendar_results_push_pending
  ON public.earnings_calendar (report_date, updated_at DESC)
  WHERE actual IS NOT NULL AND results_push_sent_at IS NULL;

-- Remove historical duplicates before business-key unique index
-- (same user+ticker+date+type with different earnings_report_id — the core spam path)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id,
        upper(data->>'ticker'),
        data->>'report_date',
        data->>'type'
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.pending_notifications
  WHERE notification_type = 'earnings'
    AND data->>'ticker' IS NOT NULL
    AND data->>'report_date' IS NOT NULL
    AND (data->>'type') IN ('earnings', 'earnings_results')
)
DELETE FROM public.pending_notifications pn
USING ranked r
WHERE pn.id = r.id AND r.rn > 1;

-- Secondary pending dedup by durable business key (ticker + date + subtype)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_notifications_earnings_ticker_date_dedup
  ON public.pending_notifications (
    user_id,
    (upper(data->>'ticker')),
    (data->>'report_date'),
    (data->>'type')
  )
  WHERE notification_type = 'earnings'
    AND data->>'ticker' IS NOT NULL
    AND data->>'report_date' IS NOT NULL
    AND (data->>'type') IN ('earnings', 'earnings_results');

-- Seed memory from already-created pending rows (sent or not)
INSERT INTO public.earnings_notifications_sent (
  user_id, ticker, report_date, notification_type, earnings_report_id, sent_at
)
SELECT DISTINCT ON (
  pn.user_id,
  upper(pn.data->>'ticker'),
  (pn.data->>'report_date')::date,
  CASE
    WHEN pn.data->>'type' = 'earnings_results' THEN 'results_available'
    ELSE 'reminder_15m'
  END
)
  pn.user_id,
  upper(pn.data->>'ticker'),
  (pn.data->>'report_date')::date,
  CASE
    WHEN pn.data->>'type' = 'earnings_results' THEN 'results_available'
    ELSE 'reminder_15m'
  END,
  CASE
    WHEN (pn.data->>'earnings_report_id') ~* '^[0-9a-f-]{36}$'
      THEN (pn.data->>'earnings_report_id')::uuid
    ELSE NULL
  END,
  COALESCE(pn.sent_at, pn.created_at, now())
FROM public.pending_notifications pn
WHERE pn.notification_type = 'earnings'
  AND pn.user_id IS NOT NULL
  AND NULLIF(pn.data->>'ticker', '') IS NOT NULL
  AND NULLIF(pn.data->>'report_date', '') IS NOT NULL
  AND (pn.data->>'type') IN ('earnings', 'earnings_results')
  AND (pn.data->>'report_date') ~ '^\d{4}-\d{2}-\d{2}'
ORDER BY
  pn.user_id,
  upper(pn.data->>'ticker'),
  (pn.data->>'report_date')::date,
  CASE
    WHEN pn.data->>'type' = 'earnings_results' THEN 'results_available'
    ELSE 'reminder_15m'
  END,
  pn.created_at ASC
ON CONFLICT (user_id, ticker, report_date, notification_type) DO NOTHING;

-- Mark calendar rows that already have any results claim
UPDATE public.earnings_calendar ec
SET results_push_sent_at = COALESCE(ec.results_push_sent_at, sub.first_sent)
FROM (
  SELECT ticker, report_date, MIN(sent_at) AS first_sent
  FROM public.earnings_notifications_sent
  WHERE notification_type = 'results_available'
  GROUP BY ticker, report_date
) sub
WHERE upper(COALESCE(ec.ticker, replace(ec.code, '.US', ''))) = sub.ticker
  AND ec.report_date = sub.report_date
  AND ec.results_push_sent_at IS NULL;

UPDATE public.earnings_calendar ec
SET reminder_push_sent_at = COALESCE(ec.reminder_push_sent_at, sub.first_sent)
FROM (
  SELECT ticker, report_date, MIN(sent_at) AS first_sent
  FROM public.earnings_notifications_sent
  WHERE notification_type = 'reminder_15m'
  GROUP BY ticker, report_date
) sub
WHERE upper(COALESCE(ec.ticker, replace(ec.code, '.US', ''))) = sub.ticker
  AND ec.report_date = sub.report_date
  AND ec.reminder_push_sent_at IS NULL;

-- Stop the Aug-11-style backlog from flushing overnight spam to devices
UPDATE public.pending_notifications
SET
  is_sent = true,
  sent_at = COALESCE(sent_at, now())
WHERE notification_type = 'earnings'
  AND is_sent = false
  AND data->>'type' = 'earnings_results'
  AND created_at < now() - interval '2 hours';
