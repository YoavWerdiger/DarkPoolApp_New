-- סריקת אבטחה 2026-10-12: is_app_admin / has_paid_learning_access עונות רק על עצמך (או לשרת)
-- נבדק: שרת רואה הכל; אדמין על עצמו=true; משתמש על עצמו=false; משתמש על אחר=false
create or replace function public.is_app_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is not null and uid is distinct from auth.uid() then false
    else exists (
      select 1 from public.users u
      where u.id = uid
        and lower(coalesce(u.subscription_role, '')) in ('admin', 'super_admin'))
  end;
$$;

create or replace function public.has_paid_learning_access(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is not null and uid is distinct from auth.uid() then false
    else exists (
      select 1 from public.users u
      where u.id = uid
        and lower(coalesce(u.subscription_role, '')) in ('plus_user', 'premium_user', 'vip_user', 'admin', 'super_admin')
        and (u.subscription_expires_at is null or u.subscription_expires_at > now()))
  end;
$$;
