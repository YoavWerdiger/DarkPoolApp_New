-- רשימת עוקבים / נעקבים לפרופיל ציבורי — רק פרטים ציבוריים (v_public_profiles), למשתמשים מחוברים
create or replace function public.get_user_follow_list(
  p_user_id uuid,
  p_kind text default 'followers',
  p_limit int default 50,
  p_offset int default 0
)
returns table(id uuid, display_name text, profile_picture text, followed_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.full_name), ''), 'חבר קהילה') as display_name,
         coalesce(p.profile_picture, p.avatar_url) as profile_picture, f.created_at as followed_at
  from public.user_follows f
  join public.v_public_profiles p
    on p.id = case when p_kind = 'following' then f.following_id else f.follower_id end
  where auth.uid() is not null
    and (case when p_kind = 'following' then f.follower_id else f.following_id end) = p_user_id
  order by f.created_at desc
  limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
$$;
revoke all on function public.get_user_follow_list(uuid, text, int, int) from public, anon;
grant execute on function public.get_user_follow_list(uuid, text, int, int) to authenticated;
