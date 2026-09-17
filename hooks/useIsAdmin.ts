import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { appQueryKeys } from '../lib/appQueryKeys';

export interface IsAdminInfo {
  isAdmin: boolean;
  isLoading: boolean;
}

async function fetchIsAdmin(): Promise<boolean> {
  // subscription_role לא קריא ל-authenticated על public.users (column privilege).
  // get_my_profile מחזיר SETOF users ולכן PostgREST מסתיר את העמודה מהלקוח.
  // is_app_admin הוא אותו תנאי ש-RLS משתמש בו.
  const { data, error } = await supabase.rpc('is_app_admin');
  if (error) return false;
  return !!data;
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
