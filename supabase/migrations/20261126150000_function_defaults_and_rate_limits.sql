-- אבטחה: (1) פונקציות חדשות לא ניתנות להרצה כברירת מחדל ע"י authenticated / anon,
-- (2) הגבלת קצב על check_email_exists / check_phone_exists (נגד גילוי משתמשים בכמויות).

-- ---------------------------------------------------------------- (1) default privileges
-- 20260809021500 כבר הוריד את anon. עכשיו גם authenticated ו-PUBLIC:
-- כל פונקציה חדשה ב-public דורשת GRANT EXECUTE מפורש במיגרציה שיוצרת אותה.
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- פונקציות שנוצרו ב-session הזה — הרשאה מפורשת (גם אם המיגרציה הזו רצה אחריהן)
grant execute on function public.accept_ugc_terms() to authenticated;

-- ---------------------------------------------------------------- (2) rate limit per IP
create table if not exists public.rpc_ip_rate_limits (
  ip text not null,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (ip, action, window_start)
);
alter table public.rpc_ip_rate_limits enable row level security;
revoke all on public.rpc_ip_rate_limits from anon, authenticated;

-- מחזיר true אם מותר; סופר בקשות לפי IP (x-forwarded-for מ-PostgREST) לחלון של דקה.
create or replace function public.rpc_rate_allow(p_action text, p_per_minute integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := coalesce(
    split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1),
    ''
  );
  v_window timestamptz := date_trunc('minute', now());
  v_count integer;
begin
  if v_ip = '' then
    v_ip := 'unknown';
  end if;
  insert into public.rpc_ip_rate_limits as r (ip, action, window_start, request_count)
  values (trim(v_ip), p_action, v_window, 1)
  on conflict (ip, action, window_start)
  do update set request_count = r.request_count + 1
  returning request_count into v_count;

  -- ניקוי מזדמן של חלונות ישנים
  if random() < 0.01 then
    delete from public.rpc_ip_rate_limits where window_start < now() - interval '1 hour';
  end if;

  return v_count <= p_per_minute;
end;
$$;
revoke all on function public.rpc_rate_allow(text, integer) from public, anon, authenticated;

create or replace function public.check_email_exists(email_to_check text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.rpc_rate_allow('check_email_exists', 10) then
    raise exception 'rate_limited' using errcode = 'P0429', hint = 'Too many requests, try again in a minute';
  end if;
  return exists (select 1 from public.users where lower(email) = lower(trim(email_to_check)));
end;
$$;

create or replace function public.check_phone_exists(phone_to_check text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.rpc_rate_allow('check_phone_exists', 10) then
    raise exception 'rate_limited' using errcode = 'P0429', hint = 'Too many requests, try again in a minute';
  end if;
  return exists (select 1 from public.users where phone = phone_to_check);
end;
$$;

grant execute on function public.check_email_exists(text) to anon, authenticated;
grant execute on function public.check_phone_exists(text) to anon, authenticated;

notify pgrst, 'reload schema';
