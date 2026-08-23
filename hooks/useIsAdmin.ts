import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { appQueryKeys } from '../lib/appQueryKeys';

/** Roles שנחשבים אדמין לצורך פעולות ניהול (כמו יצירת חדשות). */
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

export interface IsAdminInfo {
  isAdmin: boolean;
  isLoading: boolean;
}

async function fetchIsAdmin(): Promise<boolean> {
  // subscription_role לא קריא ל-`authenticated` על public.users; הפרופיל
  // של המשתמש עצמו מגיע מ-RPC שנעול על auth.uid().
  const { data: rows, error } = await supabase.rpc('get_my_profile');
  const data = Array.isArray(rows) ? rows[0] : rows;

  if (error || !data) return false;
  const role = String(data.subscription_role || '').toLowerCase();
  return ADMIN_ROLES.has(role);
}

/**
 * Hook לבדיקת האם המשתמש המחובר הוא admin (לפי `users.subscription_role`).
 * משמש לחשיפת פעולות ניהול בלבד (למשל כפתור יצירת חדשה במסך החדשות).
 * משותף דרך React Query (cache בזיכרון בלבד).
 */
export function useIsAdmin(): IsAdminInfo {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery<boolean>({
    queryKey: appQueryKeys.userIsAdmin(userId ?? 'anon'),
    queryFn: () => fetchIsAdmin(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  if (!userId) return { isAdmin: false, isLoading: false };
  return { isAdmin: query.data ?? false, isLoading: query.isLoading };
}
