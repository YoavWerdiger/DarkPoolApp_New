-- מתג נפרד «מדד הפחד והתאווה» בסקשן «חדשות» בהגדרות ההתראות (ברירת מחדל: דלוק).
alter table public.user_notification_settings
  add column if not exists fear_greed_notifications boolean not null default true;

CREATE OR REPLACE FUNCTION public.user_allows_notification(p_user_id uuid, p_kind text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.user_notification_settings%ROWTYPE;
  v_kind text := lower(btrim(COALESCE(p_kind, '')));
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT * INTO r FROM public.user_notification_settings WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  IF r.notifications_enabled IS FALSE THEN
    RETURN false;
  END IF;
  CASE
    WHEN v_kind = 'chat_message' THEN RETURN COALESCE(r.message_notifications, true);
    WHEN v_kind = 'news' THEN RETURN COALESCE(r.news_notifications, true);
    WHEN v_kind = 'fear_greed' THEN RETURN COALESCE(r.fear_greed_notifications, true);
    WHEN v_kind IN ('earnings', 'earnings_results') THEN RETURN COALESCE(r.earnings_notifications, true);
    WHEN v_kind IN ('economic_calendar', 'economic_result') THEN RETURN COALESCE(r.economic_calendar_notifications, true);
    WHEN v_kind IN ('dark_pool_person_trade', 'dark_pool_fund_13f', 'dark_pool_follow') THEN RETURN COALESCE(r.dark_pool_notifications, true);
    WHEN v_kind = 'dark_pool_feed_trade' THEN RETURN COALESCE(r.insider_feed_alerts, false);
    WHEN v_kind = 'dark_pool_signal' THEN RETURN COALESCE(r.dark_pool_ticker_alerts, true);
    WHEN v_kind IN ('community_mention', 'community_post') THEN RETURN COALESCE(r.community_notifications, true);
    WHEN v_kind = 'watchlist_alert' THEN RETURN COALESCE(r.watchlist_notifications, true);
    ELSE RETURN true;
  END CASE;
END;
$function$;
