-- מכשיר פעיל יחיד למשתמש (הוחל ב-2026-10-06 דרך MCP). ראה services/deviceSession.ts.
create table if not exists public.user_active_device (
  user_id uuid primary key references auth.users(id) on delete cascade,
  device_id text not null,
  platform text,
  updated_at timestamptz not null default now()
);
alter table public.user_active_device enable row level security;
drop policy if exists "own active device read" on public.user_active_device;
create policy "own active device read" on public.user_active_device
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.user_active_device from authenticated, anon;

create or replace function public.claim_active_device(p_device_id text, p_platform text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); enforced boolean;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if coalesce(length(p_device_id), 0) < 8 then raise exception 'invalid device id'; end if;
  enforced := not public.is_app_admin(uid);
  insert into public.user_active_device (user_id, device_id, platform, updated_at)
  values (uid, p_device_id, p_platform, now())
  on conflict (user_id) do update set device_id = excluded.device_id, platform = excluded.platform, updated_at = now();
  return jsonb_build_object('enforced', enforced);
end; $$;

create or replace function public.get_my_active_device()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'device_id', (select device_id from public.user_active_device where user_id = auth.uid()),
    'enforced', not public.is_app_admin(auth.uid())
  );
$$;

revoke all on function public.claim_active_device(text, text) from public, anon;
revoke all on function public.get_my_active_device() from public, anon;
grant execute on function public.claim_active_device(text, text) to authenticated;
grant execute on function public.get_my_active_device() to authenticated;
alter publication supabase_realtime add table public.user_active_device;
