-- עדכון כפוי: גרסה מינימלית לכל פלטפורמה. אפליקציה ישנה יותר מציגה מסך «עדכן עכשיו».
create table if not exists public.app_config (
  id smallint primary key default 1 check (id = 1),
  min_version_ios text not null default '0.0.0',
  min_version_android text not null default '0.0.0',
  ios_store_url text not null default 'https://apps.apple.com/app/id6755930835',
  android_store_url text not null default 'https://play.google.com/store/apps/details?id=com.darkpool.app',
  update_message text,
  updated_at timestamptz not null default now()
);

insert into public.app_config (id) values (1) on conflict (id) do nothing;

alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
grant select on public.app_config to anon, authenticated;

drop policy if exists "app_config read" on public.app_config;
create policy "app_config read" on public.app_config for select to anon, authenticated using (true);

comment on table public.app_config is
  'Single row. min_version_* — older app builds show a blocking "update now" screen. Edit from the Supabase dashboard.';

notify pgrst, 'reload schema';
