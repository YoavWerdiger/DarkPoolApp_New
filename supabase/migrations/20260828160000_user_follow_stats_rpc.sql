-- Aggregate follow counts for any user profile (RLS on user_follows hides other people's edges)
CREATE OR REPLACE FUNCTION public.get_user_follow_stats(p_user_id uuid)
RETURNS TABLE(follower_count bigint, following_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::bigint FROM public.user_follows WHERE following_id = p_user_id),
    (SELECT count(*)::bigint FROM public.user_follows WHERE follower_id = p_user_id);
$$;

REVOKE ALL ON FUNCTION public.get_user_follow_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_follow_stats(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_user_follow_stats(uuid) IS
  'Public follower/following counts for community user profiles';
