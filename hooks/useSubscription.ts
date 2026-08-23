import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { appQueryKeys } from '../lib/appQueryKeys';
import { SUBSCRIPTION_PLANS } from '../services/paymentService';

export interface SubscriptionInfo {
  isPremium: boolean;
  planId: string | null;
  planName: string | null;
  role: string;
  isLoading: boolean;
  /** `user_subscriptions.status` when a paid row exists */
  status: string | null;
  startsAt: string | null;
  /** Period end — used as next billing date when `autoRenew` is true */
  expiresAt: string | null;
  autoRenew: boolean | null;
  cardLast4: string | null;
  cardBrand: string | null;
  hasPaymentToken: boolean;
  planPrice: number | null;
  planPeriod: string | null;
  refetch: () => void;
}

type SubscriptionData = Omit<SubscriptionInfo, 'isLoading' | 'refetch'>;

// רשימת ה-roles שנחשבים פרימיום
const PREMIUM_ROLES = ['plus_user', 'premium_user', 'vip_user', 'admin'];

const FREE_SUBSCRIPTION: SubscriptionData = {
  isPremium: false,
  planId: 'free',
  planName: 'חינמי',
  role: 'free_user',
  status: null,
  startsAt: null,
  expiresAt: null,
  autoRenew: null,
  cardLast4: null,
  cardBrand: null,
  hasPaymentToken: false,
  planPrice: 0,
  planPeriod: 'monthly',
};

function planMeta(planId: string | null | undefined, role?: string | null): SubscriptionData {
  if (!planId || planId === 'free') return FREE_SUBSCRIPTION;
  const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
  const resolvedRole = role || plan?.role || 'free_user';
  return {
    isPremium: PREMIUM_ROLES.includes(resolvedRole),
    planId,
    planName: plan?.name || planId,
    role: resolvedRole,
    status: null,
    startsAt: null,
    expiresAt: null,
    autoRenew: null,
    cardLast4: null,
    cardBrand: null,
    hasPaymentToken: false,
    planPrice: plan?.price ?? null,
    planPeriod: plan?.period ?? null,
  };
}

type PlanJoin = {
  id?: string;
  name?: string;
  role?: string;
  price?: number | null;
  period?: string | null;
};

type SubscriptionRow = {
  plan_id?: string | null;
  status?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  auto_renew?: boolean | null;
  card_last4_digits?: string | null;
  card_brand?: string | null;
  cardcom_token?: string | null;
  subscription_plans?: PlanJoin | PlanJoin[] | null;
};

const SUBSCRIPTION_SELECT = `
  id,
  plan_id,
  status,
  starts_at,
  expires_at,
  auto_renew,
  card_last4_digits,
  card_brand,
  cardcom_token,
  subscription_plans (
    id,
    name,
    role,
    price,
    period
  )
`;

function mapSubscriptionRow(
  data: SubscriptionRow,
  opts?: { forceNotPremium?: boolean },
): SubscriptionData {
  const plan = (data.subscription_plans || null) as PlanJoin | PlanJoin[] | null;
  const planRow = Array.isArray(plan) ? plan[0] : plan;
  const role = planRow?.role || 'free_user';
  const planId = planRow?.id || data.plan_id || null;
  const catalog =
    planId && planId in SUBSCRIPTION_PLANS
      ? SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS]
      : null;
  const status = data.status ?? null;
  const isActivePaid = Boolean(planId && planId !== 'free' && status === 'active');

  return {
    isPremium: opts?.forceNotPremium
      ? false
      : isActivePaid && PREMIUM_ROLES.includes(role),
    planId,
    planName: planRow?.name || catalog?.name || planId,
    role: isActivePaid ? role : 'free_user',
    status,
    startsAt: data.starts_at ?? null,
    expiresAt: data.expires_at ?? null,
    autoRenew: data.auto_renew ?? null,
    cardLast4: data.card_last4_digits ?? null,
    cardBrand: data.card_brand ?? null,
    hasPaymentToken: Boolean(data.cardcom_token),
    planPrice: planRow?.price ?? catalog?.price ?? null,
    planPeriod: planRow?.period ?? catalog?.period ?? null,
  };
}

