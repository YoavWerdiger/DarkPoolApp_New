-- הרחבת user_notification_settings למקורות שכבר שולחים בפועל
-- (דארק פול / קהילה / רשימת מעקב) + שער אחיד לפני pending_notifications.

ALTER TABLE public.user_notification_settings
  ADD COLUMN IF NOT EXISTS dark_pool_notifications BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS dark_pool_ticker_alerts BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS community_notifications BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS watchlist_notifications BOOLEAN DEFAULT true NOT NULL;

COMMENT ON COLUMN public.user_notification_settings.dark_pool_notifications IS
  'עסקאות ודיווחים של אנשים במעקב (קונגרס / אינסיידר / 13F)';
COMMENT ON COLUMN public.user_notification_settings.dark_pool_ticker_alerts IS
  'סיגנלי זרימה על טיקרים ב-dark_pool_watchlists';
COMMENT ON COLUMN public.user_notification_settings.community_notifications IS
  'תיוגים וציוצי קהילה';
COMMENT ON COLUMN public.user_notification_settings.watchlist_notifications IS
  'התראות מחיר ברשימת המעקב';

CREATE OR REPLACE FUNCTION public.user_allows_notification(p_user_id uuid, p_kind text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.user_notification_settings%ROWTYPE;
  v_kind text := lower(btrim(COALESCE(p_kind, '')));
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO r
  FROM public.user_notification_settings
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF r.notifications_enabled IS FALSE THEN
    RETURN false;
  END IF;

  CASE
    WHEN v_kind = 'chat_message' THEN
      RETURN COALESCE(r.message_notifications, true);
    WHEN v_kind = 'news' THEN
      RETURN COALESCE(r.news_notifications, true);
    WHEN v_kind IN ('earnings', 'earnings_results') THEN
      RETURN COALESCE(r.earnings_notifications, true);
    WHEN v_kind IN ('economic_calendar', 'economic_result') THEN
      RETURN COALESCE(r.economic_calendar_notifications, true);
    WHEN v_kind IN ('dark_pool_person_trade', 'dark_pool_fund_13f', 'dark_pool_follow') THEN
      RETURN COALESCE(r.dark_pool_notifications, true);
    WHEN v_kind = 'dark_pool_signal' THEN
      RETURN COALESCE(r.dark_pool_ticker_alerts, true);
    WHEN v_kind IN ('community_mention', 'community_post') THEN
      RETURN COALESCE(r.community_notifications, true);
    WHEN v_kind = 'watchlist_alert' THEN
      RETURN COALESCE(r.watchlist_notifications, true);
    ELSE
      RETURN true;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.user_allows_notification(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_allows_notification(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.pending_notifications_respect_prefs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_allows_notification(NEW.user_id, NEW.notification_type) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_notifications_respect_prefs ON public.pending_notifications;
CREATE TRIGGER trg_pending_notifications_respect_prefs
  BEFORE INSERT ON public.pending_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.pending_notifications_respect_prefs();

COMMENT ON FUNCTION public.user_allows_notification(uuid, text) IS
  'מאסטר + קטגוריה מ-user_notification_settings. חסר שורה = מותר.';
