import { supabase } from '../../lib/supabase';

export type AdminGrowthPoint = { date: string; count: number };

export type AdminStatsBucket = {
  key: string;
  label: string;
  count: number;
};

export type AdminStats = {
  totals: {
    users: number;
    newToday: number;
    newWeek: number;
    newMonth: number;
    muted: number;
    suspended: number;
    premium: number;
    activeDevices: number;
  };
  /** פירוט משתמשים לפי subscription_role */
  byRole?: AdminStatsBucket[];
  /** פירוט משתמשים לפי subscription_plan */
  byPlan?: AdminStatsBucket[];
  /** הכנסות מתשלומים successful (₪) */
  revenue?: {
    month: number;
    total: number;
  };
  /** סה״כ משתמשים מצטבר לפי יום (כולל baseline לפני החלון) */
  growthSeries: AdminGrowthPoint[];
};

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  profile_picture: string | null;
  subscription_role: string | null;
  subscription_plan: string | null;
  created_at: string | null;
  last_active: string | null;
  last_seen: string | null;
  is_muted: boolean;
  muted_reason: string | null;
  is_suspended: boolean;
  suspended_reason: string | null;
  phone: string | null;
  /** Onboarding questionnaire (users.intro_data) */
  intro_data?: Record<string, unknown> | null;
};

export type AdminPushCampaign = {
  id: string;
  title: string;
  body: string;
  audience: string;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
  sent_at: string | null;
};

export type AdminTicketRow = {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  status: 'new' | 'in_progress' | 'closed';
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  users?: {
    email?: string | null;
    full_name?: string | null;
    display_name?: string | null;
  } | null;
};

export type AdminUserFilter = 'all' | 'muted' | 'suspended' | 'premium';
export type AdminPushAudience = 'all' | 'free' | 'premium' | 'active_7d' | 'custom';

export type CardComAdminOperation = 'ChargeOnly' | 'CreateTokenOnly';

export type CardComConfigView = {
  apiName: string;
  apiPasswordMasked: string;
  hasPassword: boolean;
  terminalNumber: number;
  operation: CardComAdminOperation;
  source: 'db' | 'env';
  updatedAt: string | null;
};

export type AdminPaymentTransaction = {
  id: string;
  user_id: string | null;
  plan_id: string;
  amount: number;
  currency: string | null;
  status: string;
  cardcom_transaction_id: string | null;
  cardcom_low_profile_id: string | null;
  cardcom_operation: string | null;
  cardcom_response_code: string | null;
  cardcom_description: string | null;
  cardcom_document_type: string | null;
  cardcom_document_number: number | null;
  cardcom_document_url?: string | null;
  cardcom_token: string | null;
  cardcom_token_card_year: number | null;
  cardcom_token_card_month: number | null;
  hasToken?: boolean;
  created_at: string | null;
  updated_at: string | null;
  user?: {
    email?: string | null;
    full_name?: string | null;
    display_name?: string | null;
  } | null;
};

export type AdminUserSubscription = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  auto_renew: boolean | null;
  starts_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  cardcom_token: string | null;
  cardcom_token_exp_date: string | null;
  card_last4_digits: string | null;
  card_brand: string | null;
  source_transaction_id: string | null;
  hasToken?: boolean;
  next_cycle_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
  user?: {
    email?: string | null;
    full_name?: string | null;
    display_name?: string | null;
  } | null;
};

const ADMIN_ERROR_HE: Record<string, string> = {
  Unauthorized: 'אין הרשאה — יש להתחבר מחדש',
  Forbidden: 'אין הרשאת מנהל',
  'Forbidden — admin only': 'אין הרשאת מנהל',
  'userId required': 'חסר מזהה משתמש',
  'Cannot mute yourself': 'לא ניתן להשתיק את עצמך',
  'Cannot suspend yourself': 'לא ניתן להשעות את עצמך',
  'Cannot change own premium': 'לא ניתן לשנות פרימיום לעצמך',
  'Cannot delete yourself': 'לא ניתן למחוק את עצמך',
  'Cannot delete admin users': 'לא ניתן למחוק מנהל',
  'Cannot change admin subscription via this action': 'לא ניתן לשנות מנוי למנהל דרך פעולה זו',
  'User not found': 'המשתמש לא נמצא',
  'User email not found': 'לא נמצא אימייל למשתמש',
  'Invalid JSON': 'בקשה לא תקינה',
  'Method not allowed': 'שיטת בקשה לא נתמכת',
};

