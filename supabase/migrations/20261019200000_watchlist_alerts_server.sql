-- התראות אישיות ברשימת מעקב — הערכה בשרת (פוש אמיתי) במקום בדיקה בצד הלקוח.
-- קודם: האפליקציה בדקה תנאים רק כשמסך רשימת המעקב פתוח ושלחה התראה מקומית,
-- עם dedupe ב-AsyncStorage לפי יום — כל כניסה ביום חדש (או מכשיר אחר) הקפיצה
-- שוב את אותו «מעל $200» כל עוד המחיר מעל הסף.
-- עכשיו: Edge Function `watchlist-alerts` רצה מ-pg_cron בשעות המסחר, ומצב ההתראה
-- נשמר כאן — רמות מחיר יורות פעם אחת בחצייה ונדרכות מחדש רק אחרי שהתנאי התבטל;
-- התראות «יומיות» (שינוי %, שיא יומי/שבועי/52ש׳) — פעם אחת ביום מסחר; דיווח — פעם אחת לכל תאריך.

create table if not exists public.stock_watchlist_alert_state (
  item_id uuid not null references public.stock_watchlist_items(id) on delete cascade,
  rule_key text not null,
  is_met boolean not null default false,
  fired_ref text,
  last_fired_at timestamptz,
  last_price numeric,
  updated_at timestamptz not null default now(),
  primary key (item_id, rule_key)
);
alter table public.stock_watchlist_alert_state enable row level security;
-- אין policies ללקוח — רק service role (ה-Edge Function / הפונקציה למטה)
revoke all on public.stock_watchlist_alert_state from anon, authenticated;

comment on table public.stock_watchlist_alert_state is
  'מצב התראות רשימת מעקב לכל כלל (above:200, change:3, day_high...). מנוהל רק ע״י watchlist_alerts_apply.';

/**
 * מקבל הערכות מה-Edge Function ומחליט אטומית מה יורה.
 * p_evals: [{item_id,user_id,symbol,rule_key,mode('level'|'once'),met(bool|null),ref,kind,threshold,price,message}]
 *   level: יורה כש-met=true והמצב הקודם לא met; met=false נודר מחדש; null = באזור ההיסטרזיס — לא משנה.
 *   once:  יורה כש-met=true ו-fired_ref שונה מ-ref (יום מסחר / תאריך דיווח).
 * p_item_ids: פריטים שנבדקו בריצה — כללים שכבר לא מוגדרים בהם נמחקים מהמצב (כדי שהוספה מחדש תידרך).
 * p_seed: true = רק לרשום מצב בלי לירות (הפעלה ראשונה, כדי לא להציף שוב בהתראות ישנות).
 * מחזיר את ההתראות לשליחה — רק למשתמשים שמאפשרים watchlist_alert, בלי כפילות (user,symbol,rule).
 */
