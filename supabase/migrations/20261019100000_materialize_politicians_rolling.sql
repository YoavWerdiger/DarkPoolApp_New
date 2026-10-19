-- פוליטיקאים עם עסקאות, מהישן ביותר (או בלי snapshot) — לסבב materialize מתגלגל
create or replace function public.darkpool_stale_politicians(p_limit int default 6)
returns table(politician_id text)
language sql stable security definer set search_path = public
as $$
  with pols as (
    select t.politician_id::text as politician_id, max(t.transaction_date) as last_trade
    from dark_pool_congress_trades t
    where t.politician_id is not null
    group by 1
  )
  select p.politician_id
  from pols p
  left join dark_pool_person_portfolio_snapshots s
    on s.person_id = p.politician_id and s.kind = 'politician'
  order by s.computed_at asc nulls first, p.last_trade desc nulls last
  limit greatest(1, least(p_limit, 20));
$$;
revoke all on function public.darkpool_stale_politicians(int) from public, anon, authenticated;

-- סבב מתגלגל: כל 2 דק' — 6 הפוליטיקאים שהתיק שלהם הכי ישן (~180 בשעה → כל ה-241 בערך פעם בשעה)
create or replace function public.invoke_materialize_politicians_rolling()
 returns bigint language plpgsql security definer
 set search_path to 'public', 'extensions', 'vault'
as $function$
declare v_url text; v_key text; v_req bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_url is null or v_key is null then return null; end if;
  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/materialize-darkpool-portfolios',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{"mode":"politicians"}'::jsonb,
    timeout_milliseconds := 150000
  ) into v_req;
  return v_req;
end; $function$;
revoke all on function public.invoke_materialize_politicians_rolling() from public, anon, authenticated;
select cron.schedule('materialize-politicians-rolling', '*/2 * * * *', $$ select public.invoke_materialize_politicians_rolling(); $$);
