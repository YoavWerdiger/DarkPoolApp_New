import { supabase } from '../lib/supabase';

/**
 * CardCom secrets live ONLY in `cardcom_config` (Admin) or Edge Function secrets.
 * Never add EXPO_PUBLIC_CARDCOM_* — those were previously bundled into APK/IPA.
 *
 * Key rotation (ops): after credentials were published in an old client build —
 * 1) In CardCom portal create new ApiName/ApiPassword (and optionally new terminal).
 * 2) Save them in Admin → CardCom (or Edge secrets CARDCOM_API_NAME / CARDCOM_API_PASSWORD / CARDCOM_TERMINAL_NUMBER).
 * 3) Revoke/disable the old API user in CardCom.
 * 4) Ship app builds that do not include EXPO_PUBLIC_CARDCOM_*; remove those vars from EAS/Expo env.
 */

/** Checkout kill-switch only (not a CardCom secret). EXPO_PUBLIC_CARDCOM_CHECKOUT_ENABLED=false */
export const isSubscriptionCheckoutEnabled = () => {
  const flag = process.env.EXPO_PUBLIC_CARDCOM_CHECKOUT_ENABLED;
  if (flag === '0' || flag === 'false') return false;
  return true;
};

// Subscription Plans Configuration - מסלולים כמו בדף הנחיתה darkpool.site
export const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'חינמי',
    description: 'גישה חינמית לתכנים הציבוריים',
    price: 0,
    period: 'monthly',
    features: [
      'חדשות כלכליות',
      'לייב מסחר יומי ביוטיוב',
      'תמיכה בערוץ היוטיוב',
      'קבוצת השקעות בבורסה הישראלית 🇮🇱',
    ],
    excludedFeatures: [
      'מענה על שאלות',
      'יחס אישי וליווי קהילתי',
      'חדשות מתפרצות בזמן אמת',
      'רשימת מעקב למסחר יומי עם יעדים ברורים',
      'ניתוחים וסטאפים לסווינגים',
      'שיתוף תיק השקעות של הצוות',
      'הלווייתנים',
    ],
    role: 'free_user',
    popular: false,
    color: '#E2E8F0',
    badge: null as string | null,
  },

  monthly: {
    id: 'monthly',
    name: 'חודשי',
    description: 'ללא התחייבות',
    price: 1, // TEMP test price — restore production amount after CardCom E2E
    period: 'monthly',
    features: [
      'מענה על שאלות',
      'יחס אישי וליווי קהילתי',
      'חדשות מתפרצות בזמן אמת',
      'חדשות כלכליות',
      'לייב מסחר יומי ביוטיוב',
      'רשימת מעקב למסחר יומי עם יעדים ברורים',
      'ניתוחים וסטאפים לסווינגים',
      'שיתוף תיק השקעות של הצוות',
      'תמיכה בערוץ היוטיוב',
      'קבוצת השקעות בבורסה הישראלית 🇮🇱',
      'הלווייתנים',
    ],
    excludedFeatures: [],
    role: 'premium_user',
    popular: false,
    color: '#3B82F6',
    badge: null as string | null,
  },

  quarterly: {
    id: 'quarterly',
    name: 'רבעוני',
    description: 'חסוך 47% ברבעון',
    price: 399,
    period: 'quarterly',
    features: [
      'מענה על שאלות',
      'יחס אישי וליווי קהילתי',
      'חדשות מתפרצות בזמן אמת',
      'חדשות כלכליות',
      'לייב מסחר יומי ביוטיוב',
      'רשימת מעקב למסחר יומי עם יעדים ברורים',
      'ניתוחים וסטאפים לסווינגים',
      'שיתוף תיק השקעות של הצוות',
      'תמיכה בערוץ היוטיוב',
      'קבוצת השקעות בבורסה הישראלית 🇮🇱',
      'הלווייתנים',
    ],
    excludedFeatures: [],
    role: 'premium_user',
    popular: true,
    color: '#10B981',
    badge: 'מסלול חדש' as string | null,
  },

  yearly: {
    id: 'yearly',
    name: 'חודשי - שנתי',
    description: 'חסוך 53% בשנה',
    price: 1404,
    period: 'yearly',
    features: [
      'מענה על שאלות',
      'יחס אישי וליווי קהילתי',
      'חדשות מתפרצות בזמן אמת',
      'חדשות כלכליות',
      'לייב מסחר יומי ביוטיוב',
      'רשימת מעקב למסחר יומי עם יעדים ברורים',
      'ניתוחים וסטאפים לסווינגים',
      'שיתוף תיק השקעות של הצוות',
      'תמיכה בערוץ היוטיוב',
      'קבוצת השקעות בבורסה הישראלית 🇮🇱',
      'הלווייתנים',
    ],
    excludedFeatures: [],
    role: 'premium_user',
    popular: false,
    color: '#F59E0B',
    badge: 'המסלול החסכוני' as string | null,
  },

  live_addon: {
    id: 'live_addon',
    name: 'תוספת לייבים',
    description: '4 לייבים אקסקלוסיביים בחודש - לייב אחד כל שבוע בזום',
    price: 99,
    period: 'monthly',
    features: [
      '4 לייבים אקסקלוסיביים בחודש',
      'לייב אחד כל שבוע בזום',
    ],
    excludedFeatures: [],
    role: 'live_user',
    popular: false,
    color: '#10B981',
    badge: null as string | null,
    isAddon: true,
  },

  whales_course: {
    id: 'whales_course',
    name: 'הלווייתנים',
    description: 'הלווייתנים - תשלום חד פעמי',
    price: 531,
    period: 'one_time',
    features: ['קורס הלווייתנים המלא', 'גישה לכל החומרים', 'תמיכה צמודה'],
    excludedFeatures: [],
    role: 'whales_user',
    popular: false,
    color: '#F59E0B',
    badge: null as string | null,
    isOneTime: true,
  },
};

export interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
  userId: string | null;
  planId: string;
  userEmail: string;
  userName: string;
  /**
   * Recurring subscription → edge maps to CardCom Operation "2" (Charge+Token).
   * See supabase/functions/_shared/cardcom.ts for Operation decision.
   */
  isRecurring?: boolean;
  userPhone?: string;
  cardDetails?: {
    cardNumber: string;
    expiryDate: string;
    cvv: string;
    cardholderName: string;
    idNumber: string;
    phone: string;
  };
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string | null;
  cardcomTransactionId?: string;
  approvalNumber?: string;
  error?: string;
  /** Debug / ops only — never show CardCom Description to buyers */
  code?: string;
  adminCode?: number | null;
}

export type PaymentHistoryItem = {
  id: string;
  amount: number | null;
  currency: string | null;
  status: string | null;
  plan_id: string | null;
  created_at: string | null;
  document_type: string | null;
  document_number: number | null;
  document_url: string | null;
  cardcom_document_type?: string | null;
  cardcom_document_number?: number | null;
  cardcom_document_url?: string | null;
};

type PaymentInvoiceEdgeRow = {
  id: string;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  plan_id?: string | null;
  created_at?: string | null;
  document_type?: string | null;
  document_number?: number | null;
  document_url?: string | null;
};

function mapEdgeInvoiceToHistoryItem(row: PaymentInvoiceEdgeRow): PaymentHistoryItem {
  return {
    id: String(row.id),
    amount: row.amount ?? null,
    currency: row.currency ?? 'ILS',
    status: row.status ?? null,
    plan_id: row.plan_id ?? null,
    created_at: row.created_at ?? null,
    document_type: row.document_type ?? null,
    document_number: row.document_number ?? null,
    document_url: row.document_url ?? null,
    cardcom_document_type: row.document_type ?? null,
    cardcom_document_number: row.document_number ?? null,
    cardcom_document_url: row.document_url ?? null,
  };
}

/** הודעת שגיאה כללית לקונה — אל תציג Description של CardCom */
export const BUYER_PAYMENT_ERROR_HE =
  'מצטערים, אירעה שגיאת שרת. אנא המתינו מעט ונסו שוב. אם השגיאה נמשכת — פנו אלינו לתמיכה.';

/** מסוף CardCom חסום / לא פעיל — הודעה ברורה לקונה בלי חשיפת פרטי ספק */
export const BUYER_PAYMENT_TERMINAL_BLOCKED_HE =
  'שירות התשלומים אינו זמין כרגע. נסו שוב מאוחר יותר או פנו אלינו לתמיכה.';

type CreatePaymentEdgeBody = {
  success?: boolean;
  paymentUrl?: string;
  transactionId?: string;
  error?: string;
  code?: string;
  adminCode?: number | null;
};

/**
 * supabase-js v2: על non-2xx, `data` לרוב null והגוף נמצא ב-`error.context` (Response).
 */
async function parseCreatePaymentEdgeBody(
  error: (Error & { context?: unknown }) | null,
  data: unknown,
): Promise<CreatePaymentEdgeBody> {
  if (data && typeof data === 'object') {
    return data as CreatePaymentEdgeBody;
  }

  const ctx = error?.context as
    | {
        status?: number;
        text?: () => Promise<string>;
        json?: () => Promise<unknown>;
        clone?: () => { text: () => Promise<string> };
      }
    | undefined;

  if (!ctx || typeof ctx.text !== 'function') {
    return {};
  }

  try {
    // clone() כדי לא לצרוך את גוף ה-Response המקורי; אם אין clone נופלים ל-ctx עצמו
    const readable: { text?: () => Promise<string> } =
      typeof ctx.clone === 'function' ? ctx.clone() : ctx;
    const rawText = typeof readable.text === 'function' ? await readable.text() : '';
    if (!rawText?.trim()) return {};
    try {
      return JSON.parse(rawText) as CreatePaymentEdgeBody;
    } catch {
      return { error: rawText.trim().slice(0, 300) };
    }
  } catch {
    return {};
  }
}

