-- התראות Push על רכישות של אנשים במעקב (קונגרס / בכירים)
-- follow = קבלת התראות על רכישות חדשות

-- upsert במעקב דורש גם UPDATE
DROP POLICY IF EXISTS dpfi_owner_update ON public.dark_pool_followed_investors;
CREATE POLICY dpfi_owner_update ON public.dark_pool_followed_investors
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.invoke_process_pending_notifications_best_effort()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/process-pending-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'invoke_process_pending_notifications_best_effort: %', SQLERRM;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_process_pending_notifications_best_effort() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.invoke_process_pending_notifications_best_effort() TO service_role;

-- ---------------------------------------------------------------------------
-- קונגרס — רק קניות חדשות (לא היסטוריה ישנה מסנכרון)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_followed_congress_trade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_body  TEXT;
  v_article TEXT;
BEGIN
  IF lower(COALESCE(NEW.transaction_type, '')) <> 'buy' THEN
    RETURN NEW;
  END IF;

  IF NEW.filed_at IS NULL OR NEW.filed_at < NOW() - INTERVAL '14 days' THEN
    RETURN NEW;
  END IF;

  v_article := 'dpct:' || COALESCE(NEW.external_id, NEW.id::text);
  v_title := 'רכישה חדשה · ' || COALESCE(NEW.politician_name, 'פוליטיקאי');
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
  SELECT DISTINCT
    f.user_id,
    v_title,
    v_body,
    jsonb_build_object(
      'type', 'dark_pool_person_trade',
      'person_id', NEW.politician_id,
      'person_kind', 'politician',
      'person_name', NEW.politician_name,
      'ticker', NEW.ticker,
      'transaction_type', 'buy',
      'trade_id', NEW.id::text
    ),
    'dark_pool_person_trade',
    v_article
  FROM public.dark_pool_followed_investors f
  INNER JOIN public.device_tokens dt ON dt.user_id = f.user_id AND dt.is_active = true
  LEFT JOIN public.user_notification_settings uns ON uns.user_id = f.user_id
  WHERE f.kind = 'politician'
    AND f.person_id = NEW.politician_id
    AND COALESCE(uns.notifications_enabled, true)
    AND NOT EXISTS (
      SELECT 1
      FROM public.pending_notifications pn
      WHERE pn.user_id = f.user_id
        AND pn.notification_type = 'dark_pool_person_trade'
        AND pn.article_id = v_article
    );

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

-- ---------------------------------------------------------------------------
-- בכירים — רק רכישות (P)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_followed_insider_buy()
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
  v_person_key TEXT;
BEGIN
  IF upper(COALESCE(NEW.transaction_type, '')) <> 'P' THEN
    RETURN NEW;
  END IF;

  IF NEW.filed_at IS NULL OR NEW.filed_at < NOW() - INTERVAL '14 days' THEN
    RETURN NEW;
  END IF;

  v_name := btrim(COALESCE(NEW.insider_name, ''));
  IF v_name = '' THEN
    RETURN NEW;
  END IF;

  v_person_key := upper(COALESCE(NEW.ticker, '')) || ':' || v_name;
  v_article := 'dpi:' || COALESCE(NEW.source, 'src') || ':' || COALESCE(NEW.external_id, NEW.id::text);
  v_title := 'רכישה חדשה · ' || v_name;
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
  SELECT DISTINCT
    f.user_id,
    v_title,
    v_body,
    jsonb_build_object(
      'type', 'dark_pool_person_trade',
      'person_id', f.person_id,
      'person_kind', 'insider',
      'person_name', f.name,
      'ticker', NEW.ticker,
      'transaction_type', 'buy',
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
    );

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

COMMENT ON FUNCTION public.notify_followed_congress_trade IS
  'שולח Push למשתמשים שעוקבים אחרי פוליטיקאי כשיש רכישה חדשה';
COMMENT ON FUNCTION public.notify_followed_insider_buy IS
  'שולח Push למשתמשים שעוקבים אחרי בכיר כשיש רכישת Form 4 חדשה';
