import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

export interface SubscriptionInfo {
  isPremium: boolean;
  planId: string | null;
  planName: string | null;
  role: string;
  isLoading: boolean;
}

// רשימת ה-roles שנחשבים פרימיום
const PREMIUM_ROLES = ['plus_user', 'premium_user', 'vip_user', 'admin'];

export function useSubscription(): SubscriptionInfo {
  const { user } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo>({
    isPremium: false,
    planId: null,
    planName: null,
    role: 'free_user',
    isLoading: true,
  });

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user?.id) {
        setSubscriptionInfo({
          isPremium: false,
          planId: null,
          planName: null,
          role: 'free_user',
          isLoading: false,
        });
        return;
      }

      try {
        // בדוק אם יש מנוי פעיל
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select(`
            *,
            subscription_plans (
              id,
              name,
              role
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data?.subscription_plans) {
          const role = data.subscription_plans.role || 'free_user';
          setSubscriptionInfo({
            isPremium: PREMIUM_ROLES.includes(role),
            planId: data.subscription_plans.id,
            planName: data.subscription_plans.name,
            role,
            isLoading: false,
          });
        } else {
          // אין מנוי פעיל - משתמש חינמי
          setSubscriptionInfo({
            isPremium: false,
            planId: 'free',
            planName: 'חינמי',
            role: 'free_user',
            isLoading: false,
          });
        }
      } catch {
        setSubscriptionInfo({
          isPremium: false,
          planId: null,
          planName: null,
          role: 'free_user',
          isLoading: false,
        });
      }
    };

    fetchSubscription();
  }, [user?.id]);

  return subscriptionInfo;
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