function buyerErrorForCode(code?: string, adminCode?: number | null): string {
  if (code === 'CARDCOM_TERMINAL_BLOCKED' || adminCode === 613) {
    return BUYER_PAYMENT_TERMINAL_BLOCKED_HE;
  }
  return BUYER_PAYMENT_ERROR_HE;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface PaymentCallback {
  transactionId: string;
  status: 'success' | 'failed' | 'pending';
  amount: number;
  planId: string;
  userId: string;
  cardcomTransactionId?: string;
}

class PaymentService {
  /**
   * יוצר בקשת תשלום דרך Edge Function (LowProfile/Create בשרת בלבד).
   */
  async createPaymentRequest(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      if (!isSubscriptionCheckoutEnabled()) {
        return { success: false, error: BUYER_PAYMENT_ERROR_HE };
      }

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          planId: request.planId,
          amount: request.amount,
          description: request.description,
          userId: request.userId,
          userEmail: request.userEmail,
          userName: request.userName,
          userPhone: request.userPhone,
          isRecurring: request.isRecurring ?? true,
        },
      });

      const body = await parseCreatePaymentEdgeBody(
        error as (Error & { context?: unknown }) | null,
        data,
      );

      if (body.success && body.paymentUrl) {
        return {
          success: true,
          transactionId: body.transactionId,
          paymentUrl: body.paymentUrl,
        };
      }

      const status =
        typeof (error as { context?: { status?: number } } | null)?.context?.status === 'number'
          ? (error as { context: { status: number } }).context.status
          : undefined;

      console.error('[PaymentService] create-payment failed:', {
        invokeMessage: error?.message,
        httpStatus: status,
        code: body.code,
        adminCode: body.adminCode ?? null,
        bodyError: body.error,
        transactionId: body.transactionId,
      });

      return {
        success: false,
        error: buyerErrorForCode(body.code, body.adminCode),
        code: body.code,
        adminCode: body.adminCode ?? null,
        transactionId: body.transactionId,
      };
    } catch (error) {
      console.error('[PaymentService] createPaymentRequest error:', error);
      return {
        success: false,
        error: BUYER_PAYMENT_ERROR_HE,
      };
    }
  }

  async getPaymentTransactionStatus(
    transactionId: string,
  ): Promise<'success' | 'failed' | 'pending' | 'pending_charge' | null> {
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('status')
        .eq('id', transactionId)
        .maybeSingle();
      if (error || !data?.status) return null;
      if (
        data.status === 'success' ||
        data.status === 'failed' ||
        data.status === 'pending' ||
        data.status === 'pending_charge'
      ) {
        return data.status;
      }
      return null;
    } catch {
      return null;
    }
  }

  async waitForPaymentConfirmation(
    transactionId: string,
    opts?: { maxAttempts?: number; intervalMs?: number },
  ): Promise<'success' | 'failed' | 'pending' | 'pending_charge' | null> {
    const maxAttempts = opts?.maxAttempts ?? 8;
    const intervalMs = opts?.intervalMs ?? 1000;
    let last: 'success' | 'failed' | 'pending' | 'pending_charge' | null = null;
    for (let i = 0; i < maxAttempts; i++) {
      last = await this.getPaymentTransactionStatus(transactionId);
      if (last === 'success' || last === 'failed' || last === 'pending_charge') return last;
      await sleep(intervalMs);
    }
    return last;
  }

  async processPaymentCallback(callback: PaymentCallback): Promise<boolean> {
    try {
      if (callback.cardcomTransactionId) {
        const { data: existing } = await supabase
          .from('payment_transactions')
          .select('id, status')
          .eq('cardcom_transaction_id', callback.cardcomTransactionId)
          .maybeSingle();

        if (existing && existing.status === 'success') {
          return true;
        }
      }

      const { error: updateError } = await supabase
        .from('payment_transactions')
        .update({
          status: callback.status,
          cardcom_transaction_id: callback.cardcomTransactionId ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', callback.transactionId);

      if (updateError) {
        return false;
      }

      // המנוי עצמו לא מוענק כאן: `rapid-responder` מאמת את התשלום מול Cardcom
      // ומעניק אותו על service role. הקליינט רק מסמן את סטטוס העסקה.
      return true;
    } catch {
      return false;
    }
  }

  /**
   * הפעלת מנוי היא פעולה של השרת בלבד.
   *
   * המימוש הקודם עדכן מהקליינט את `users.subscription_plan/role/expires_at/
   * account_type` ואת `user_subscriptions` — כלומר כל מי שמחזיק את ה-anon key
   * יכול היה להעניק לעצמו פרימיום בלי לשלם, בלי לעבור דרך Cardcom בכלל.
   * המקור היחיד לאמת הוא ה-webhook: `rapid-responder` מאמת את התשלום מול
   * Cardcom וקורא ל-`activateSubscriptionFromPayment` (service role).
   */
  async activateSubscription(_userId: string, _planId: string, _sourceTransactionId?: string) {
    console.error('[PaymentService] activateSubscription disabled on client — granted by the Cardcom webhook');
  }

  /**
   * Active subscription for billing UI.
   * Does not return the raw CardCom token — only a `has_payment_token` flag.
   */
  async getCurrentSubscription(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(
          `
          id,
          user_id,
          plan_id,
          status,
          starts_at,
          expires_at,
          auto_renew,
          card_last4_digits,
          card_brand,
          cardcom_token,
          source_transaction_id,
          created_at,
          updated_at,
          subscription_plans (
            id,
            name,
            price,
            period,
            features,
            role
          )
        `,
        )
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      if (!data) return null;

      const { cardcom_token: token, ...rest } = data as typeof data & {
        cardcom_token?: string | null;
      };
      return {
        ...rest,
        has_payment_token: Boolean(token),
      };
    } catch {
      return null;
    }
  }

  /**
   * היסטוריית תשלומים + שדות מסמך CardCom למשתמש המחובר.
   * כולל success / refunded / pending_charge גם בלי מספר מסמך (לא מסנן לפי document).
   * קודם דרך edge (JWT + service filter על auth.uid); נפילה ל-RLS ישיר אם ה-edge לא זמין.
   */
  async getPaymentHistory(userId: string): Promise<PaymentHistoryItem[]> {
    try {
      const { data, error } = await supabase.functions.invoke('payment-invoices', {
        body: { action: 'list' },
      });
      if (!error && data?.success && Array.isArray(data.invoices)) {
        return (data.invoices as PaymentInvoiceEdgeRow[]).map(mapEdgeInvoiceToHistoryItem);
      }
    } catch {
      // fall through to direct select
    }

    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select(
          'id, amount, currency, status, plan_id, created_at, cardcom_document_type, cardcom_document_number, cardcom_document_url',
        )
        .eq('user_id', userId)
        .in('status', ['success', 'refunded', 'pending_charge'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      return (data || []).map((row) => ({
        id: String(row.id),
        amount: row.amount,
        currency: row.currency ?? 'ILS',
        status: row.status,
        plan_id: row.plan_id,
        created_at: row.created_at,
        document_type: row.cardcom_document_type ?? null,
        document_number: row.cardcom_document_number ?? null,
        document_url: row.cardcom_document_url ?? null,
        // aliases for older UI / admin-shaped reads
        cardcom_document_type: row.cardcom_document_type ?? null,
        cardcom_document_number: row.cardcom_document_number ?? null,
        cardcom_document_url: row.cardcom_document_url ?? null,
      }));
    } catch {
      return [];
    }
  }

  /** Resolve / refresh CardCom document URL for a payment owned by the signed-in user. */
  async resolveInvoiceDocumentUrl(
    transactionId: string,
  ): Promise<{ url: string | null; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('payment-invoices', {
        body: { action: 'resolve_url', transactionId },
      });
      if (error) {
        return { url: null, error: 'לא ניתן לפתוח את החשבונית כרגע' };
      }
      if (data?.success && typeof data.document_url === 'string') {
        return { url: data.document_url };
      }
      return {
        url: null,
        error: 'קישור למסמך לא זמין — שמרו את מספר המסמך לפנייה לתמיכה',
      };
    } catch {
      return { url: null, error: 'לא ניתן לפתוח את החשבונית כרגע' };
    }
  }

  /**
   * ביטול מנוי — הורדת דרגה בלבד, ולכן מותר לבעל החשבון, אבל חייב לרוץ בצד
   * שרת: עמודות המנוי על `users` ורשומות `user_subscriptions` אינן ניתנות
   * לכתיבה מהקליינט. ה-RPC נעול על auth.uid() ולא נוגע בשורה של אדמין.
   */
  async cancelSubscription(_userId?: string) {
    const { error } = await supabase.rpc('cancel_my_subscription');
    return !error;
  }

  /**
   * Recurring charge — must run server-side (no client CardCom secrets).
   * TODO(sprint2+): edge function Transactions/Transaction with config from cardcom_config.
   */
  async createRecurringPayment(_userId: string, _planId: string): Promise<PaymentResponse> {
    console.error('[PaymentService] createRecurringPayment disabled on client — move to edge');
    return {
      success: false,
      error: BUYER_PAYMENT_ERROR_HE,
    };
  }
}

export const paymentService = new PaymentService();