function localizeAdminError(raw: string): string {
  const trimmed = raw.trim();
  return ADMIN_ERROR_HE[trimmed] ?? trimmed;
}

async function extractInvokeError(error: Error & { context?: unknown }, data: unknown): Promise<string> {
  if (data && typeof data === 'object' && data !== null && 'error' in data) {
    const bodyErr = (data as { error?: unknown }).error;
    if (bodyErr != null && String(bodyErr).trim()) {
      return localizeAdminError(String(bodyErr));
    }
  }

  const ctx = error.context as
    | { status?: number; text?: () => Promise<string>; json?: () => Promise<unknown>; clone?: () => { text: () => Promise<string> } }
    | undefined;

  if (ctx && typeof ctx.text === 'function') {
    try {
      // clone() כדי לא לצרוך את גוף ה-Response המקורי; אם אין clone נופלים ל-ctx עצמו
      const readable: { text?: () => Promise<string> } =
        typeof ctx.clone === 'function' ? ctx.clone() : ctx;
      const rawText = typeof readable.text === 'function' ? await readable.text() : '';
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText) as { error?: unknown };
          if (parsed?.error != null) return localizeAdminError(String(parsed.error));
        } catch {
          if (rawText.trim()) return localizeAdminError(rawText.trim().slice(0, 300));
        }
      }
    } catch {
      /* fall through */
    }
  }

  const generic = error.message || '';
  if (/non-2xx/i.test(generic)) {
    return 'פעולת המנהל נכשלה — נסו שוב';
  }
  return localizeAdminError(generic || 'פעולת המנהל נכשלה');
}

async function invokeAdminApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: { action, ...payload },
  });

  if (data && typeof data === 'object' && data !== null && 'error' in data && (data as { error?: unknown }).error) {
    // Some non-2xx paths still hydrate `data` with the JSON body.
    throw new Error(localizeAdminError(String((data as { error: unknown }).error)));
  }

  if (error) {
    throw new Error(await extractInvokeError(error as Error & { context?: unknown }, data));
  }

  return data as T;
}

/** CardCom admin — dedicated slim function (also available on admin-api after that deploy). */
async function invokeAdminCardcom<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-cardcom', {
    body: { action, ...payload },
  });

  if (data && typeof data === 'object' && data !== null && 'error' in data && (data as { error?: unknown }).error) {
    throw new Error(localizeAdminError(String((data as { error: unknown }).error)));
  }

  if (error) {
    throw new Error(await extractInvokeError(error as Error & { context?: unknown }, data));
  }

  return data as T;
}

