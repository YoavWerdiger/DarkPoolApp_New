-- ספירת עוקבים גלובלית לגילוי. RLS על dark_pool_followed_investors מסתיר שורות
-- של אחרים, לכן צריך SECURITY DEFINER שמחזיר רק אגרגט — בלי user_id.
-- אין "$ copied": זה COUNT של שורות מעקב בלבד.

CREATE OR REPLACE FUNCTION public.dark_pool_investor_follow_counts()
RETURNS TABLE(
  person_id text,
  kind text,
  follower_count bigint,
  name text,
  image_url text,
  ticker text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.person_id,
    f.kind,
    count(*)::bigint AS follower_count,
    (array_agg(f.name ORDER BY f.created_at DESC))[1] AS name,
    (array_agg(f.image_url ORDER BY f.created_at DESC))[1] AS image_url,
    (array_agg(f.ticker ORDER BY f.created_at DESC))[1] AS ticker
  FROM public.dark_pool_followed_investors f
  GROUP BY f.person_id, f.kind
  HAVING count(*) > 0
  ORDER BY count(*) DESC, f.person_id
  LIMIT 40;
$$;

REVOKE ALL ON FUNCTION public.dark_pool_investor_follow_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dark_pool_investor_follow_counts() FROM anon;
GRANT EXECUTE ON FUNCTION public.dark_pool_investor_follow_counts() TO authenticated;

COMMENT ON FUNCTION public.dark_pool_investor_follow_counts() IS
  'Global follow COUNTs for Dark Pool Explore. Never a copied-USD figure.';
