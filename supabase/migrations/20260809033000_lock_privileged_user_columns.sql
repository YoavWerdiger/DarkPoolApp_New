-- Stop any authenticated user from making themselves an admin, or granting
-- themselves a paid subscription, by writing to their own row.
--
-- Admin access in this project is decided in exactly one place - the string in
-- public.users.subscription_role ('admin' / 'super_admin'). useIsAdmin() reads
-- it through get_my_profile(), and every admin Edge Function
-- (_shared/adminAuth.ts, admin-api, admin-cardcom) re-reads it server side.
-- public.users nevertheless carried a table-level GRANT UPDATE to
-- `authenticated`, and the RLS policies only ever constrain WHICH ROW may be
-- written, never WHICH COLUMN. So a plain
--   PATCH /rest/v1/users?id=eq.<self>  {"subscription_role":"admin"}
-- with nothing but the public anon key was enough to take over the admin panel.
-- Verified against the live API before this migration: the PATCH returned 200
-- and get_my_profile() then reported role=admin.
--
-- Same shape of hole on the money side: subscription_plan / subscription_role /
-- subscription_expires_at / account_type were self-writable, and
-- public.user_subscriptions accepted a self-inserted {plan_id:'yearly',
-- status:'active'} row, which is what useSubscription() reads first. A user
-- could hand themselves premium for free without going near CardCom.
--
-- Two layers, on purpose:
--
-- 1. Column privileges are the primary control. They are the right tool here
--    because the failure mode is loud - Postgres answers 42501 - where a row
--    filter would silently write nothing and leave the client believing it
--    succeeded. This mirrors 20260809000000, which already used column
--    privileges to take SELECT on the private columns away from the same table.
--
-- 2. A BEFORE UPDATE trigger re-checks the privileged columns against their
--    stored values. This is not redundant: the grants above are exactly what
--    regressed (a broad table-level GRANT UPDATE re-opened every column), and a
--    trigger cannot be undone by re-running such a grant - only by explicitly
--    dropping it. It makes this specific regression non-repeatable.
--
--    A RESTRICTIVE policy was tried first and rejected on evidence. A policy on
--    public.users cannot subquery public.users (infinite recursion in policy),
--    so it needs a SECURITY DEFINER helper - and policy expressions are
--    evaluated as the calling role, so `authenticated` would need EXECUTE on a
--    function that returns any row's email and subscription_role by id. That
--    hands back the exact leak 20260809000000 closed. Measured against the live
--    API: without the grant every legitimate profile UPDATE failed 42501; with
--    it, the leak returns. A trigger reads OLD/NEW directly, needs no grant, and
--    raises 42501 so the failure looks identical to the column-privilege one.
--
-- Existing policies are left in place; this migration only adds.

-- ---------------------------------------------------------------------------
-- 1. public.users - column-level write privileges
-- ---------------------------------------------------------------------------

-- Column grants are only reachable once the table-level grant is gone: a
-- table-level UPDATE covers every column and makes per-column grants moot.
revoke insert, update, delete on public.users from anon, authenticated;

-- anon never writes public.users at all. The row is created server side by
-- handle_new_user() (SECURITY DEFINER) on auth.users insert, so the signup
-- flow does not need an anon write path.

-- INSERT is the recovery path only: AuthService.upsertOwnUserRow() falls back
-- to an INSERT when handle_new_user() did not produce a row. `email` is
-- included because the column is NOT NULL with no default. RLS
-- (users_insert_self_only) still pins the row to auth.uid().
grant insert (
  id,
  email,
  full_name,
  display_name,
  profile_picture,
  avatar_url,
  phone,
  gender,
  track_id,
  intro_data,
  registration_completed,
  is_online,
  last_active,
  last_seen,
  updated_at
) on public.users to authenticated;

-- What a user may change about themselves: their profile, their onboarding
-- answers, and their presence. Nothing that grants access.
--
-- Deliberately NOT here:
--   subscription_role, subscription_plan, subscription_expires_at,
--   account_type          -> admin rights and paid entitlement
--   is_suspended, suspended_at, suspended_by, suspended_reason,
--   is_muted, muted_at, muted_by, muted_reason
--                         -> moderation state; self-service unban otherwise
--   email                 -> identity the admin panel searches on; set from
--                            auth.users by handle_new_user()
--   id, created_at        -> row identity
--   deleted_at, deletion_requested_at
--                         -> owned by the delete-account Edge Function
grant update (
  full_name,
  display_name,
  profile_picture,
  avatar_url,
  phone,
  gender,
  track_id,
  intro_data,
  registration_completed,
  is_online,
  last_active,
  last_seen,
  updated_at
) on public.users to authenticated;

-- DELETE stays revoked. Account deletion runs in the delete-account Edge
-- Function on the service role, which anonymises the row rather than removing
-- it. Leaving self-delete open would also re-open escalation: delete the row,
-- then INSERT it back with subscription_role='admin'.

