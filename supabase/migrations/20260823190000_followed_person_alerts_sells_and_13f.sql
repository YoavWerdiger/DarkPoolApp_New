-- הרחבת התראות מעקב Dark Pool:
-- 1) קונגרס: buy + sell (+ התאמת person_id לפי שם / מזהה חלופי)
-- 2) בכירים: Form 4 P + S
-- 3) מנהלי קרנות: דיווח 13F חדש כש־last_filing_date מתקדם

-- ---------------------------------------------------------------------------
-- קונגרס — רכישה / מכירה
-- ---------------------------------------------------------------------------
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

  IF FOUND THEN
    PERFORM public.invoke_process_pending_notifications_best_effort();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_followed_congress_trade ON public.dark_pool_congress_trades;
CREATE TRIGGER trg_notify_followed_congress_trade
  AFTER INSERT ON public.dark_pool_congress_trades
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followed_congress_trade();

COMMENT ON FUNCTION public.notify_followed_congress_trade IS
  'Push למשתמשים שעוקבים אחרי פוליטיקאי — רכישה או מכירה חדשה (חלון 14 יום; התאמת מזהה/שם).';

-- ---------------------------------------------------------------------------
-- בכירים — Form 4 P (רכישה) + S (מכירה)
-- ---------------------------------------------------------------------------
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

  IF FOUND THEN
    PERFORM public.invoke_process_pending_notifications_best_effort();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_followed_insider_buy ON public.dark_pool_insider_buys;
CREATE TRIGGER trg_notify_followed_insider_buy
  AFTER INSERT ON public.dark_pool_insider_buys
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followed_insider_buy();

COMMENT ON FUNCTION public.notify_followed_insider_buy IS
  'Push למשתמשים שעוקבים אחרי בכיר — רכישת Form 4 (P) או מכירה (S), חלון 14 יום.';

-- ---------------------------------------------------------------------------
-- קרנות — דיווח 13F חדש (התקדמות last_filing_date בלבד)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_followed_fund_13f()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_body  TEXT;
  v_article TEXT;
  v_name TEXT;
  v_old_date DATE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old_date := OLD.last_filing_date;
  ELSE
    v_old_date := NULL;
  END IF;

  IF NEW.last_filing_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- רק כשמועד הדיווח מתקדם (לא רענון אחזקות לאותו filing)
  IF v_old_date IS NOT NULL AND NEW.last_filing_date <= v_old_date THEN
    RETURN NEW;
  END IF;

  -- מונע ספאם מסנכרון היסטורי ישן
  IF NEW.last_filing_date < (CURRENT_DATE - INTERVAL '60 days') THEN
    RETURN NEW;
  END IF;

  v_name := COALESCE(
    NULLIF(btrim(NEW.manager_name), ''),
    NULLIF(btrim(NEW.name), ''),
    'קרן'
  );
  v_article := 'dpf13f:' || NEW.cik || ':' || NEW.last_filing_date::text;
  v_title := 'דיווח 13F חדש · ' || v_name;
  v_body :=
    public.push_notification_ltr(to_char(NEW.last_filing_date, 'YYYY-MM-DD'))
    || CASE
         WHEN COALESCE(NEW.holdings_count, 0) > 0
           THEN ' · ' || NEW.holdings_count::text || ' אחזקות'
         ELSE ''
       END
    || CASE
         WHEN COALESCE(NEW.last_value_usd, 0) > 0
           THEN ' · ' || public.push_notification_ltr(
             '$' || trim(to_char(NEW.last_value_usd, 'FM999,999,999,999'))
           )
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
      'type', 'dark_pool_fund_13f',
      'person_id', f.person_id,
      'person_kind', 'fund_manager',
      'person_name', COALESCE(NULLIF(btrim(f.name), ''), v_name),
      'cik', NEW.cik,
      'filing_date', NEW.last_filing_date::text,
      'transaction_type', '13f'
    ),
    'dark_pool_fund_13f',
    v_article
  FROM public.dark_pool_followed_investors f
  INNER JOIN public.device_tokens dt ON dt.user_id = f.user_id AND dt.is_active = true
  LEFT JOIN public.user_notification_settings uns ON uns.user_id = f.user_id
  WHERE f.kind = 'fund_manager'
    AND f.person_id = NEW.cik
    AND COALESCE(uns.notifications_enabled, true)
    AND NOT EXISTS (
      SELECT 1
      FROM public.pending_notifications pn
      WHERE pn.user_id = f.user_id
        AND pn.notification_type IN ('dark_pool_fund_13f', 'dark_pool_person_trade')
        AND pn.article_id = v_article
    )
  ORDER BY f.user_id, f.created_at DESC;

  IF FOUND THEN
    PERFORM public.invoke_process_pending_notifications_best_effort();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_followed_fund_13f_upd ON public.dark_pool_fund_managers;
CREATE TRIGGER trg_notify_followed_fund_13f_upd
  AFTER UPDATE OF last_filing_date ON public.dark_pool_fund_managers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followed_fund_13f();

DROP TRIGGER IF EXISTS trg_notify_followed_fund_13f_ins ON public.dark_pool_fund_managers;
CREATE TRIGGER trg_notify_followed_fund_13f_ins
  AFTER INSERT ON public.dark_pool_fund_managers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followed_fund_13f();

COMMENT ON FUNCTION public.notify_followed_fund_13f IS
  'Push למשתמשים שעוקבים אחרי מנהל קרן כש־last_filing_date מתקדם לדיווח 13F חדש (≤60 יום).';
