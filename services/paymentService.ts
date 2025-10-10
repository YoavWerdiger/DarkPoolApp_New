import { supabase } from '../lib/supabase';

// CardCom API Configuration - פרטי החברה האמיתיים (API v11)
export const CARDCOM_CONFIG = {
  terminalNumber: 147763, // מסוף 147763 - סניף מרכזי
  apiName: 'kiCl9NU22wGlzSNGPtg7', // שם משתמש ממשקים חדש
  apiPassword: 'fHgXjiB9BgyC1kTJeLek', // סיסמת משתמש ממשקים חדשה
  baseUrl: 'https://secure.cardcom.solutions/api/v11',
  successUrl: 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/smart-action',
  errorUrl: 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/smart-action',
  callbackUrl: 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/rapid-responder'
};

// בדיקת תקינות המפתח
export const validateCardcomConfig = () => {
  console.log('🔍 CardCom Config Validation:');
  console.log('  Terminal Number:', CARDCOM_CONFIG.terminalNumber);
  console.log('  API Name:', CARDCOM_CONFIG.apiName);
  console.log('  API Password:', CARDCOM_CONFIG.apiPassword ? '***' + CARDCOM_CONFIG.apiPassword.slice(-4) : 'MISSING');
  console.log('  Base URL:', CARDCOM_CONFIG.baseUrl);
  console.log('  Full Endpoint:', `${CARDCOM_CONFIG.baseUrl}/LowProfile/Create`);
};

