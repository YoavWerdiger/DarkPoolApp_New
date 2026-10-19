-- התראות רשימת מעקב: כיבוי והדלקה של מתג ההתראות בשיט לא מוחקים את מצב הכללים —
-- תנאי שכבר נשלח (למשל «מעל $200») לא יישלח שוב רק כי המתג הודלק מחדש.
-- גם כיבוי/הדלקה של כלל בודד (שיא יומי, יעד…) לא מאפס אותו: מצב של כלל שכבר לא מוגדר נשמר
-- 30 יום ורק אז מתנקה; מחיקת הפריט מוחקת הכול (cascade).

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

  -- ניקוי מצב של כללים שהוסרו — רק אחרי 30 יום בלי שינוי, כדי שכיבוי והדלקה מחדש
  -- לא יקפיצו שוב התראה שכבר נשלחה (באותו יום / כשהתנאי עדיין מתקיים).
  if p_item_ids is not null and cardinality(p_item_ids) > 0 then
    delete from public.stock_watchlist_alert_state s
     where s.item_id = any(p_item_ids)
       and s.updated_at < now() - interval '30 days'
       and not exists (
         select 1 from jsonb_to_recordset(coalesce(p_evals, '[]'::jsonb)) as x(item_id uuid, rule_key text)
          where x.item_id = s.item_id and x.rule_key = s.rule_key
       );
  end if;
end;
$$;
revoke all on function public.watchlist_alerts_apply(jsonb, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.watchlist_alerts_apply(jsonb, uuid[], boolean) to service_role;
