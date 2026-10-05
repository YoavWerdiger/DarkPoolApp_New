-- מכשיר שנזרק לא יכול לתפוס בחזרה בלי התחברות מחדש (הוחל דרך MCP 2026-10-06):
-- מותר לתפוס רק מסשן שנוצר אחרי התפיסה הנוכחית (= התחברות חדשה), או מאותו מכשיר.
create or replace function public.claim_active_device(p_device_id text, p_platform text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  uid uuid := auth.uid();
  enforced boolean;
  v_session_created timestamptz;
  v_current record;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if coalesce(length(p_device_id), 0) < 8 then raise exception 'invalid device id'; end if;
  enforced := not public.is_app_admin(uid);
  if enforced then
    select device_id, updated_at into v_current from public.user_active_device where user_id = uid;
    if found and v_current.device_id is distinct from p_device_id then
      select s.created_at into v_session_created from auth.sessions s
       where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid;
      if v_session_created is null or v_session_created < v_current.updated_at then
        raise exception 'session_superseded' using errcode = 'P0001';
      end if;
    end if;
  end if;
  insert into public.user_active_device (user_id, device_id, platform, updated_at)
  values (uid, p_device_id, p_platform, now())
  on conflict (user_id) do update
    set device_id = excluded.device_id, platform = excluded.platform, updated_at = now();
  return jsonb_build_object('enforced', enforced);
end;
$function$;
