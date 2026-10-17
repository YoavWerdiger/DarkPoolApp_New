-- סנכרון 13F מה-SEC לכל הקרנות (16 רבעונים, מדלג על רבעון שנקרא) — כל 3 שעות (ריצה רגילה זולה; ההשלמה הראשונית מתפזרת)
create or replace function public.invoke_sync_fund_13f_sec()
 returns bigint language plpgsql security definer
 set search_path to 'public', 'extensions', 'vault'
as $function$
declare v_url text; v_key text; v_req bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_url is null or v_key is null then return null; end if;
  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/sync-fund-13f-sec',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  ) into v_req;
  return v_req;
end; $function$;

select cron.unschedule('sync-fund-13f-sec-daily');
select cron.schedule('sync-fund-13f-sec-daily', '35 */3 * * *', $$ select public.invoke_sync_fund_13f_sec(); $$);
