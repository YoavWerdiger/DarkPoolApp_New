import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { appQueryKeys } from '../lib/appQueryKeys';

export interface SubscriptionInfo {
  isPremium: boolean;
  planId: string | null;
  planName: string | null;
  role: string;
  isLoading: boolean;
}

type SubscriptionData = Omit<SubscriptionInfo, 'isLoading'>;

// רשימת ה-roles שנחשבים פרימיום
const PREMIUM_ROLES = ['plus_user', 'premium_user', 'vip_user', 'admin'];

const FREE_SUBSCRIPTION: SubscriptionData = {
  isPremium: false,
  planId: 'free',
  planName: 'חינמי',
  role: 'free_user',
};

async function fetchSubscription(userId: string): Promise<SubscriptionData> {
  const { data } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      subscription_plans (
        id,
        name,
        role
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (data?.subscription_plans) {
    const role = data.subscription_plans.role || 'free_user';
    return {
      isPremium: PREMIUM_ROLES.includes(role),
      planId: data.subscription_plans.id,
      planName: data.subscription_plans.name,
      role,
    };
  }
  return FREE_SUBSCRIPTION;
}

/**
 * נתוני מנוי/הרשאה — משותף בין כל הצרכנים דרך React Query (קריאה אחת בלבד).
 * cache בזיכרון בלבד (לא נשמר לדיסק) כדי לא להציג הרשאה ישנה אחרי שינוי.
 */
export function useSubscription(): SubscriptionInfo {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery<SubscriptionData>({
    queryKey: appQueryKeys.userSubscription(userId ?? 'anon'),
    queryFn: () => fetchSubscription(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  if (!userId) {
    return { isPremium: false, planId: null, planName: null, role: 'free_user', isLoading: false };
  }

  const data = query.data;
  return {
    isPremium: data?.isPremium ?? false,
    planId: data?.planId ?? null,
    planName: data?.planName ?? null,
    role: data?.role ?? 'free_user',
    isLoading: query.isLoading,
  };
}

// פונקציה לבדיקה אם קבוצה היא חינמית
export function isFreeGroup(groupName: string): boolean {
  const freeGroupNames = [
    'קהילה חינמית',
    'הכרזות',
    '🔔 הכרזות',
  ];
  
  return freeGroupNames.some(name => 
    groupName.includes(name) || groupName.toLowerCase().includes('free')
  );
}