async function fetchSubscription(userId: string): Promise<SubscriptionData> {
  // Explicit columns — never pull cardcom_token into the client response body as a secret field.
  // We only need a boolean "has token" for payment-method UI.
  const { data: activeRow } = await supabase
    .from('user_subscriptions')
    .select(SUBSCRIPTION_SELECT)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeRow) {
    const mapped = mapSubscriptionRow(activeRow as SubscriptionRow);
    // Active paid → return immediately. Active free → keep looking for a recent paid row
    // (cancelled / expired / past_due) so BillingScreen can show restricted messaging.
    if (mapped.planId && mapped.planId !== 'free') {
      return mapped;
    }
  }

  const { data: latestPaid } = await supabase
    .from('user_subscriptions')
    .select(SUBSCRIPTION_SELECT)
    .eq('user_id', userId)
    .neq('plan_id', 'free')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPaid) {
    return mapSubscriptionRow(latestPaid as SubscriptionRow, { forceNotPremium: true });
  }

  if (activeRow) {
    return mapSubscriptionRow(activeRow as SubscriptionRow);
  }

  // Fallback: עמודה על users (webhook / רישום) — למנוע מצב "שילם אבל free".
  // עמודות המנוי לא קריאות ל-`authenticated`, ולכן דרך ה-RPC של הפרופיל שלי.
  const { data: rows } = await supabase.rpc('get_my_profile');
  const userRow = Array.isArray(rows) ? rows[0] : rows;

  if (userRow) {
    const planId = userRow.subscription_plan || userRow.account_type;
    if (planId && planId !== 'free') {
      const meta = planMeta(planId, userRow.subscription_role);
      return {
        ...meta,
        status: 'active',
        expiresAt: userRow.subscription_expires_at ?? null,
        autoRenew: null,
      };
    }
  }

  return FREE_SUBSCRIPTION;
}

/**
 * נתוני מנוי/הרשאה — משותף בין כל הצרכנים דרך React Query (קריאה אחת בלבד).
 * cache בזיכרון בלבד (לא נשמר לדיסק) כדי לא להציג הרשאה ישנה אחרי שינוי.
 * כולל שדות billing למסך מנוי וחיובים (מועד חיוב, אמצעי תשלום).
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

  const refetch = () => {
    void query.refetch();
  };

  if (!userId) {
    return {
      isPremium: false,
      planId: null,
      planName: null,
      role: 'free_user',
      isLoading: false,
      status: null,
      startsAt: null,
      expiresAt: null,
      autoRenew: null,
      cardLast4: null,
      cardBrand: null,
      hasPaymentToken: false,
      planPrice: null,
      planPeriod: null,
      refetch,
    };
  }

  const data = query.data;
  return {
    isPremium: data?.isPremium ?? false,
    planId: data?.planId ?? null,
    planName: data?.planName ?? null,
    role: data?.role ?? 'free_user',
    isLoading: query.isLoading,
    status: data?.status ?? null,
    startsAt: data?.startsAt ?? null,
    expiresAt: data?.expiresAt ?? null,
    autoRenew: data?.autoRenew ?? null,
    cardLast4: data?.cardLast4 ?? null,
    cardBrand: data?.cardBrand ?? null,
    hasPaymentToken: data?.hasPaymentToken ?? false,
    planPrice: data?.planPrice ?? null,
    planPeriod: data?.planPeriod ?? null,
    refetch,
  };
}

// פונקציה לבדיקה אם קבוצה היא חינמית
export function isFreeGroup(groupName: string): boolean {
  const freeGroupNames = [
    'קהילה חינמית',
    'הכרזות',
    '🔔 הכרזות',
  ];

  return freeGroupNames.some(
    (name) => groupName.includes(name) || groupName.toLowerCase().includes('free'),
  );
}
