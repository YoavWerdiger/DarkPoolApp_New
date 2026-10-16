-- נוסח הפוש: «השוק עבר ל<קטגוריה> 👀» + «היכנסו כדי לראות את מצב השוק 👀» — בלי ערך מספרי. רק מעבר קטגוריה.
-- נבדק בטרנזקציה מבוטלת: פחד→ניטרלי = 6/6.
create or replace function public.notify_fear_greed_category_change()
returns trigger language plpgsql security definer set search_path = public, extensions, vault as $$
declare
  v_new text := lower(btrim(coalesce(new.value_classification, '')));
  v_old text := lower(btrim(coalesce(old.value_classification, '')));
  v_state public.fear_greed_alert_state%rowtype;
  n record; o record;
  v_title text; v_body text;
  v_url text; v_key text; v_req bigint;
begin
  if v_new = '' or v_new = v_old then return new; end if;
  select * into n from public.fear_greed_category_info(v_new);
  select * into o from public.fear_greed_category_info(v_old);
  if n.rank is null or o.rank is null then return new; end if;

  select * into v_state from public.fear_greed_alert_state where id = 1 for update;
  if v_state.last_notified_category = v_new then return new; end if;
  if v_state.last_sent_at is not null and v_state.last_sent_at > now() - interval '4 hours' then return new; end if;

  -- בלי ערך מספרי — מזמין להיכנס
  v_title := 'השוק עבר ל' || n.label_he || ' 👀';
  v_body := 'היכנסו כדי לראות את מצב השוק 👀';

  insert into public.pending_notifications (user_id, title, body, data, notification_type)
  select distinct dt.user_id,
         public.push_notification_rtl(v_title),
         public.push_notification_rtl(v_body),
         jsonb_build_object('type', 'fear_greed', 'category', v_new, 'previous', v_old),
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

