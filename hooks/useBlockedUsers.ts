import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { blockedUsersKey, fetchBlockedUserIds } from '../services/moderationService';

/** קבוצת המשתמשים שהמשתמש המחובר חסם — התוכן שלהם מוסתר בכל הרשימות. */
export function useBlockedUsers(): Set<string> {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: blockedUsersKey(user?.id ?? 'anon'),
    queryFn: fetchBlockedUserIds,
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });
  return useMemo(() => new Set(data ?? []), [data]);
}
