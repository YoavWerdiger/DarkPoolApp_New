-- ============================================================================
-- 056_news_push_queue_cleanup.sql
-- ניקוי תור התראות ישן שלא נשלח (מונע הצפה בטלפון).
--
-- אחרי הרצה:
--   SELECT public.invoke_process_pending_notifications();
-- ============================================================================

-- סמן כ"טופל" כל מה שלא נשלח מעל 2 שעות (לא יישלח לטלפון)
UPDATE public.pending_notifications
SET
  is_sent = true,
  sent_at = NOW()
WHERE is_sent = false
  AND created_at < NOW() - INTERVAL '2 hours';

-- אינדקס לשליפה מהירה של תור פעיל
CREATE INDEX IF NOT EXISTS idx_pending_notifications_active_created
  ON public.pending_notifications (created_at DESC)
  WHERE is_sent = false;

COMMENT ON INDEX idx_pending_notifications_active_created IS
  'תור התראות פעיל — process-pending-notifications';
