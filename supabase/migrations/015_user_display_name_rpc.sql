-- ============================================================================
-- 015_user_display_name_rpc.sql
-- פונקציה בטוחה לשליפת שמות תצוגה בלבד — עוקפת RLS של public.users,
-- חושפת אך ורק id + display_name (לא email, phone, וכו').
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_display_names(user_ids UUID[])
RETURNS TABLE(id UUID, display_name TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    u.id,
    COALESCE(NULLIF(TRIM(u.display_name), ''), NULLIF(TRIM(u.full_name), ''), 'משתמש') AS display_name
  FROM public.users u
  WHERE u.id = ANY(user_ids);
$$;

-- הרשאה לכל משתמש מאומת לקרוא לפונקציה
REVOKE ALL ON FUNCTION public.get_user_display_names(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_display_names(UUID[]) TO authenticated;

COMMENT ON FUNCTION public.get_user_display_names IS
  'שולפת display_name בלבד לרשימת IDs — SECURITY DEFINER, עוקפת RLS של public.users';
