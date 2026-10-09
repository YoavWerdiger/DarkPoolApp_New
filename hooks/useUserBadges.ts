import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import { appQueryKeys } from '../lib/appQueryKeys';

export type UserBadgesData = {
  isVerified: boolean;
  /** ימי מנוי בתשלום מצטברים; null = מעולם לא שילם */
  paidDays: number | null;
};

const EMPTY: UserBadgesData = { isVerified: false, paidDays: null };
export const USER_BADGES_STALE_MS = 10 * 60 * 1000;
const BATCH_MAX = 200;

type Waiter = { resolve: (v: UserBadgesData) => void; reject: (e: unknown) => void };

// אצווה: כל הבקשות באותו tick → קריאת RPC אחת
let pending = new Map<string, Waiter[]>();
let scheduled = false;

async function flush() {
  scheduled = false;
  const batch = pending;
  pending = new Map();
  const ids = [...batch.keys()];
  for (let i = 0; i < ids.length; i += BATCH_MAX) {
    const chunk = ids.slice(i, i + BATCH_MAX);
    try {
      const { data, error } = await supabase.rpc('get_user_badges', { p_user_ids: chunk });
      if (error) throw error;
      const byId = new Map<string, UserBadgesData>();
      for (const row of (data ?? []) as { user_id: string; is_verified: boolean; paid_days: number | null }[]) {
        byId.set(row.user_id, {
          isVerified: !!row.is_verified,
          paidDays: row.paid_days == null ? null : Number(row.paid_days),
        });
      }
      for (const id of chunk) {
        const v = byId.get(id) ?? EMPTY;
        batch.get(id)?.forEach((w) => w.resolve(v));
      }
    } catch (e) {
      for (const id of chunk) batch.get(id)?.forEach((w) => w.reject(e));
    }
  }
}

function loadUserBadges(userId: string): Promise<UserBadgesData> {
  return new Promise((resolve, reject) => {
    const list = pending.get(userId);
    if (list) list.push({ resolve, reject });
    else pending.set(userId, [{ resolve, reject }]);
    if (!scheduled) {
      scheduled = true;
      setTimeout(() => {
        void flush();
      }, 0);
    }
  });
}

/** תגי משתמש לפי id — cache משותף (react-query), נטען באצוות */
export function useUserBadges(userId: string | null | undefined): UserBadgesData | undefined {
  const { data } = useQuery({
    queryKey: appQueryKeys.userBadges(userId ?? ''),
    queryFn: () => loadUserBadges(userId as string),
    enabled: !!userId,
    staleTime: USER_BADGES_STALE_MS,
    retry: 1,
  });
  return userId ? data : undefined;
}

/** אחרי שינוי מנהל — לעדכן את ה-cache מיד */
export function setUserBadgesCache(userId: string, patch: Partial<UserBadgesData>) {
  const key = appQueryKeys.userBadges(userId);
  const prev = queryClient.getQueryData<UserBadgesData>(key) ?? EMPTY;
  queryClient.setQueryData<UserBadgesData>(key, { ...prev, ...patch });
}

export function invalidateUserBadges(userId: string) {
  void queryClient.invalidateQueries({ queryKey: appQueryKeys.userBadges(userId) });
}
