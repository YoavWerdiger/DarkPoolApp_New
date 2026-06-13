-- מומלצים מנתונים אמיתיים ב-DB (לא mock קבוע)

WITH ranked_insiders AS (
  SELECT
    insider_name,
    upper(ticker) AS ticker,
    max(company_name) AS company_name,
    max(insider_logo_url) AS image_url,
    count(*)::int AS trade_count,
    row_number() OVER (ORDER BY count(*) DESC, max(filed_at) DESC) AS rn
  FROM public.dark_pool_insider_buys
  WHERE insider_name IS NOT NULL AND trim(insider_name) <> '' AND ticker IS NOT NULL
  GROUP BY insider_name, upper(ticker)
)
INSERT INTO public.dark_pool_featured_profiles
  (sort_order, name, subtitle, image_url, person_id, kind, ticker)
SELECT
  rn,
  insider_name,
  coalesce(nullif(trim(company_name), ''), ticker) || ' · ' || ticker,
  image_url,
  ticker || ':' || insider_name,
  'insider',
  ticker
FROM ranked_insiders
WHERE rn <= 5
ON CONFLICT (person_id, kind) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  name = EXCLUDED.name,
  subtitle = EXCLUDED.subtitle,
  image_url = COALESCE(EXCLUDED.image_url, dark_pool_featured_profiles.image_url),
  ticker = EXCLUDED.ticker,
  is_active = TRUE;

INSERT INTO public.dark_pool_featured_profiles
  (sort_order, name, subtitle, image_url, person_id, kind, ticker)
SELECT
  6,
  politician_name,
  'קונגרס · STIR',
  image_url,
  politician_id,
  'politician',
  NULL
FROM (
  SELECT
    politician_id,
    politician_name,
    max(politician_image_url) AS image_url,
    count(*)::int AS trade_count
  FROM public.dark_pool_congress_trades
  GROUP BY politician_id, politician_name
  ORDER BY count(*) DESC
  LIMIT 1
) top_pol
WHERE politician_id IS NOT NULL
ON CONFLICT (person_id, kind) DO UPDATE SET
  name = EXCLUDED.name,
  subtitle = EXCLUDED.subtitle,
  image_url = COALESCE(EXCLUDED.image_url, dark_pool_featured_profiles.image_url),
  is_active = TRUE;
