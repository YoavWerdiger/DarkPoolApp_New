-- תגי משתמש: וי כחול (מאומת) + דרגת ותק מנוי (דוב → שור).
--
-- וי כחול: is_verified / verified_at / verified_by — רק מנהל (is_app_admin) דרך
-- admin_set_user_verified. טריגר חוסם כל כתיבה ישירה מ-anon/authenticated (גם של מנהל),
-- כך שגם GRANT UPDATE רחב בעתיד לא יפתח אימות עצמי.
--
-- ותק = ימי מנוי בתשלום מצטברים. מקור: user_subscriptions — כל חיוב מוצלח (CardCom,
-- rapid-responder / admin-cardcom → activateSubscriptionFromPayment) מוסיף שורה עם
-- source_transaction_id, ומבטל את השורה הפעילה הקודמת ב-cancelled_at=now. לכן איחוד
-- המקטעים [starts_at, least(expires_at, cancelled_at, now)] = הזמן שבו היה מנוי בתשלום:
-- נעצר כשאין תשלום, לא מתאפס. ביטול (cancel_my_subscription) מוריד מיד ל-free, ולכן
-- cancelled_at חותך את המקטע.
-- שורות בלי source_transaction_id (פרימיום שהוענק ממנהל, free) לא נספרות — זה לא תשלום.
-- למנויים ששילמו מחוץ למערכת / הענקות — paid_days_adjustment שמנהל קובע (± ימים).
-- מנהלים מחושבים כמו כולם — לפי תשלומים בלבד.

alter table public.users
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.users(id) on delete set null,
  add column if not exists paid_days_adjustment integer not null default 0;

create index if not exists idx_users_is_verified on public.users(is_verified) where is_verified;

-- ---------------------------------------------------------------------------
-- חסימת כתיבה ישירה לעמודות התגים
-- ---------------------------------------------------------------------------
create or replace function public.users_guard_badge_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.is_verified or new.verified_at is not null or new.verified_by is not null
       or new.paid_days_adjustment <> 0 then
      raise exception 'permission denied: badge columns of public.users are admin-only'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.is_verified          is distinct from old.is_verified
     or new.verified_at          is distinct from old.verified_at
     or new.verified_by          is distinct from old.verified_by
     or new.paid_days_adjustment is distinct from old.paid_days_adjustment
  then
    raise exception 'permission denied: badge columns of public.users are admin-only'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists users_guard_badge_columns on public.users;
create trigger users_guard_badge_columns
  before insert or update on public.users
  for each row
  execute function public.users_guard_badge_columns();

-- ---------------------------------------------------------------------------
-- חישוב ימי מנוי בתשלום (פנימי — לא חשוף ללקוח)
-- ---------------------------------------------------------------------------
create or replace function public.paid_tenure_days_computed(p_user_ids uuid[])
returns table (user_id uuid, paid_days integer)
language sql
stable
security definer
set search_path = public
as $$
  with iv as (
    select s.user_id,
           s.starts_at as st,
           least(s.expires_at, coalesce(s.cancelled_at, 'infinity'::timestamptz), now()) as en
    from public.user_subscriptions s
    left join public.subscription_plans p on p.id = s.plan_id
    where s.user_id = any(p_user_ids)
      and s.source_transaction_id is not null
      and s.plan_id <> 'free'
      and coalesce(p.price, 1) > 0
      and s.starts_at is not null
      and s.expires_at is not null
  ),
  valid as (
    select * from iv where en > st
  ),
  marked as (
    select v.*,
           case
             when v.st <= max(v.en) over (
               partition by v.user_id order by v.st, v.en
               rows between unbounded preceding and 1 preceding
             ) then 0
             else 1
           end as is_new
    from valid v
  ),
  grouped as (
    select m.*, sum(m.is_new) over (partition by m.user_id order by m.st, m.en) as g
    from marked m
  ),
  merged as (
    select g.user_id, min(g.st) as st, max(g.en) as en
    from grouped g
    group by g.user_id, g.g
  )
  select m.user_id, floor(sum(extract(epoch from (m.en - m.st))) / 86400)::int
  from merged m
  group by m.user_id;
$$;

