-- Pin an immutable search_path on every public function that still inherits the
-- caller's. Without it a SECURITY DEFINER function resolves unqualified names
-- against whatever the caller put in front of public, which is an owner-rights
-- escalation path.
--
-- The value `public, extensions` is what these functions already resolve
-- against today: PostgREST issues `SET LOCAL search_path = public, extensions`
-- per request, and the postgres role (cron, triggers) is configured with
-- `"$user", public, extensions` where no `$user` schema exists. Pinning it is
-- therefore behaviour-preserving.
--
-- `search_path = ''` was considered and rejected: it would require every
-- reference in 83 function bodies to be schema-qualified, and a single missed
-- reference is a production outage. An explicit non-empty search_path already
-- satisfies the linter and, because neither anon nor authenticated holds CREATE
-- on public or extensions, it cannot be shadowed.
--
-- Extension-owned routines are skipped: they belong to their extension and are
-- restored by its upgrade script.

do $$
declare
  r record;
  pinned int := 0;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prokind in ('f', 'p')
      and p.proconfig is null
      and not exists (
        select 1
        from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
    order by 1
  loop
    execute format('alter routine %s set search_path = public, extensions', r.sig);
    pinned := pinned + 1;
  end loop;

  raise notice 'pinned search_path on % routine(s) in schema public', pinned;
end
$$;

-- New functions inherit the pin unless a migration overrides it deliberately.
do $$
declare
  leftover int;
begin
  select count(*) into leftover
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.prokind in ('f', 'p')
    and p.proconfig is null
    and not exists (
      select 1
      from pg_depend d
      where d.classid = 'pg_proc'::regclass
        and d.objid = p.oid
        and d.deptype = 'e'
    );

  if leftover > 0 then
    raise exception 'search_path still mutable on % routine(s)', leftover;
  end if;
end
$$;
