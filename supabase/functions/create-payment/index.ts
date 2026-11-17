/**
 * create-payment — JWT user → pending tx → CardCom LowProfile/Create → return Url
 * Secrets stay server-side (cardcom_config or Edge secrets fallback).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';
import {
  BUYER_PAYMENT_ERROR_HE,
  CARDCOM_API_BASE,
  loadCardComConfig,
  resolveCreateOperation,
  type CardComAdminOperation,
} from '../_shared/cardcom.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * חיוב בדיקה (₪) — כבוי כברירת מחדל. מופעל רק כשהסוד מוגדר במפורש למספר חיובי:
 *   supabase secrets set CARDCOM_TEST_AMOUNT_ILS=1     # חיוב בדיקה
 *   supabase secrets unset CARDCOM_TEST_AMOUNT_ILS     # מחירי התוכניות האמיתיים
 * בלי סוד → המחיר האמיתי של התוכנית (אין fallback בקוד).
 */
const TEMP_TEST_CHARGE_AMOUNT_ILS: number | null = null;

function resolveCardComChargeAmountIls(planAmountIls: number): {
  chargeAmount: number;
  planAmount: number;
  testMode: boolean;
} {
  const raw = Deno.env.get('CARDCOM_TEST_AMOUNT_ILS');
  let testAmount: number | null = null;
  if (raw != null && String(raw).trim() !== '') {
    const n = Number(raw);
    testAmount = Number.isFinite(n) && n > 0 ? n : null;
  } else {
    testAmount = TEMP_TEST_CHARGE_AMOUNT_ILS;
  }
  if (testAmount == null) {
    return { chargeAmount: planAmountIls, planAmount: planAmountIls, testMode: false };
  }
  return { chargeAmount: testAmount, planAmount: planAmountIls, testMode: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData.user) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }
    const authUserId = authData.user.id;

    const body = await req.json().catch(() => ({}));
    // New shape: { planId, amount, description, userEmail, userName, userPhone?, isRecurring? }
    // Legacy shape: { transaction: { ... } } — accept briefly for smooth cutover
    const legacy = body?.transaction && typeof body.transaction === 'object' ? body.transaction : null;

    const planId = String(body.planId || legacy?.planId || '');
    // הסכום מהלקוח לא קובע — המחיר נלקח מ-subscription_plans בשרת (אחרת אפשר לשלם ₪1 על כל מסלול)
    const clientAmount = Number(body.amount ?? legacy?.amount);
    let description = String(body.description || legacy?.description || `מנוי ${planId}`);
    const userEmail = String(body.userEmail || legacy?.userEmail || authData.user.email || '').trim();
    const userName = String(body.userName || legacy?.userName || '').trim() || 'Customer';
    const userPhone = String(body.userPhone || legacy?.userPhone || '').trim();
    let isRecurring = Boolean(body.isRecurring ?? legacy?.isRecurring ?? true);
    // Prefer JWT subject; allow explicit userId only if it matches JWT (registration pending user)
    const requestedUserId = String(body.userId || legacy?.userId || authUserId);
    const userId = requestedUserId === authUserId ? authUserId : authUserId;

    if (!planId) {
      return json({ success: false, error: 'Invalid planId' }, 400);
    }

    const svc = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // רכישת קורס בודד: planId = "course:<courseId>" — המחיר מ-courses (access='purchase'), תשלום חד-פעמי
    const coursePurchaseId = planId.startsWith('course:') ? planId.slice('course:'.length) : null;
    let amount: number;
    let numOfPayments = 1;
    if (coursePurchaseId) {
      const { data: courseRow, error: courseErr } = await svc
        .from('courses')
        .select('id, title, price, access, is_active')
        .eq('id', coursePurchaseId)
        .maybeSingle();
      if (courseErr || !courseRow || courseRow.access !== 'purchase' || courseRow.is_active === false || !(Number(courseRow.price) > 0)) {
        console.warn('[create-payment] unknown/unpurchasable course', { coursePurchaseId, courseErr: courseErr?.message });
        return json({ success: false, error: 'Invalid planId' }, 400);
      }
      const { data: owned } = await svc
        .from('course_purchases')
        .select('course_id')
        .eq('user_id', authUserId)
        .eq('course_id', coursePurchaseId)
        .maybeSingle();
      if (owned) {
        return json({ success: false, error: 'הקורס כבר נרכש', code: 'ALREADY_PURCHASED' }, 409);
      }
      amount = Number(courseRow.price);
      isRecurring = false;
      description = `קורס ${courseRow.title}`;
    } else {
      const { data: planRow, error: planErr } = await svc
        .from('subscription_plans')
        .select('id, price, period, active')
        .eq('id', planId)
        .maybeSingle();
      if (planErr || !planRow || planRow.active === false || !(Number(planRow.price) > 0)) {
        console.warn('[create-payment] unknown/inactive/free plan', { planId, planErr: planErr?.message });
        return json({ success: false, error: 'Invalid planId' }, 400);
      }
      amount = Number(planRow.price);
      // רבעוני/שנתי — תשלומים חודשיים בכרטיס (התחייבות): 3 / 12 תשלומים קבועים
      numOfPayments = planRow.period === 'quarterly' ? 3 : planRow.period === 'yearly' ? 12 : 1;
    }
    if (Number.isFinite(clientAmount) && Math.round(clientAmount) !== Math.round(amount)) {
      console.warn('[create-payment] client amount ignored (server price wins)', {
        planId,
        clientAmount,
        serverAmount: amount,
        userId: authUserId,
      });
    }

    const config = await loadCardComConfig(svc);
    if (!config) {
      console.error('[create-payment] CardCom config missing (DB + Edge secrets)');
      return json({
        success: false,
        error: BUYER_PAYMENT_ERROR_HE,
        code: 'CARDCOM_CONFIG_MISSING',
      }, 503);
    }
    console.log('[create-payment] config ok', {
      source: config.source,
      terminal: config.terminalNumber,
      operation: config.operation,
    });

    const wireOperation = resolveCreateOperation(isRecurring, config.operation as CardComAdminOperation);
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const planAmount = Math.round(amount);
    const { chargeAmount, testMode } = resolveCardComChargeAmountIls(planAmount);
    const productDescription = testMode
      ? `${description || `מנוי ${planId}`} [TEST CHARGE ₪${chargeAmount}, plan ₪${planAmount}]`
      : (description || `מנוי ${planId}`);

    if (testMode) {
      console.warn('[create-payment] CARDCOM TEST MODE ACTIVE', {
        chargeAmountIls: chargeAmount,
        planAmountIls: planAmount,
        planId,
        transactionId,
        hint: 'Unset CARDCOM_TEST_AMOUNT_ILS and set TEMP_TEST_CHARGE_AMOUNT_ILS=null after E2E test',
      });
    }

    // 1) pending order first (so webhook can find by LowProfileId after Create)
    // amount = real plan price; charged amount may be overridden in test mode (CardCom only)
    const { error: insertErr } = await svc.from('payment_transactions').insert({
      id: transactionId,
      user_id: userId,
      plan_id: planId,
      amount: planAmount,
      currency: 'ILS',
      status: 'pending',
      cardcom_operation: wireOperation,
      cardcom_description: testMode
        ? `TEST CHARGE ₪${chargeAmount} (plan ₪${planAmount})`
        : null,
      created_at: new Date().toISOString(),
    });
    if (insertErr) {
      console.error('[create-payment] insert pending failed', insertErr);
      return json({ success: false, error: BUYER_PAYMENT_ERROR_HE }, 500);
    }

    // Public landing pages (smart-action verify_jwt=false). Webhook authenticity = rapid-responder + GetLpResult.
    const successUrl = `${supabaseUrl}/functions/v1/smart-action?dp=ok`;
    const failedUrl = `${supabaseUrl}/functions/v1/smart-action?dp=fail`;
    const webhookUrl = `${supabaseUrl}/functions/v1/rapid-responder`;

    const createPayload = {
      TerminalNumber: config.terminalNumber,
      ApiName: config.apiName,
      Operation: wireOperation,
      // ReturnValue is for CardCom UI/ref only — webhook matches by LowProfileId
      ReturnValue: transactionId,
      Amount: chargeAmount,
      SuccessRedirectUrl: successUrl,
      FailedRedirectUrl: failedUrl,
      WebHookUrl: webhookUrl,
      Language: 'he',
      ISOCoinId: 1,
      // סכום קבוע מהעסקה — לא לאפשר עריכת openSum בדף התשלום
      // AVS כבוי — עיר/כתובת/מיקוד של בעל הכרטיס לא יוצגו
      AdvancedDefinition: {
        IsAVSEnable: false,
        // מספר תשלומים קבוע (min = max) — המשתמש לא בוחר
        MinNumOfPayments: numOfPayments,
        MaxNumOfPayments: numOfPayments,
        VirtualTerminal: {
          IsEnable: false,
          IsOpenSum: false,
          ChargeOnSwipe: false,
        },
      },
      UIDefinition: {
        CardOwnerNameValue: userName,
        CardOwnerPhoneValue: userPhone || undefined,
        CardOwnerEmailValue: userEmail || undefined,
        IsHideCardOwnerEmail: true,
      },
      Document: {
        DocumentTypeToCreate: 'Auto',
        // true = מציג OrderDetails (לכבוד/ת״ז/נייד/מייל). כתובת/מיקוד מוסתרים ב-CSS/HTML.
        IsAllowEditDocument: true,
        IsSendByEmail: Boolean(userEmail),
        Name: userName,
        Email: userEmail || undefined,
        Mobile: userPhone || undefined,
        Language: 'he',
        Products: [
          {
            Description: productDescription,
            UnitCost: chargeAmount,
            Quantity: 1,
          },
        ],
      },
      CustomFields: [
        { Name: 'userId', Value: userId },
        { Name: 'planId', Value: planId },
        { Name: 'transactionId', Value: transactionId },
        { Name: 'userEmail', Value: userEmail },
        { Name: 'userName', Value: userName },
        ...(testMode
          ? [
            { Name: 'testChargeIls', Value: String(chargeAmount) },
            { Name: 'planAmountIls', Value: String(planAmount) },
          ]
          : []),
      ],
    };

    let cardcomResult: {
      ResponseCode?: number;
      Description?: string;
      LowProfileId?: string;
      Url?: string;
    };
    try {
      const res = await fetch(`${CARDCOM_API_BASE}/LowProfile/Create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(createPayload),
      });
      const rawText = await res.text();
      try {
        cardcomResult = JSON.parse(rawText) as typeof cardcomResult;
      } catch {
        console.error('[create-payment] LowProfile/Create non-JSON', res.status, rawText.slice(0, 300));
        await svc
          .from('payment_transactions')
          .update({
            status: 'failed',
            cardcom_description: `LowProfile/Create HTTP ${res.status}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', transactionId);
        return json({
          success: false,
          error: BUYER_PAYMENT_ERROR_HE,
          code: 'CARDCOM_HTTP_ERROR',
        }, 502);
      }
      if (!res.ok) {
        console.error('[create-payment] LowProfile/Create HTTP error', {
          httpStatus: res.status,
          ResponseCode: cardcomResult.ResponseCode,
          Description: cardcomResult.Description,
          transactionId,
        });
      }
    } catch (err) {
      console.error('[create-payment] LowProfile/Create network error', err);
      await svc
        .from('payment_transactions')
        .update({ status: 'failed', cardcom_description: 'LowProfile/Create network error', updated_at: new Date().toISOString() })
        .eq('id', transactionId);
      return json({ success: false, error: BUYER_PAYMENT_ERROR_HE, code: 'CARDCOM_NETWORK' }, 502);
    }

    if (cardcomResult.ResponseCode !== 0 || !cardcomResult.Url || !cardcomResult.LowProfileId) {
      // Description → admin log only — never buyer-facing
      const responseCode = cardcomResult.ResponseCode ?? null;
      // CardCom 613 = company/terminal blocked — ops must contact CardCom support
      const isTerminalBlocked = responseCode === 613;
      const failCode = isTerminalBlocked ? 'CARDCOM_TERMINAL_BLOCKED' : 'CARDCOM_CREATE_FAILED';
      console.error('[create-payment] LowProfile/Create failed HIGH', {
        code: failCode,
        ResponseCode: responseCode,
        Description: cardcomResult.Description,
        transactionId,
        terminal: config.terminalNumber,
        configSource: config.source,
        hint: isTerminalBlocked
          ? 'CardCom terminal/company blocked — call CardCom support to unblock terminal'
          : undefined,
      });
      await svc
        .from('payment_transactions')
        .update({
          status: 'failed',
          cardcom_response_code: String(responseCode ?? ''),
          cardcom_description: cardcomResult.Description ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId);
      return json({
        success: false,
        error: BUYER_PAYMENT_ERROR_HE,
        code: failCode,
        // Admin/debug only — clients must not show Description to buyers
        adminCode: responseCode,
      }, 502);
    }

    const { error: updateErr } = await svc
      .from('payment_transactions')
      .update({
        cardcom_low_profile_id: cardcomResult.LowProfileId,
        cardcom_operation: wireOperation,
        payment_url: cardcomResult.Url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    if (updateErr) {
      console.error('[create-payment] failed to save LowProfileId', updateErr);
      return json({ success: false, error: BUYER_PAYMENT_ERROR_HE }, 500);
    }

    return json({
      success: true,
      transactionId,
      paymentUrl: cardcomResult.Url,
      lowProfileId: cardcomResult.LowProfileId,
      operation: wireOperation,
    });
  } catch (error) {
    console.error('[create-payment] unexpected', error);
    return json({
      success: false,
      error: BUYER_PAYMENT_ERROR_HE,
    }, 500);
  }
});
