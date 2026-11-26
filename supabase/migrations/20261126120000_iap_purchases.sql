-- רכישות בתוך האפליקציה (Apple App Store / Google Play) — מחליף את CardCom בבילד המובייל.
--
-- כל רכישה מאומתת בשרת בלבד (Edge Function iap-verify מול App Store Server API / Google Play
-- Developer API), ורק אז נכתבים users.subscription_* / user_subscriptions / course_purchases.
-- חידושים, ביטולים והחזרים מגיעים מ-iap-apple-notifications ו-iap-google-notifications.
--
-- store_key — מזהה יציב לאורך חידושים:
--   ios:     originalTransactionId
--   android: purchaseToken (בשדרוג/שנמוך Google מנפיקה token חדש עם linkedPurchaseToken)

create table if not exists public.iap_purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  store_key text not null,
  product_id text not null,
  -- המזהה שלנו: monthly / quarterly / yearly / course:<course_id>
  plan_id text not null,
  kind text not null check (kind in ('subscription', 'one_time')),
  status text not null check (status in ('active', 'expired', 'revoked', 'pending', 'grace')),
  last_transaction_id text,
  expires_at timestamptz,
  auto_renew boolean,
  environment text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, store_key)
);

create index if not exists iap_purchases_user_idx on public.iap_purchases (user_id);

alter table public.iap_purchases enable row level security;
revoke all on public.iap_purchases from anon, authenticated;
grant select on public.iap_purchases to authenticated;

drop policy if exists "iap_purchases read own" on public.iap_purchases;
create policy "iap_purchases read own" on public.iap_purchases
  for select to authenticated using (user_id = (select auth.uid()));

comment on table public.iap_purchases is
  'Apple/Google in-app purchases, verified server side. Written only by the iap-* Edge Functions (service role).';

notify pgrst, 'reload schema';