-- ---------------------------------------------------------------------------
-- 2. public.users - trigger backstop
-- ---------------------------------------------------------------------------

create or replace function public.users_guard_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- service_role / postgres (Edge Functions, admin API, migrations, the
  -- SECURITY DEFINER helpers) keep full control of these columns.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.email                   is distinct from old.email
     or new.subscription_role       is distinct from old.subscription_role
     or new.subscription_plan       is distinct from old.subscription_plan
     or new.subscription_expires_at is distinct from old.subscription_expires_at
     or new.account_type            is distinct from old.account_type
     or new.is_muted                is distinct from old.is_muted
     or new.muted_at                is distinct from old.muted_at
     or new.muted_by                is distinct from old.muted_by
     or new.muted_reason            is distinct from old.muted_reason
     or new.is_suspended            is distinct from old.is_suspended
     or new.suspended_at            is distinct from old.suspended_at
     or new.suspended_by            is distinct from old.suspended_by
     or new.suspended_reason        is distinct from old.suspended_reason
     or new.deleted_at              is distinct from old.deleted_at
     or new.deletion_requested_at   is distinct from old.deletion_requested_at
  then
    raise exception 'permission denied: subscription, moderation and identity columns of public.users are not writable by the account owner'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.users_guard_privileged_columns() is
  'Backstop for the column-level UPDATE grants on public.users. Rejects any client-role UPDATE that changes admin, subscription, moderation or identity state, so re-granting UPDATE on the whole table cannot silently re-open privilege escalation.';

drop trigger if exists users_guard_privileged_columns on public.users;
create trigger users_guard_privileged_columns
  before update on public.users
  for each row
  execute function public.users_guard_privileged_columns();

-- ---------------------------------------------------------------------------
-- 3. public.user_subscriptions - no client writes
-- ---------------------------------------------------------------------------

-- useSubscription() trusts the newest active row here, so a self-inserted
-- {plan_id:'yearly', status:'active'} was free premium. Writes belong to the
-- CardCom webhook (rapid-responder -> activateSubscriptionFromPayment) on the
-- service role. Clients keep SELECT on their own rows.
revoke insert, update, delete on public.user_subscriptions from anon, authenticated;

drop policy if exists user_subscriptions_no_client_insert on public.user_subscriptions;
create policy user_subscriptions_no_client_insert on public.user_subscriptions
as restrictive for insert to anon, authenticated with check (false);

drop policy if exists user_subscriptions_no_client_update on public.user_subscriptions;
create policy user_subscriptions_no_client_update on public.user_subscriptions
as restrictive for update to anon, authenticated using (false) with check (false);

drop policy if exists user_subscriptions_no_client_delete on public.user_subscriptions;
create policy user_subscriptions_no_client_delete on public.user_subscriptions
as restrictive for delete to anon, authenticated using (false);

-- ---------------------------------------------------------------------------
-- 4. The two writes the client legitimately needed, moved server side
-- ---------------------------------------------------------------------------

-- Registration used to insert the free row from the client. It only ever
-- writes plan 'free', so a definer function can do it with no input at all -
-- there is no argument an attacker could bend towards a paid plan.
create or replace function public.ensure_free_subscription()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.user_subscriptions
    where user_id = v_uid and status = 'active'
  ) then
    return;
  end if;

  insert into public.user_subscriptions (
    user_id, plan_id, status, starts_at, expires_at, auto_renew, updated_at
  )
  values (
    v_uid, 'free', 'active', now(), now() + interval '50 years', false, now()
  );
end;
$$;

revoke all on function public.ensure_free_subscription() from public, anon;
grant execute on function public.ensure_free_subscription() to authenticated;

comment on function public.ensure_free_subscription() is
  'Creates the free user_subscriptions row for auth.uid() if no active subscription exists. Takes no plan argument, so it can only ever grant the free plan.';

-- Cancelling is a downgrade, so it is safe to expose to the owner - but it must
-- run server side now that the subscription columns are not client-writable.
create or replace function public.cancel_my_subscription()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.user_subscriptions
     set status = 'cancelled',
         cancelled_at = now(),
         updated_at = now()
   where user_id = v_uid
     and status = 'active';

  -- Never touch an admin's role: the admin accounts carry subscription_role
  -- 'admin', and downgrading it here would lock them out of the admin panel.
  update public.users
     set subscription_plan = 'free',
         subscription_role = 'free_user',
         account_type = 'free',
         subscription_expires_at = null,
         updated_at = now()
   where id = v_uid
     and coalesce(subscription_role, '') not in ('admin', 'super_admin');
end;
$$;

revoke all on function public.cancel_my_subscription() from public, anon;
grant execute on function public.cancel_my_subscription() to authenticated;

comment on function public.cancel_my_subscription() is
  'Cancels the caller''s active subscription and returns them to the free plan. Downgrade only, and never changes an admin role.';

notify pgrst, 'reload schema';
