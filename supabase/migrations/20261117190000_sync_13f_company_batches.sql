-- סנכרון 13F לחברות הציבוריות החדשות — במנות קטנות (הריצה המלאה נתקעה על הבנקים).
-- כמו invoke_sync_fund_13f_sec, אבל עם רשימת CIK ומספר רבעונים. כל קריאה = worker נפרד.

create or replace function public.invoke_sync_fund_13f_sec_ciks(p_ciks text[], p_filings int default 4)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare v_url text; v_key text; v_req bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_url is null or v_key is null then return null; end if;
  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/sync-fund-13f-sec',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('ciks', to_jsonb(p_ciks), 'filings', p_filings),
    timeout_milliseconds := 150000
  ) into v_req;
  return v_req;
end; $$;
revoke execute on function public.invoke_sync_fund_13f_sec_ciks(text[], int) from public, anon, authenticated;

-- ברקשייר + חברות ביטוח (תיקים רגילים) — 4 רבעונים
select public.invoke_sync_fund_13f_sec_ciks(array['1067983', '1099219', '86312', '899051', '1137774'], 4);

-- בנקים / מנהלי נכסים (13F ענקי) — כל אחד לבד, רק הרבעון האחרון
select public.invoke_sync_fund_13f_sec_ciks(array['70858'], 1);    -- Bank of America
select public.invoke_sync_fund_13f_sec_ciks(array['886982'], 1);   -- Goldman Sachs
select public.invoke_sync_fund_13f_sec_ciks(array['895421'], 1);   -- Morgan Stanley
select public.invoke_sync_fund_13f_sec_ciks(array['72971'], 1);    -- Wells Fargo
select public.invoke_sync_fund_13f_sec_ciks(array['831001'], 1);   -- Citigroup
select public.invoke_sync_fund_13f_sec_ciks(array['2012383'], 1);  -- BlackRock
