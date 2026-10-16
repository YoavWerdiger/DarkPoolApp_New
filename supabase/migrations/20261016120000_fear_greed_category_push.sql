-- פוש כשמדד הפחד והתאווה עובר קטגוריה (fear-greed-update עושה upsert לשורה id=1 כל 15 דק').
-- נגד ריצוד: לא חוזרים על הקטגוריה האחרונה שהודענו, ולכל היותר פוש אחד ל-4 שעות.
-- הפוש נשלט ע"י «חדשות» בהגדרות ההתראות (user_allows_notification: fear_greed → news_notifications).
-- נבדק בטרנזקציה מבוטלת: מעבר פחד→ניטרלי = 5/6 משתמשים (אחד כיבה חדשות); חזרה מיידית לפחד = 0.
create table if not exists public.fear_greed_alert_state (
  id int primary key default 1 check (id = 1),
  last_notified_category text,
  last_sent_at timestamptz
);
alter table public.fear_greed_alert_state enable row level security;
revoke all on public.fear_greed_alert_state from anon, authenticated;
insert into public.fear_greed_alert_state (id, last_notified_category)
select 1, lower(btrim(value_classification)) from public.fear_and_greed_index order by id limit 1
on conflict (id) do nothing;

create or replace function public.fear_greed_category_info(p text, out rank int, out label_he text)
language sql immutable as $$
  select case k when 'extreme fear' then 1 when 'fear' then 2 when 'neutral' then 3 when 'greed' then 4 when 'extreme greed' then 5 end,
         case k when 'extreme fear' then 'פחד קיצוני' when 'fear' then 'פחד' when 'neutral' then 'ניטרלי'
                 when 'greed' then 'תאווה' when 'extreme greed' then 'תאווה קיצונית' end
  from (select lower(btrim(coalesce(p, ''))) k) s;
$$;

create or replace function public.notify_fear_greed_category_change()
returns trigger language plpgsql security definer set search_path = public, extensions, vault as $$
declare
  v_new text := lower(btrim(coalesce(new.value_classification, '')));
  v_old text := lower(btrim(coalesce(old.value_classification, '')));
  v_state public.fear_greed_alert_state%rowtype;
  n record; o record;
  v_title text; v_body text; v_value int := new.value;
  v_url text; v_key text; v_req bigint;
begin
  if v_new = '' or v_new = v_old then return new; end if;
  select * into n from public.fear_greed_category_info(v_new);
  select * into o from public.fear_greed_category_info(v_old);
  if n.rank is null or o.rank is null then return new; end if;

  select * into v_state from public.fear_greed_alert_state where id = 1 for update;
  if v_state.last_notified_category = v_new then return new; end if;
  if v_state.last_sent_at is not null and v_state.last_sent_at > now() - interval '4 hours' then return new; end if;

  v_title := 'מדד הפחד והתאווה: ' || n.label_he;
  if n.rank = 1 then
    v_body := format('המדד ירד לפחד קיצוני (%s). רמות כאלה מלוות בדרך כלל בפאניקה ומכירות חזקות בשוק.', v_value);
  elsif n.rank = 5 then
    v_body := format('המדד עלה לתאווה קיצונית (%s). השוק באופוריה — זה הזמן לשים לב לניהול הסיכונים.', v_value);
  elsif n.rank = 3 then
    v_body := format('המדד חזר לאזור הניטרלי (%s) — אחרי %s. הסנטימנט בשוק מתאזן.', v_value, o.label_he);
  elsif n.rank > o.rank then
    v_body := format('המדד עלה מ%s ל%s (%s). הסנטימנט בשוק משתפר.', o.label_he, n.label_he, v_value);
  else
    v_body := format('המדד ירד מ%s ל%s (%s). החשש בשוק עולה.', o.label_he, n.label_he, v_value);
  end if;

  insert into public.pending_notifications (user_id, title, body, data, notification_type)
  select distinct dt.user_id,
         public.push_notification_rtl(v_title),
         public.push_notification_rtl(v_body),
         jsonb_build_object('type', 'fear_greed', 'value', v_value, 'category', v_new, 'previous', v_old),
         'fear_greed'
  from public.device_tokens dt
  where dt.is_active = true and dt.user_id is not null;

  update public.fear_greed_alert_state set last_notified_category = v_new, last_sent_at = now() where id = 1;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_url is not null and v_key is not null then
    select net.http_post(
      url := rtrim(v_url, '/') || '/functions/v1/process-pending-notifications',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
      body := '{}'::jsonb
    ) into v_req;
  end if;
  return new;
exception when others then
  raise warning 'notify_fear_greed_category_change failed: %', sqlerrm;
  return new;
end; $$;
revoke execute on function public.notify_fear_greed_category_change() from public, anon, authenticated;

drop trigger if exists fear_greed_category_push on public.fear_and_greed_index;
create trigger fear_greed_category_push
  after update of value_classification on public.fear_and_greed_index
  for each row execute function public.notify_fear_greed_category_change();

-- העדפות: fear_greed תחת «חדשות»
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
    WHEN v_kind IN ('news', 'fear_greed') THEN RETURN COALESCE(r.news_notifications, true);
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
