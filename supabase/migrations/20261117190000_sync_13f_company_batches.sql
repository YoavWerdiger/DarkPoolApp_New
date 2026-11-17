-- 13F sync for the new public companies, in small batches.

create or replace function public.sync_13f_ciks(
  p_ciks text[],
  p_filings int default 4
)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  v_url text;
  v_key text;
  v_req bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets
   where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key
    from vault.decrypted_secrets
   where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_url is null or v_key is null then
    return null;
  end if;
  select net.http_post(
    url := rtrim(v_url, '/')
      || '/functions/v1/sync-fund-13f-sec',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'ciks', to_jsonb(p_ciks),
      'filings', p_filings
    ),
    timeout_milliseconds := 150000
  ) into v_req;
  return v_req;
end;
$$;

revoke execute on function public.sync_13f_ciks(text[], int)
  from public, anon, authenticated;

-- Berkshire + insurers, 4 quarters
select public.sync_13f_ciks(
  array['1067983', '1099219', '86312', '899051', '1137774'], 4
);

-- banks / asset managers, one each, latest quarter only
select public.sync_13f_ciks(array['70858'], 1);
select public.sync_13f_ciks(array['886982'], 1);
select public.sync_13f_ciks(array['895421'], 1);
select public.sync_13f_ciks(array['72971'], 1);
select public.sync_13f_ciks(array['831001'], 1);
select public.sync_13f_ciks(array['2012383'], 1);
