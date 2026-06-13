import { supabase } from '../lib/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export const CARDCOM_CONFIG = {
  terminalNumber: Number(process.env.EXPO_PUBLIC_CARDCOM_TERMINAL) || 0,
  apiName: process.env.EXPO_PUBLIC_CARDCOM_API_NAME ?? '',
  apiPassword: process.env.EXPO_PUBLIC_CARDCOM_API_PASSWORD ?? '',
  baseUrl: 'https://secure.cardcom.solutions/api/v11',
  successUrl: `${supabaseUrl}/functions/v1/smart-action`,
  errorUrl: `${supabaseUrl}/functions/v1/smart-action`,
  callbackUrl: `${supabaseUrl}/functions/v1/rapid-responder`,
};

export const validateCardcomConfig = () => {
  if (!CARDCOM_CONFIG.terminalNumber || !CARDCOM_CONFIG.apiName || !CARDCOM_CONFIG.apiPassword) {
    return false;
  }
  return true;
};

/** תשלום מנוי — פעיל רק כש-Cardcom מוגדר (סולק) */
export const isSubscriptionCheckoutEnabled = () => validateCardcomConfig();

// Subscription Plans Configuration - מסלולים כמו בדף הנחיתה darkpool.site
export const SUBSCRIPTION_PLANS = {
  // מסלול חינמי
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
      'קורס הלוויתנים',
    ],
    role: 'free_user',
    popular: false,
    color: '#E2E8F0',
    badge: null as string | null,
  },

  // מסלול חודשי - ₪249 ללא התחייבות
  monthly: {
    id: 'monthly',
    name: 'חודשי',
    description: 'ללא התחייבות',
    price: 249,
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
      'קורס הלוויתנים',
    ],
    excludedFeatures: [],
    role: 'premium_user',
    popular: false,
    color: '#3B82F6',
    badge: null as string | null,
  },

  // מסלול רבעוני - ₪399 ל-3 חודשים (חסוך 47%)
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
      'קורס הלוויתנים',
    ],
    excludedFeatures: [],
    role: 'premium_user',
    popular: true,
    color: '#10B981',
    badge: 'מסלול חדש' as string | null,
  },

  // מסלול שנתי - ₪117/חודש (₪1,404/שנה) חסוך 53%
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
      'קורס הלוויתנים',
    ],
    excludedFeatures: [],
    role: 'premium_user',
    popular: false,
    color: '#F59E0B',
    badge: 'המסלול החסכוני' as string | null,
  },

  // תוספת לייבים (אד-און)
  live_addon: {
    id: 'live_addon',
    name: 'תוספת לייבים',
    description: '4 לייבים אקסקלוסיביים בחודש - לייב אחד כל שבוע בזום',
    price: 99,
    period: 'monthly',
    features: [
      '4 לייבים אקסקלוסיביים בחודש',
      'לייב אחד כל שבוע בזום'
    ],
    excludedFeatures: [],
    role: 'live_user',
    popular: false,
    color: '#10B981',
    badge: null as string | null,
    isAddon: true
  },

  // קורס הלוויתנים (תשלום חד פעמי)
  whales_course: {
    id: 'whales_course',
    name: 'קורס הלוויתנים',
    description: 'קורס הלוויתנים - תשלום חד פעמי',
    price: 531,
    period: 'one_time',
    features: [
      'קורס הלוויתנים המלא',
      'גישה לכל החומרים',
      'תמיכה צמודה'
    ],
    excludedFeatures: [],
    role: 'whales_user',
    popular: false,
    color: '#F59E0B',
    badge: null as string | null,
    isOneTime: true
  }
};

export interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
  userId: string | null;
  planId: string;
  userEmail: string;
  userName: string;
  /** מנוי חוזר (CardCom operation 2) */
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
}

export interface PaymentCallback {
  transactionId: string;
  status: 'success' | 'failed' | 'pending';
  amount: number;
  planId: string;
  userId: string;
}