revoke all on function public.paid_tenure_days_computed(uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC ציבורי: תגים לרשימת משתמשים
-- paid_days = null → מעולם לא שילם (אין אייקון דרגה)
-- ---------------------------------------------------------------------------
create or replace function public.get_user_badges(p_user_ids uuid[])
returns table (user_id uuid, is_verified boolean, paid_days integer)
language sql
stable
security definer
set search_path = public
as $$
  with ids as (
    select distinct x as id
    from unnest(coalesce(p_user_ids, '{}'::uuid[])) as x
    limit 500
  )
  select u.id,
         u.is_verified,
         case
           when c.paid_days is null and u.paid_days_adjustment <= 0 then null
           else greatest(0, coalesce(c.paid_days, 0) + u.paid_days_adjustment)
         end
  from ids
  join public.users u on u.id = ids.id
  left join public.paid_tenure_days_computed(array(select id from ids)) c on c.user_id = u.id
  where auth.uid() is not null
    and u.deleted_at is null;
$$;

revoke all on function public.get_user_badges(uuid[]) from public, anon;
grant execute on function public.get_user_badges(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- מנהל: אימות משתמש
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_verified(p_user uuid, p_verified boolean)
returns table (user_id uuid, is_verified boolean, verified_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := (select auth.uid());
begin
  if v_admin is null or not public.is_app_admin(v_admin) then
    raise exception 'permission denied: admin only' using errcode = '42501';
  end if;
  if p_user = v_admin then
    raise exception 'cannot verify yourself' using errcode = '42501';
  end if;

  update public.users u
     set is_verified = coalesce(p_verified, false),
         verified_at = case when coalesce(p_verified, false) then now() else null end,
         verified_by = case when coalesce(p_verified, false) then v_admin else null end
   where u.id = p_user;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_user_id, meta)
  values (v_admin, case when p_verified then 'verify_user' else 'unverify_user' end, p_user, '{}'::jsonb);

  return query
    select u.id, u.is_verified, u.verified_at from public.users u where u.id = p_user;
end;
$$;

revoke all on function public.admin_set_user_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_user_verified(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- מנהל: התאמת ותק ידנית (ימים, יכול להיות שלילי)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_tenure_adjustment(p_user uuid, p_days integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := (select auth.uid());
  v_prev integer;
begin
  if v_admin is null or not public.is_app_admin(v_admin) then
    raise exception 'permission denied: admin only' using errcode = '42501';
  end if;
  if p_days is null or p_days < -36500 or p_days > 36500 then
    raise exception 'invalid days' using errcode = '22023';
  end if;

  select u.paid_days_adjustment into v_prev from public.users u where u.id = p_user;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  update public.users u set paid_days_adjustment = p_days where u.id = p_user;

  insert into public.admin_audit_log (admin_id, action, target_user_id, meta)
  values (v_admin, 'set_tenure_adjustment', p_user, jsonb_build_object('previous', v_prev, 'next', p_days));
end;
$$;

revoke all on function public.admin_set_user_tenure_adjustment(uuid, integer) from public, anon;
grant execute on function public.admin_set_user_tenure_adjustment(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- מנהל: פירוט תגים (מחושב + התאמה) לשורות בפאנל
-- ---------------------------------------------------------------------------
create or replace function public.admin_user_badge_details(p_user_ids uuid[])
returns table (
  user_id uuid,
  is_verified boolean,
  verified_at timestamptz,
  computed_days integer,
  adjustment_days integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin((select auth.uid())) then
    raise exception 'permission denied: admin only' using errcode = '42501';
  end if;
  return query
    select u.id, u.is_verified, u.verified_at, c.paid_days, u.paid_days_adjustment
    from public.users u
    left join public.paid_tenure_days_computed(p_user_ids) c on c.user_id = u.id
    where u.id = any(p_user_ids);
end;
$$;

revoke all on function public.admin_user_badge_details(uuid[]) from public, anon;
grant execute on function public.admin_user_badge_details(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- מנהל: רשימת משתמשים מאומתים (פילטר «מאומתים» — admin-api לא מכיר את העמודה)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_verified_users(p_query text default '', p_limit integer default 40)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := nullif(trim(coalesce(p_query, '')), '');
begin
  if not public.is_app_admin((select auth.uid())) then
    raise exception 'permission denied: admin only' using errcode = '42501';
  end if;
  return query
    select jsonb_build_object(
      'id', u.id, 'email', u.email, 'full_name', u.full_name, 'display_name', u.display_name,
      'profile_picture', u.profile_picture, 'subscription_role', u.subscription_role,
      'subscription_plan', u.subscription_plan, 'created_at', u.created_at,
      'last_active', u.last_active, 'last_seen', u.last_seen, 'is_muted', u.is_muted,
      'muted_reason', u.muted_reason, 'is_suspended', u.is_suspended,
      'suspended_reason', u.suspended_reason, 'phone', u.phone, 'intro_data', u.intro_data
    )
    from public.users u
    where u.is_verified
      and (q is null
           or u.email ilike '%' || q || '%'
           or u.full_name ilike '%' || q || '%'
           or u.display_name ilike '%' || q || '%'
           or u.phone ilike '%' || q || '%')
    order by u.verified_at desc nulls last
    limit least(greatest(coalesce(p_limit, 40), 1), 200);
end;
$$;

revoke all on function public.admin_list_verified_users(text, integer) from public, anon;
grant execute on function public.admin_list_verified_users(text, integer) to authenticated;

notify pgrst, 'reload schema';
