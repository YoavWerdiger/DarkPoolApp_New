create or replace function public.invoke_sync_insider_ownership(p_limit int default 150)
returns bigint language plpgsql security definer set search_path = public, extensions, vault as $$
declare v_url text; v_key text; v_request_id bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_url is null or v_key is null then
    raise warning 'sync_insider_ownership: missing vault secrets';
    return null;
  end if;
  select net.http_post(
    url := v_url || '/functions/v1/sync-insider-ownership',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('limit', p_limit),
    timeout_milliseconds := 150000
  ) into v_request_id;
  return v_request_id;
end; $$;
revoke execute on function public.invoke_sync_insider_ownership(int) from public, anon, authenticated;

-- כל 15 דק': בהשלמה הראשונית ~250 הגשות לריצה; אחר כך רק הגשות חדשות (~30 ביום)
select cron.schedule('sync-insider-ownership', '*/15 * * * *', $$ select public.invoke_sync_insider_ownership(250); $$);
