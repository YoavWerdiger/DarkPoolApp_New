import { supabase } from '../lib/supabase';

export type PublicUserProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  memberSince: string | null;
};

export type UserFollowStats = {
  followerCount: number;
  followingCount: number;
};

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchPublicUserProfile(
  userId: string
): Promise<PublicUserProfile | null> {
  const { data, error } = await supabase
    .from('v_public_profiles')
    .select('id, display_name, full_name, profile_picture, avatar_url, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('fetchPublicUserProfile', error.message);
    return null;
  }
  if (!data) return null;

  const displayName =
    (data.display_name && String(data.display_name).trim()) ||
    (data.full_name && String(data.full_name).trim()) ||
    'חבר קהילה';

  return {
    id: String(data.id),
    displayName,
    avatarUrl: data.profile_picture || data.avatar_url || null,
    memberSince: data.created_at ? String(data.created_at) : null,
  };
}

export async function fetchUserFollowStats(
  userId: string
): Promise<UserFollowStats> {
  const { data, error } = await supabase.rpc('get_user_follow_stats', {
    p_user_id: userId,
  });

  if (error) {
    console.warn('fetchUserFollowStats', error.message);
    return { followerCount: 0, followingCount: 0 };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    followerCount: Number(row?.follower_count ?? 0),
    followingCount: Number(row?.following_count ?? 0),
  };
}

export async function isFollowingUser(targetUserId: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid || uid === targetUserId) return false;

  const { data, error } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('follower_id', uid)
    .eq('following_id', targetUserId)
    .maybeSingle();

  if (error) {
    console.warn('isFollowingUser', error.message);
    return false;
  }
  return !!data;
}

export async function followUser(targetUserId: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error('יש להתחבר');
  if (uid === targetUserId) throw new Error('לא ניתן לעקוב אחרי עצמך');

  const { error } = await supabase
    .from('user_follows')
    .insert({ follower_id: uid, following_id: targetUserId });

  if (error && error.code !== '23505') throw error;
}

export async function unfollowUser(targetUserId: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error('יש להתחבר');

  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', uid)
    .eq('following_id', targetUserId);

  if (error) throw error;
}

export async function toggleFollowUser(targetUserId: string): Promise<boolean> {
  const following = await isFollowingUser(targetUserId);
  if (following) {
    await unfollowUser(targetUserId);
    return false;
  }
  await followUser(targetUserId);
  return true;
}
