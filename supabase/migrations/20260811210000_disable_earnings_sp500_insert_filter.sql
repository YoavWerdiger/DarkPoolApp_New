-- Full earnings calendar: stop silently dropping non-S&P 500 inserts (e.g. QUBT).
-- Previous behavior (migrations 025 + 20260809160000) kept only S&P 500 on INSERT.

DROP TRIGGER IF EXISTS earnings_calendar_sp500_filter ON public.earnings_calendar;

CREATE OR REPLACE FUNCTION public.filter_earnings_sp500_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No-op: full US calendar (client has no market-cap filter).
  -- To re-enable S&P-only inserts, restore trigger from migration 025.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.filter_earnings_sp500_only() IS
  'No-op since 2026-08-11 — was S&P500 INSERT filter; dropped trigger earnings_calendar_sp500_filter for full calendar.';