export const adminService = {
  getStats: (opts: { days?: 7 | 30 | 90 } = {}) =>
    invokeAdminApi<AdminStats>('stats', {
      days: opts.days === 7 || opts.days === 90 ? opts.days : 30,
    }),

  listUsers: (opts: {
    query?: string;
    page?: number;
    pageSize?: number;
    filter?: AdminUserFilter;
  } = {}) =>
    invokeAdminApi<{
      users: AdminUserRow[];
      total: number;
      page: number;
      pageSize: number;
    }>('list_users', {
      query: opts.query ?? '',
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 30,
      filter: opts.filter === 'all' ? undefined : opts.filter,
    }),

  setMute: (userId: string, muted: boolean, reason?: string) =>
    invokeAdminApi<{ user: Pick<AdminUserRow, 'id' | 'is_muted' | 'muted_reason'> }>('set_mute', {
      userId,
      muted,
      reason,
    }),

  setSuspend: (userId: string, suspended: boolean, reason?: string) =>
    invokeAdminApi<{ user: Pick<AdminUserRow, 'id' | 'is_suspended' | 'suspended_reason'> }>(
      'set_suspend',
      { userId, suspended, reason },
    ),

  setPremium: (userId: string, grant: boolean) =>
    invokeAdminApi<{
      user: Pick<AdminUserRow, 'id' | 'subscription_role' | 'subscription_plan'>;
    }>('set_premium', { userId, grant }),

  deleteUser: (userId: string) =>
    invokeAdminApi<{ ok: boolean; partial?: boolean }>('delete_user', { userId }),

  resetPassword: (userId: string) =>
    invokeAdminApi<{ ok: boolean; email: string; actionLink: string | null }>('reset_password', {
      userId,
    }),

  listTickets: (opts: { status?: string; page?: number; pageSize?: number } = {}) =>
    invokeAdminApi<{
      tickets: AdminTicketRow[];
      total: number;
      page: number;
      pageSize: number;
    }>('list_tickets', opts),

  updateTicket: (ticketId: string, patch: { status?: string; adminNote?: string }) =>
    invokeAdminApi<{ ticket: Pick<AdminTicketRow, 'id' | 'status' | 'admin_note' | 'updated_at'> }>(
      'update_ticket',
      { ticketId, ...patch },
    ),

  sendPush: (opts: {
    title: string;
    body: string;
    audience: AdminPushAudience;
    userIds?: string[];
    data?: Record<string, unknown>;
  }) =>
    invokeAdminApi<{
      campaignId: string;
      audienceSize: number;
      tokens: number;
      sent: number;
      failed: number;
    }>('send_push', opts),

  listCampaigns: () =>
    invokeAdminApi<{ campaigns: AdminPushCampaign[] }>('list_campaigns'),

  getCardcomConfig: () =>
    invokeAdminCardcom<{
      config: CardComConfigView | null;
      defaults: {
        apiName: string;
        terminalNumber: number;
        operation: CardComAdminOperation;
      };
    }>('get_cardcom_config'),

  upsertCardcomConfig: (opts: {
    apiName: string;
    terminalNumber: number;
    operation: CardComAdminOperation;
    apiPassword?: string;
    clearPassword?: boolean;
  }) =>
    invokeAdminCardcom<{ config: CardComConfigView }>('upsert_cardcom_config', {
      apiName: opts.apiName,
      terminalNumber: opts.terminalNumber,
      operation: opts.operation,
      apiPassword: opts.apiPassword,
      clearPassword: opts.clearPassword,
    }),

  listPaymentTransactions: (opts: {
    query?: string;
    page?: number;
    pageSize?: number;
    status?: string;
    planId?: string;
    userId?: string;
    hasToken?: boolean;
  } = {}) =>
    invokeAdminCardcom<{
      transactions: AdminPaymentTransaction[];
      total: number;
      page: number;
      pageSize: number;
    }>('list_payment_transactions', {
      query: opts.query ?? '',
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 30,
      status: opts.status,
      planId: opts.planId,
      userId: opts.userId,
      hasToken: opts.hasToken,
    }),

  listUserSubscriptions: (opts: {
    query?: string;
    page?: number;
    pageSize?: number;
    status?: string;
    planId?: string;
    userId?: string;
    hasToken?: boolean;
  } = {}) =>
    invokeAdminCardcom<{
      subscriptions: AdminUserSubscription[];
      total: number;
      page: number;
      pageSize: number;
    }>('list_user_subscriptions', {
      query: opts.query ?? '',
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 30,
      status: opts.status,
      planId: opts.planId,
      userId: opts.userId,
      hasToken: opts.hasToken,
    }),

  getBillingOverview: (opts: { userId?: string } = {}) =>
    invokeAdminCardcom<{
      month: {
        total: number;
        success: number;
        failed: number;
        pending: number;
        revenue: number;
      };
      activeSubscriptions: number;
      upcoming: AdminUserSubscription[];
    }>('billing_overview', { userId: opts.userId }),

  getPaymentTransaction: (transactionId: string) =>
    invokeAdminCardcom<{
      transaction: AdminPaymentTransaction & {
        cardcom_token_present?: boolean;
        cardcom_token_token_approval_number?: string | null;
        cardcom_token_card_owner_identity_number?: string | null;
      };
      user: {
        id?: string;
        email?: string | null;
        full_name?: string | null;
        display_name?: string | null;
        phone?: string | null;
        subscription_plan?: string | null;
        subscription_role?: string | null;
      } | null;
      actions: { canRefund: boolean; canChargeDeferred: boolean };
    }>('get_payment_transaction', { transactionId }),

  refundPayment: (transactionId: string) =>
    invokeAdminCardcom<{
      success: boolean;
      responseCode?: number;
      description?: string | null;
      newDocumentNumber?: number | null;
      newDocumentType?: string | null;
      transaction?: AdminPaymentTransaction;
      error?: string;
    }>('refund_payment', { transactionId }),

  chargeDeferred: (transactionId: string) =>
    invokeAdminCardcom<{
      success: boolean;
      responseCode?: number;
      description?: string | null;
      tranzactionId?: number | null;
      documentNumber?: number | null;
      documentType?: string | null;
      transaction?: AdminPaymentTransaction;
      error?: string;
    }>('charge_deferred', { transactionId }),
};
