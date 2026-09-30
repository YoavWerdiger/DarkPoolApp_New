-- פיד אינסיידרים: כל עסקת קונגרס / Form 4 חדשה, רק למי שהדליק את המתג.
-- ברירת המחדל כבויה. אנשים במעקב נשארים על הפונקציות הקיימות (קנייה/מכירה + 13F).

ALTER TABLE public.user_notification_settings
  ADD COLUMN IF NOT EXISTS insider_feed_alerts boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_notification_settings.insider_feed_alerts IS
  'התראה על כל עסקה חדשה בפיד אינסיידרים (קונגרס + Form 4). כבוי כברירת מחדל.';

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
    WHEN v_kind = 'dark_pool_feed_trade' THEN
      RETURN COALESCE(r.insider_feed_alerts, false);
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

CREATE OR REPLACE FUNCTION public.enqueue_insider_feed_trade(
  p_article text,
  p_title text,
  p_body text,
  p_data jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.pending_notifications (
    user_id, title, body, data, notification_type, article_id
  )
  SELECT DISTINCT ON (uns.user_id)
    uns.user_id,
    p_title,
    p_body,
    p_data,
    'dark_pool_feed_trade',
    p_article
  FROM public.user_notification_settings uns
  INNER JOIN public.device_tokens dt
    ON dt.user_id = uns.user_id AND dt.is_active = true
  WHERE uns.insider_feed_alerts IS TRUE
    AND COALESCE(uns.notifications_enabled, true)
    AND NOT EXISTS (
      SELECT 1
      FROM public.pending_notifications pn
      WHERE pn.user_id = uns.user_id
        AND pn.article_id = p_article
    )
  ORDER BY uns.user_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_insider_feed_trade(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_insider_feed_trade(text, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_followed_congress_trade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn   TEXT;
  v_title TEXT;
  v_body  TEXT;
  v_article TEXT;
  v_action_he TEXT;
  v_rows integer;
  v_sent integer := 0;
BEGIN
  v_txn := lower(COALESCE(NEW.transaction_type, ''));
  IF v_txn NOT IN ('buy', 'sell') THEN
    RETURN NEW;
  END IF;

  IF NEW.filed_at IS NULL OR NEW.filed_at < NOW() - INTERVAL '14 days' THEN
    RETURN NEW;
  END IF;

  v_action_he := CASE WHEN v_txn = 'sell' THEN 'מכירה' ELSE 'רכישה' END;
  v_article := 'dpct:' || COALESCE(NEW.external_id, NEW.id::text);
  v_title := v_action_he || ' חדשה · ' || COALESCE(NEW.politician_name, 'פוליטיקאי');
  v_body :=
    public.push_notification_ltr(upper(COALESCE(NEW.ticker, '')))
    || CASE
         WHEN NULLIF(btrim(COALESCE(NEW.amount_label, '')), '') IS NOT NULL
           THEN ' · ' || public.push_notification_ltr(NEW.amount_label)
         ELSE ''
       END;

  INSERT INTO public.pending_notifications (
    user_id, title, body, data, notification_type, article_id
  )
  SELECT DISTINCT ON (f.user_id)
    f.user_id,
    v_title,
    v_body,
    jsonb_build_object(
      'type', 'dark_pool_person_trade',
      'person_id', f.person_id,
      'person_kind', 'politician',
      'person_name', COALESCE(NULLIF(btrim(f.name), ''), NEW.politician_name),
      'ticker', NEW.ticker,
      'transaction_type', v_txn,
      'trade_id', NEW.id::text
    ),
    'dark_pool_person_trade',
    v_article
  FROM public.dark_pool_followed_investors f
  INNER JOIN public.device_tokens dt ON dt.user_id = f.user_id AND dt.is_active = true
  LEFT JOIN public.user_notification_settings uns ON uns.user_id = f.user_id
  WHERE f.kind = 'politician'
    AND COALESCE(uns.notifications_enabled, true)
    AND (
      f.person_id = NEW.politician_id
      OR (
        NULLIF(btrim(COALESCE(NEW.politician_name, '')), '') IS NOT NULL
        AND lower(btrim(f.name)) = lower(btrim(NEW.politician_name))
      )
      OR EXISTS (
        SELECT 1
        FROM public.dark_pool_congress_trades alias
        WHERE alias.politician_id = f.person_id
          AND NULLIF(btrim(COALESCE(NEW.politician_name, '')), '') IS NOT NULL
          AND lower(btrim(alias.politician_name)) = lower(btrim(NEW.politician_name))
        LIMIT 1
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.pending_notifications pn
      WHERE pn.user_id = f.user_id
        AND pn.notification_type = 'dark_pool_person_trade'
        AND pn.article_id = v_article
    )
  ORDER BY f.user_id, f.created_at DESC;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_sent := v_sent + COALESCE(v_rows, 0);

  IF NULLIF(btrim(COALESCE(NEW.politician_id, '')), '') IS NOT NULL THEN
    v_sent := v_sent + public.enqueue_insider_feed_trade(
      v_article,
      v_title,
      v_body,
      jsonb_build_object(
        'type', 'dark_pool_feed_trade',
        'person_id', NEW.politician_id,
        'person_kind', 'politician',
        'person_name', NEW.politician_name,
        'ticker', NEW.ticker,
        'transaction_type', v_txn,
        'trade_id', NEW.id::text
      )
    );
  END IF;

  IF v_sent > 0 THEN
    PERFORM public.invoke_process_pending_notifications_best_effort();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_followed_insider_buy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_txn  TEXT;
  v_title TEXT;
  v_body  TEXT;
  v_article TEXT;
  v_name TEXT;
  v_person_key TEXT;
  v_action_he TEXT;
  v_rows integer;
  v_sent integer := 0;
BEGIN
  v_code := upper(COALESCE(NEW.transaction_type, ''));
  IF v_code NOT IN ('P', 'S') THEN
    RETURN NEW;
  END IF;

  IF NEW.filed_at IS NULL OR NEW.filed_at < NOW() - INTERVAL '14 days' THEN
    RETURN NEW;
  END IF;

  v_name := btrim(COALESCE(NEW.insider_name, ''));
  IF v_name = '' THEN
    RETURN NEW;
  END IF;

  v_txn := CASE WHEN v_code = 'S' THEN 'sell' ELSE 'buy' END;
  v_action_he := CASE WHEN v_code = 'S' THEN 'מכירה' ELSE 'רכישה' END;
  v_person_key := upper(COALESCE(NEW.ticker, '')) || ':' || v_name;
  v_article := 'dpi:' || COALESCE(NEW.source, 'src') || ':' || COALESCE(NEW.external_id, NEW.id::text);
  v_title := v_action_he || ' חדשה · ' || v_name;
  v_body :=
    public.push_notification_ltr(upper(COALESCE(NEW.ticker, '')))
    || CASE
         WHEN COALESCE(NEW.value, 0) > 0
           THEN ' · ' || public.push_notification_ltr('$' || trim(to_char(NEW.value, 'FM999,999,999,999')))
         ELSE ''
       END;

  INSERT INTO public.pending_notifications (
    user_id, title, body, data, notification_type, article_id
  )
  SELECT DISTINCT ON (f.user_id)
    f.user_id,
    v_title,
    v_body,
    jsonb_build_object(
      'type', 'dark_pool_person_trade',
      'person_id', f.person_id,
      'person_kind', 'insider',
      'person_name', COALESCE(NULLIF(btrim(f.name), ''), v_name),
      'ticker', NEW.ticker,
      'transaction_type', v_txn,
      'trade_id', NEW.id::text
    ),
    'dark_pool_person_trade',
    v_article
  FROM public.dark_pool_followed_investors f
  INNER JOIN public.device_tokens dt ON dt.user_id = f.user_id AND dt.is_active = true
  LEFT JOIN public.user_notification_settings uns ON uns.user_id = f.user_id
  WHERE f.kind = 'insider'
    AND COALESCE(uns.notifications_enabled, true)
    AND (
      f.person_id = v_person_key
      OR f.person_id = NEW.ticker || ':' || v_name
      OR (
        lower(btrim(f.name)) = lower(v_name)
        AND (f.ticker IS NULL OR f.ticker = '' OR upper(f.ticker) = upper(NEW.ticker))
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.pending_notifications pn
      WHERE pn.user_id = f.user_id
        AND pn.notification_type = 'dark_pool_person_trade'
        AND pn.article_id = v_article
    )
  ORDER BY f.user_id, f.created_at DESC;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_sent := v_sent + COALESCE(v_rows, 0);

  v_sent := v_sent + public.enqueue_insider_feed_trade(
    v_article,
    v_title,
    v_body,
    jsonb_build_object(
      'type', 'dark_pool_feed_trade',
      'person_id', v_person_key,
      'person_kind', 'insider',
      'person_name', v_name,
      'ticker', NEW.ticker,
      'transaction_type', v_txn,
      'trade_id', NEW.id::text
    )
  );

  IF v_sent > 0 THEN
    PERFORM public.invoke_process_pending_notifications_best_effort();
  END IF;

  RETURN NEW;
END;
$$;