create or replace function public.watchlist_alerts_apply(
  p_evals jsonb,
  p_item_ids uuid[],
  p_seed boolean default false
)
returns table (user_id uuid, item_id uuid, symbol text, rule_key text, kind text, threshold numeric, price numeric, message text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  e record;
  v_prev public.stock_watchlist_alert_state%rowtype;
  v_found boolean;
  v_fire boolean;
  v_new_met boolean;
  v_new_ref text;
  v_seen text[] := '{}';
  v_dedupe text;
begin
  for e in
    select * from jsonb_to_recordset(coalesce(p_evals, '[]'::jsonb)) as x(
      item_id uuid, user_id uuid, symbol text, rule_key text, mode text, met boolean,
      ref text, kind text, threshold numeric, price numeric, message text
    )
  loop
    if e.item_id is null or e.rule_key is null then continue; end if;

    select * into v_prev from public.stock_watchlist_alert_state s
      where s.item_id = e.item_id and s.rule_key = e.rule_key
      for update;
    v_found := found;

    v_fire := false;
    v_new_met := coalesce(v_prev.is_met, false);
    v_new_ref := v_prev.fired_ref;

    if e.mode = 'level' then
      if e.met is true then
        v_fire := not coalesce(v_prev.is_met, false);
        v_new_met := true;
      elsif e.met is false then
        v_new_met := false;
      end if;
    else
      if e.met is true and coalesce(v_prev.fired_ref, '') is distinct from coalesce(e.ref, '') then
        v_fire := true;
        v_new_ref := e.ref;
      end if;
      v_new_met := coalesce(e.met, v_new_met);
    end if;

    if not v_found then
      insert into public.stock_watchlist_alert_state as s
        (item_id, rule_key, is_met, fired_ref, last_fired_at, last_price, updated_at)
      values (e.item_id, e.rule_key, v_new_met, v_new_ref,
              case when v_fire and not p_seed then now() end, e.price, now())
      on conflict on constraint stock_watchlist_alert_state_pkey do nothing;
      if not found then
        continue; -- ריצה מקבילה כבר רשמה — לא יורים פעמיים
      end if;
    elsif v_new_met is distinct from v_prev.is_met or v_new_ref is distinct from v_prev.fired_ref or v_fire then
      update public.stock_watchlist_alert_state s
         set is_met = v_new_met,
             fired_ref = v_new_ref,
             last_fired_at = case when v_fire and not p_seed then now() else s.last_fired_at end,
             last_price = coalesce(e.price, s.last_price),
             updated_at = now()
       where s.item_id = e.item_id and s.rule_key = e.rule_key;
    end if;

    if v_fire and not p_seed then
      v_dedupe := e.user_id::text || '|' || upper(e.symbol) || '|' || e.rule_key;
      if v_dedupe = any(v_seen) then continue; end if;
      v_seen := v_seen || v_dedupe;

      insert into public.stock_watchlist_alert_events
        (user_id, item_id, symbol, alert_kind, threshold, price, message)
      values (e.user_id, e.item_id, upper(e.symbol), e.kind, e.threshold, e.price, e.message);

      if public.user_allows_notification(e.user_id, 'watchlist_alert') then
        user_id := e.user_id; item_id := e.item_id; symbol := upper(e.symbol);
        rule_key := e.rule_key; kind := e.kind; threshold := e.threshold;
        price := e.price; message := e.message;
        return next;
      end if;
    end if;
  end loop;

  -- ניקוי מצב של כללים שהוסרו מפריטים שנבדקו, ושל פריטים שההתראות בהם כובו
  if p_item_ids is not null and cardinality(p_item_ids) > 0 then
    delete from public.stock_watchlist_alert_state s
     where s.item_id = any(p_item_ids)
       and not exists (
         select 1 from jsonb_to_recordset(coalesce(p_evals, '[]'::jsonb)) as x(item_id uuid, rule_key text)
          where x.item_id = s.item_id and x.rule_key = s.rule_key
       );
  end if;
  delete from public.stock_watchlist_alert_state s
   using public.stock_watchlist_items i
   where s.item_id = i.id and i.alerts_enabled is not true;
end;
$$;
revoke all on function public.watchlist_alerts_apply(jsonb, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.watchlist_alerts_apply(jsonb, uuid[], boolean) to service_role;

create or replace function public.invoke_watchlist_alerts()
returns bigint language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text; v_request_id bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_url is null or v_key is null then raise warning 'invoke_watchlist_alerts: missing vault secrets'; return null; end if;
  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/watchlist-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request_id;
  return v_request_id;
end; $$;
revoke all on function public.invoke_watchlist_alerts() from public, anon, authenticated;

-- כל 3 דקות בימי חול 13:00–21:59 UTC; הפונקציה עצמה מסננת לשעות המסחר בניו יורק (09:30–16:05 ET) וחגי NYSE
select cron.schedule('watchlist-alerts', '*/3 13-21 * * 1-5', $$select public.invoke_watchlist_alerts();$$);