class PaymentService {
  /**
   * יוצר בקשת תשלום חדשה עם CardCom LowProfile API (הפתרון הסופי)
   */
  async createPaymentRequest(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // בדיקת תקינות הקונפיגורציה
      validateCardcomConfig();

      // יצירת מזהה עסקה ייחודי
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // הכנת נתוני התשלום ל-CardCom LowProfile API
      // Operation: 2 = Charge + Create Token (למנויים חוזרים)
      // Operation: 1 = ChargeOnly (תשלום חד פעמי בלבד)
      const operation = request.isRecurring ? "2" : "ChargeOnly";
      
      const paymentData: any = {
        TerminalNumber: CARDCOM_CONFIG.terminalNumber,
        ApiName: CARDCOM_CONFIG.apiName,
        Operation: operation,
        ReturnValue: transactionId,
        Amount: request.amount,
        SuccessRedirectUrl: CARDCOM_CONFIG.successUrl,
        FailedRedirectUrl: CARDCOM_CONFIG.errorUrl,
        WebHookUrl: CARDCOM_CONFIG.callbackUrl,
        ProductName: request.description,
        Language: "he",
        ISOCoinId: 1, // שקל ישראלי
        CustomFields: [
          {
            Name: "userId",
            Value: request.userId || "pending"
          },
          {
            Name: "planId", 
            Value: request.planId
          },
          {
            Name: "transactionId",
            Value: transactionId
          },
          {
            Name: "userEmail",
            Value: request.userEmail || ""
          },
          {
            Name: "userName",
            Value: request.userName || ""
          }
        ]
      };

      // אם זה recurring payment - מוסיפים פרמטרים ל-BillGold
      if (request.isRecurring) {
        // אפשר להוסיף פרמטרים נוספים ל-RecurringPayments אם נדרש
        // (צריך לבדוק עם Cardcom מה הפרמטרים המדויקים)
      }

      // שליחת בקשת תשלום ל-CardCom LowProfile API
      const response = await fetch(`${CARDCOM_CONFIG.baseUrl}/LowProfile/Create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      if (result.ResponseCode === 0) {
        // שמירת פרטי העסקה במסד הנתונים
        await this.saveTransaction({
          id: transactionId,
          userId: request.userId,
          planId: request.planId,
          amount: request.amount,
          status: 'pending',
          cardcomLowProfileId: result.LowProfileId,
          paymentUrl: result.Url
        });

        return {
          success: true,
          transactionId: transactionId,
          paymentUrl: result.Url
        };
      } else {
        return {
          success: false,
          error: result.Description || 'שגיאה ביצירת בקשת התשלום'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'שגיאה ביצירת בקשת התשלום'
      };
    }
  }

  /**
   * מעבד callback מ-CardCom
   */
  async processPaymentCallback(callback: PaymentCallback): Promise<boolean> {
    try {
      // Idempotency: check if this Cardcom transaction was already processed
      if (callback.cardcomTransactionId) {
        const { data: existing } = await supabase
          .from('payment_transactions')
          .select('id, status')
          .eq('cardcom_transaction_id', callback.cardcomTransactionId)
          .maybeSingle();

        if (existing && existing.status === 'success') {
          // Already processed — return true without re-extending subscription
          return true;
        }
      }

      // עדכון סטטוס העסקה
      const { error: updateError } = await supabase
        .from('payment_transactions')
        .update({
          status: callback.status,
          cardcom_transaction_id: callback.cardcomTransactionId ?? null,
          updated_at: new Date().toISOString()
        })
        .eq('id', callback.transactionId);

      if (updateError) {
        return false;
      }

      // אם התשלום הצליח, עדכון המנוי של המשתמש
      if (callback.status === 'success') {
        await this.updateUserSubscription(callback.userId, callback.planId, callback.transactionId);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * שומר פרטי עסקה במסד הנתונים באמצעות Edge Function
   */
  private async saveTransaction(transaction: {
    id: string;
    userId: string | null;
    planId: string;
    amount: number;
    status: string;
    cardcomLowProfileId?: string;
    cardcomTransactionId?: string;
    paymentUrl?: string;
  }) {
    try {
      // ניסיון 1: Edge Function (מומלץ)
      try {
        const { data, error } = await supabase.functions.invoke('create-payment', {
          body: {
            transaction: {
              id: transaction.id,
              userId: transaction.userId,
              planId: transaction.planId,
              amount: transaction.amount,
              currency: 'ILS',
              status: transaction.status,
              cardcomLowProfileId: transaction.cardcomLowProfileId,
              cardcomTransactionId: transaction.cardcomTransactionId,
              paymentUrl: transaction.paymentUrl,
            }
          }
        });

        if (error) {
          throw error;
        }

        if (data && !data.success) {
          throw new Error(JSON.stringify(data));
        }

        return;
      } catch (edgeFunctionError) {
        console.warn('[PaymentService] Edge function failed, falling back to direct insert:', edgeFunctionError);
        // ניסיון 2: הכנסה ישירה (fallback)
        const { error: directError } = await supabase
          .from('payment_transactions')
          .insert({
            id: transaction.id,
            user_id: transaction.userId,
            plan_id: transaction.planId,
            amount: transaction.amount,
            currency: 'ILS',
            status: transaction.status,
            cardcom_low_profile_id: transaction.cardcomLowProfileId,
            cardcom_transaction_id: transaction.cardcomTransactionId,
            payment_url: transaction.paymentUrl,
            created_at: new Date().toISOString()
          });

        if (directError) {
          console.error('[PaymentService] Direct insert also failed:', directError);
          throw directError;
        }
        console.warn('[PaymentService] Transaction saved via direct insert fallback. id=', transaction.id);
      }
    } catch (error) {
      console.error('[PaymentService] saveTransaction failed completely:', error);
      throw error;
    }
  }

  /**
   * מעדכן את המנוי של המשתמש
   */
  private async updateUserSubscription(userId: string, planId: string, sourceTransactionId?: string) {
    try {
      const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
      if (!plan) {
        throw new Error('Plan not found');
      }

      // Idempotency: skip if this transaction already granted a subscription
      if (sourceTransactionId) {
        const { data: existing } = await supabase
          .from('user_subscriptions')
          .select('id')
          .eq('source_transaction_id', sourceTransactionId)
          .maybeSingle();
        if (existing) return; // already processed
      }

      // חישוב תאריך התפוגה לפי התקופה
      const expiresAt = new Date();
      if (plan.period === 'monthly') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else if (plan.period === 'quarterly') {
        expiresAt.setMonth(expiresAt.getMonth() + 3);
      } else if (plan.period === 'yearly') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      // עדכון פרטי המשתמש
      const { error: userError } = await supabase
        .from('users')
        .update({
          subscription_plan: planId,
          subscription_role: plan.role,
          subscription_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (userError) throw userError;

      // יצירת רשומת מנוי (עם source_transaction_id למניעת כפילויות)
      const { error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          status: 'active',
          starts_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          source_transaction_id: sourceTransactionId ?? null,
          created_at: new Date().toISOString()
        });

      if (subscriptionError) throw subscriptionError;
    } catch (error) {
      throw error;
    }
  }

  /**
   * מקבל את המנוי הנוכחי של המשתמש
   */
  async getCurrentSubscription(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (
            id,
            name,
            price,
            period,
            features,
            role
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * מקבל את היסטוריית התשלומים של המשתמש
   */
  async getPaymentHistory(userId: string) {
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * מבטל מנוי
   */
  async cancelSubscription(userId: string) {
    try {
      // עדכון סטטוס המנוי
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) {
        throw error;
      }

      // עדכון פרטי המשתמש
      const { error: userError } = await supabase
        .from('users')
        .update({
          subscription_plan: 'free',
          subscription_role: 'free_user',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (userError) {
        throw userError;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * יוצר recurring payment באמצעות Token שנשמר
   * זה נקרא אוטומטית כשה-auto_renew = true והמנוי פג
   */
  async createRecurringPayment(userId: string, planId: string): Promise<PaymentResponse> {
    try {
      // קבלת פרטי המנוי עם Token
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*, subscription_plans(*)')
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('auto_renew', true)
        .single();

      if (subError || !subscription) {
        throw new Error('Subscription not found or auto-renew disabled');
      }

      if (!subscription.cardcom_token) {
        throw new Error('No payment token found for recurring payment');
      }

      const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
      if (!plan) {
        throw new Error('Plan not found');
      }

      // יצירת transaction ID חדש
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // יצירת recurring payment באמצעות Transaction API עם Token
      const transactionData = {
        TerminalNumber: CARDCOM_CONFIG.terminalNumber,
        ApiName: CARDCOM_CONFIG.apiName,
        Amount: plan.price,
        Token: subscription.cardcom_token,
        ISOCoinId: 1,
        ExternalUniqTranId: transactionId,
        CustomFields: [
          {
            Name: "userId",
            Value: userId
          },
          {
            Name: "planId",
            Value: planId
          },
          {
            Name: "transactionId",
            Value: transactionId
          },
          {
            Name: "isRecurring",
            Value: "true"
          }
        ]
      };

      const response = await fetch(`${CARDCOM_CONFIG.baseUrl}/Transactions/Transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(transactionData)
      });

      const result = await response.json();

      if (result.ResponseCode === 0) {
        // שמירת העסקה
        await this.saveTransaction({
          id: transactionId,
          userId: userId,
          planId: planId,
          amount: plan.price,
          status: 'success',
          cardcomLowProfileId: undefined,
          paymentUrl: undefined,
          cardcomTransactionId: result.TranzactionId?.toString()
        });

        // עדכון תאריך תפוגה
        const expiresAt = new Date();
        if (plan.period === 'monthly') {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        } else if (plan.period === 'quarterly') {
          expiresAt.setMonth(expiresAt.getMonth() + 3);
        } else if (plan.period === 'yearly') {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        }

        await supabase
          .from('user_subscriptions')
          .update({
            expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('plan_id', planId);

        return {
          success: true,
          transactionId: transactionId
        };
      } else {
        throw new Error(result.Description || 'שגיאה ביצירת תשלום חוזר');
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'שגיאה ביצירת תשלום חוזר'
      };
    }
  }
}

export const paymentService = new PaymentService();