// Subscription Plans Configuration - מסלולים חיים
export const SUBSCRIPTION_PLANS = {
  monthly: {
    id: 'monthly',
    name: 'מסלול חודשי',
    price: 99,
    period: 'monthly',
    features: [
      'גישה מלאה לכל התכונות',
      'אותות מסחר חיים',
      'ניתוחים מקצועיים',
      'תמיכה 24/7',
      'גישה לקהילה הפרימיום',
      'אותות בלעדיים',
      'עדכונים בזמן אמת'
    ],
    role: 'premium_user',
    popular: true
  },
  quarterly: {
    id: 'quarterly',
    name: 'מסלול רבעוני',
    price: 250,
    period: 'quarterly',
    features: [
      'כל התכונות של המסלול החודשי',
      'הנחה של 16%',
      'גישה מוקדמת לתכונות חדשות',
      'ייעוץ אישי חודשי',
      'אותות בלעדיים',
      'ניתוחים מותאמים אישית'
    ],
    role: 'premium_user',
    popular: false
  },
  yearly: {
    id: 'yearly',
    name: 'מסלול שנתי',
    price: 999,
    period: 'yearly',
    features: [
      'כל התכונות של המסלול הרבעוני',
      'הנחה של 16%',
      'גישה מוקדמת לתכונות חדשות',
      'ייעוץ אישי שבועי',
      'אותות בלעדיים',
      'ניתוחים מותאמים אישית',
      'גישה לחדר VIP',
      'מפגשים אישיים'
    ],
    role: 'premium_user',
    popular: false
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
      
      console.log('🔄 PaymentService: Creating payment request with LowProfile API:', request);

      // יצירת מזהה עסקה ייחודי
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // הכנת נתוני התשלום ל-CardCom LowProfile API
      const paymentData = {
        TerminalNumber: CARDCOM_CONFIG.terminalNumber,
        ApiName: CARDCOM_CONFIG.apiName,
        Operation: "ChargeOnly",
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

      console.log('🔄 PaymentService: Sending request to CardCom LowProfile API');
      console.log('🔄 PaymentService: API Name:', CARDCOM_CONFIG.apiName);
      console.log('🔄 PaymentService: Terminal:', CARDCOM_CONFIG.terminalNumber);
      console.log('🔄 PaymentService: Full URL:', `${CARDCOM_CONFIG.baseUrl}/LowProfile/Create`);
      console.log('🔄 PaymentService: Request Data:', JSON.stringify(paymentData, null, 2));

      // שליחת בקשת תשלום ל-CardCom LowProfile API
      const response = await fetch(`${CARDCOM_CONFIG.baseUrl}/LowProfile/Create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      console.log('🔄 PaymentService: Response status:', response.status);
      console.log('🔄 PaymentService: Response headers:', Object.fromEntries(response.headers.entries()));

      const result = await response.json();

      console.log('🔄 PaymentService: CardCom LowProfile API response:', result);

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

        console.log('✅ PaymentService: Payment request created successfully');

        return {
          success: true,
          transactionId: transactionId,
          paymentUrl: result.Url
        };
      } else {
        console.error('❌ PaymentService: CardCom LowProfile API error:', result);
        return {
          success: false,
          error: result.Description || 'שגיאה ביצירת בקשת התשלום'
        };
      }
    } catch (error) {
      console.error('❌ PaymentService: Error creating payment request:', error);
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
      console.log('🔄 PaymentService: Processing payment callback:', callback);

      // עדכון סטטוס העסקה
      const { error: updateError } = await supabase
        .from('payment_transactions')
        .update({
          status: callback.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', callback.transactionId);

      if (updateError) {
        console.error('❌ PaymentService: Error updating transaction:', updateError);
        return false;
      }

      // אם התשלום הצליח, עדכון המנוי של המשתמש
      if (callback.status === 'success') {
        await this.updateUserSubscription(callback.userId, callback.planId);
      }

      console.log('✅ PaymentService: Payment callback processed successfully');
      return true;
    } catch (error) {
      console.error('❌ PaymentService: Error processing payment callback:', error);
      return false;
    }
  }

  /**
   * שומר פרטי עסקה במסד הנתונים
   */
  private async saveTransaction(transaction: {
    id: string;
    userId: string | null;
    planId: string;
    amount: number;
    status: string;
    cardcomLowProfileId?: string;
    cardcomTransactionId?: string;
    paymentUrl: string;
  }) {
    try {
      const { error } = await supabase
        .from('payment_transactions')
        .insert({
          id: transaction.id,
          user_id: transaction.userId,
          plan_id: transaction.planId,
          amount: transaction.amount,
          status: transaction.status,
          cardcom_low_profile_id: transaction.cardcomLowProfileId,
          cardcom_transaction_id: transaction.cardcomTransactionId,
          payment_url: transaction.paymentUrl,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ PaymentService: Error saving transaction:', error);
        throw error;
      }

      console.log('✅ PaymentService: Transaction saved successfully');
    } catch (error) {
      console.error('❌ PaymentService: Error saving transaction:', error);
      throw error;
    }
  }

  /**
   * מעדכן את המנוי של המשתמש
   */
  private async updateUserSubscription(userId: string, planId: string) {
    try {
      console.log('🔄 PaymentService: Updating user subscription:', { userId, planId });

      const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
      if (!plan) {
        throw new Error('Plan not found');
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
        expiresAt.setMonth(expiresAt.getMonth() + 1); // ברירת מחדל
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

      if (userError) {
        console.error('❌ PaymentService: Error updating user:', userError);
        throw userError;
      }

      // יצירת רשומת מנוי
      const { error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          status: 'active',
          starts_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        });

      if (subscriptionError) {
        console.error('❌ PaymentService: Error creating subscription:', subscriptionError);
        throw subscriptionError;
      }

      console.log('✅ PaymentService: User subscription updated successfully');
    } catch (error) {
      console.error('❌ PaymentService: Error updating user subscription:', error);
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
        console.error('❌ PaymentService: Error getting subscription:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ PaymentService: Error getting current subscription:', error);
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
        console.error('❌ PaymentService: Error getting payment history:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ PaymentService: Error getting payment history:', error);
      return [];
    }
  }

  /**
   * מבטל מנוי
   */
  async cancelSubscription(userId: string) {
    try {
      console.log('🔄 PaymentService: Cancelling subscription for user:', userId);

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
        console.error('❌ PaymentService: Error cancelling subscription:', error);
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
        console.error('❌ PaymentService: Error updating user after cancellation:', userError);
        throw userError;
      }

      console.log('✅ PaymentService: Subscription cancelled successfully');
      return true;
    } catch (error) {
      console.error('❌ PaymentService: Error cancelling subscription:', error);
      return false;
    }
  }
}

export const paymentService = new PaymentService();
