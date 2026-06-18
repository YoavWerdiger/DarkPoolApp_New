import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

/** Roles שנחשבים אדמין לצורך פעולות ניהול (כמו יצירת חדשות). */
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

export interface IsAdminInfo {
  isAdmin: boolean;
  isLoading: boolean;
}

/**
 * Hook לבדיקת האם המשתמש המחובר הוא admin (לפי `users.subscription_role`).
 * משמש לחשיפת פעולות ניהול בלבד (למשל כפתור יצירת חדשה במסך החדשות).
 */
export function useIsAdmin(): IsAdminInfo {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(!!user?.id);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setIsAdmin(false);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('subscription_role')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error || !data) {
          setIsAdmin(false);
        } else {
          const role = String(data.subscription_role || '').toLowerCase();
          setIsAdmin(ADMIN_ROLES.has(role));
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { isAdmin, isLoading };
}
