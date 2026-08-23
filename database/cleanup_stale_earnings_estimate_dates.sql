-- Cleanup: delete estimate-only earnings_calendar rows superseded by a nearby
-- confirmed report (actual IS NOT NULL) for the same ticker within ±21 days.
-- Root cause: upserts are unique on (ticker, report_date), so date revisions
-- leave orphan estimate days (e.g. MCD 2026-08-05/10/14 next to 2026-08-04 actuals).
--
-- Safe to re-run. Does NOT delete future-quarter estimates far from a confirmed date.

BEGIN;

WITH stale AS (
  SELECT ec.id
  FROM earnings_calendar ec
  WHERE ec.actual IS NULL
    AND EXISTS (
      SELECT 1
      FROM earnings_calendar confirmed
      WHERE UPPER(COALESCE(confirmed.ticker, split_part(confirmed.code, '.', 1)))
          = UPPER(COALESCE(ec.ticker, split_part(ec.code, '.', 1)))
        AND confirmed.actual IS NOT NULL
        AND confirmed.id <> ec.id
        AND confirmed.report_date BETWEEN (ec.report_date - 21)
                                     AND (ec.report_date + 21)
    )
)
DELETE FROM earnings_calendar e
USING stale
WHERE e.id = stale.id;

COMMIT;

-- Verify MCD around early August:
-- SELECT report_date, actual, estimate, before_after_market, source, updated_at
-- FROM earnings_calendar
-- WHERE UPPER(COALESCE(ticker, split_part(code, '.', 1))) = 'MCD'
--   AND report_date BETWEEN '2026-08-01' AND '2026-08-20'
-- ORDER BY report_date;
