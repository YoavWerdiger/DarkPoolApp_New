-- תיק טראמפ: materialize-trump-portfolio כל 20 דק׳ (השלמת מחירים 120 טיקרים לריצה + שווי משוער מטווחים)
create or replace function public.invoke_materialize_trump_portfolio()
returns bigint language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text; v_request_id bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_url is null or v_key is null then raise warning 'invoke_materialize_trump_portfolio: missing vault secrets'; return null; end if;
  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/materialize-trump-portfolio',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  ) into v_request_id;
  return v_request_id;
end; $$;
revoke all on function public.invoke_materialize_trump_portfolio() from public, anon, authenticated;
select cron.schedule('materialize-trump-portfolio', '*/20 * * * *', $$select public.invoke_materialize_trump_portfolio();$$);
