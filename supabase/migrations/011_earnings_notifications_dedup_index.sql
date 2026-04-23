-- מניעת כפילות התראות earnings לאותו משתמש+דיווח+סוג (upcoming vs results)
-- דורשת ש-data->>'earnings_report_id' ו-data->>'type' ממולאים (Edge functions מעדכנים בהתאם)

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_notifications_earnings_dedup
  ON public.pending_notifications (
    user_id,
    (data->>'earnings_report_id'),
    (data->>'type')
  )
  WHERE notification_type = 'earnings'
    AND data->>'earnings_report_id' IS NOT NULL
    AND (data->>'type') IN ('earnings', 'earnings_results');

COMMENT ON INDEX idx_pending_notifications_earnings_dedup IS
  'User should receive at most one upcoming and one results push per earnings_calendar row';
