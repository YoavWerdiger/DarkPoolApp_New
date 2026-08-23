/**
 * Admin CardCom — config + payment list + Refund (CancelDoc) + Deferred Charge.
 * JWT + admin/super_admin required. Secrets never leave the edge.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';
import {
  activateSubscriptionFromPayment,
  cancelDocument,
  chargeWithToken,
  resolveCardComDocumentUrl,
  formatCardExpirationMMYY,
  isEmptyOrZeroTxnId,
  loadCardComConfig,
  maskPassword,
} from '../_shared/cardcom.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

const PAYMENT_LIST_SELECT =
  'id, user_id, plan_id, amount, currency, status, cardcom_transaction_id, cardcom_low_profile_id, cardcom_operation, cardcom_response_code, cardcom_description, cardcom_document_type, cardcom_document_number, cardcom_document_url, cardcom_token, cardcom_token_card_year, cardcom_token_card_month, created_at, updated_at';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function svc(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function requireAdmin(req: Request) {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) return { ok: false as const, response: json({ error: 'Unauthorized' }, 401) };
  const supabase = svc();
  const { data: authData, error } = await supabase.auth.getUser(h.slice(7));
  if (error || !authData.user) return { ok: false as const, response: json({ error: 'Unauthorized' }, 401) };
  const { data: profile } = await supabase
    .from('users')
    .select('id, subscription_role')
    .eq('id', authData.user.id)
    .maybeSingle();
  const role = String(profile?.subscription_role || '').toLowerCase();
  if (!profile || !ADMIN_ROLES.has(role)) {
    return { ok: false as const, response: json({ error: 'Forbidden — admin only' }, 403) };
  }
  return { ok: true as const, adminId: profile.id as string, supabase };
}

async function audit(
  supabase: SupabaseClient,
  adminId: string,
  action: string,
  targetUserId: string | null,
  meta: Record<string, unknown>,
) {
  await supabase.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    meta,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const { adminId, supabase } = gate;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const action = String(body.action || '');
  try {
    switch (action) {
      case 'get_cardcom_config':
        return await getCardcomConfig(supabase);
      case 'upsert_cardcom_config':
        return await upsertCardcomConfig(supabase, adminId, body);
      case 'list_payment_transactions':
        return await listPaymentTransactions(supabase, body);
      case 'get_payment_transaction':
        return await getPaymentTransaction(supabase, body);
      case 'list_user_subscriptions':
        return await listUserSubscriptions(supabase, body);
      case 'billing_overview':
        return await billingOverview(supabase, body);
      case 'refund_payment':
        return await refundPayment(supabase, adminId, body);
      case 'charge_deferred':
        return await chargeDeferred(supabase, adminId, body);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('admin-cardcom error', err);
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});

async function getCardcomConfig(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('cardcom_config')
    .select('api_name, api_password, terminal_number, operation, updated_at, updated_by')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    const envName = Deno.env.get('CARDCOM_API_NAME') || Deno.env.get('CardCom_ApiName') || '';
    const envTerminal =
      Deno.env.get('CARDCOM_TERMINAL_NUMBER') ||
      Deno.env.get('CARDCOM_TERMINAL') ||
      Deno.env.get('CardCom_TerminalNumber') ||
      '';
    const envOp = Deno.env.get('CARDCOM_OPERATION') || Deno.env.get('CardCom_Operation') || 'ChargeOnly';
    const hasEnv = Boolean(envName && envTerminal);
    return json({
      config: hasEnv
        ? {
            apiName: envName,
            apiPasswordMasked: maskPassword(
              Deno.env.get('CARDCOM_API_PASSWORD') || Deno.env.get('CardCom_ApiPassword') || '',
            ),
            hasPassword: Boolean(
              Deno.env.get('CARDCOM_API_PASSWORD') || Deno.env.get('CardCom_ApiPassword'),
            ),
            terminalNumber: Number(envTerminal) || 1000,
            operation: envOp === 'CreateTokenOnly' ? 'CreateTokenOnly' : 'ChargeOnly',
            source: 'env' as const,
            updatedAt: null,
          }
        : null,
      defaults: { apiName: 'CardTest1994', terminalNumber: 1000, operation: 'ChargeOnly' },
    });
  }

  return json({
    config: {
      apiName: data.api_name,
      apiPasswordMasked: maskPassword(data.api_password),
      hasPassword: Boolean(data.api_password),
      terminalNumber: data.terminal_number,
      operation: data.operation === 'CreateTokenOnly' ? 'CreateTokenOnly' : 'ChargeOnly',
      source: 'db' as const,
      updatedAt: data.updated_at,
    },
    defaults: { apiName: 'CardTest1994', terminalNumber: 1000, operation: 'ChargeOnly' },
  });
}

async function upsertCardcomConfig(
  supabase: SupabaseClient,
  adminId: string,
  body: Record<string, unknown>,
) {
  const apiName = String(body.apiName ?? '').trim();
  const terminalNumber = Number(body.terminalNumber);
  const operation = body.operation === 'CreateTokenOnly' ? 'CreateTokenOnly' : 'ChargeOnly';
  const passwordInput = body.apiPassword != null ? String(body.apiPassword) : null;
  const clearPassword = body.clearPassword === true;

  if (!apiName) return json({ error: 'apiName required' }, 400);
  if (!Number.isFinite(terminalNumber) || terminalNumber <= 0) {
    return json({ error: 'terminalNumber required' }, 400);
  }

  const { data: existing } = await supabase
    .from('cardcom_config')
    .select('api_password')
    .eq('id', 1)
    .maybeSingle();

  let apiPassword = existing?.api_password ?? '';
  if (clearPassword) apiPassword = '';
  else if (passwordInput != null && passwordInput.length > 0 && !passwordInput.includes('•')) {
    apiPassword = passwordInput;
  }

  const row = {
    id: 1,
    api_name: apiName,
    api_password: apiPassword,
    terminal_number: Math.trunc(terminalNumber),
    operation,
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  };

  const { data, error } = await supabase
    .from('cardcom_config')
    .upsert(row, { onConflict: 'id' })
    .select('api_name, api_password, terminal_number, operation, updated_at')
    .single();
  if (error) throw error;

  await audit(supabase, adminId, 'upsert_cardcom_config', null, {
    apiName: data.api_name,
    terminalNumber: data.terminal_number,
    operation: data.operation,
    passwordSet: Boolean(data.api_password),
  });

  return json({
    config: {
      apiName: data.api_name,
      apiPasswordMasked: maskPassword(data.api_password),
      hasPassword: Boolean(data.api_password),
      terminalNumber: data.terminal_number,
      operation: data.operation === 'CreateTokenOnly' ? 'CreateTokenOnly' : 'ChargeOnly',
      source: 'db' as const,
      updatedAt: data.updated_at,
    },
  });
}

async function resolveUserIdsByEmail(supabase: SupabaseClient, q: string): Promise<string[]> {
  const { data } = await supabase.from('users').select('id').ilike('email', `%${q}%`).limit(50);
  return (data ?? []).map((u) => String(u.id));
}

async function listPaymentTransactions(supabase: SupabaseClient, body: Record<string, unknown>) {
  const page = Math.max(1, Number(body.page) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(body.pageSize) || 30));
  const from = (page - 1) * pageSize;
  const status = body.status != null && String(body.status).trim() ? String(body.status).trim() : null;
  const planId = body.planId != null && String(body.planId).trim() ? String(body.planId).trim() : null;
  const userId = body.userId != null && String(body.userId).trim() ? String(body.userId).trim() : null;
  const hasToken =
    body.hasToken === true || body.hasToken === 'true'
      ? true
      : body.hasToken === false || body.hasToken === 'false'
        ? false
        : null;
  const q = String(body.query || '').trim();

  let query = supabase
    .from('payment_transactions')
    .select(PAYMENT_LIST_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (status) query = query.eq('status', status);
  if (planId) query = query.eq('plan_id', planId);
  if (userId) query = query.eq('user_id', userId);
  if (hasToken === true) query = query.not('cardcom_token', 'is', null);
  if (hasToken === false) query = query.is('cardcom_token', null);

  if (q) {
    const emailIds = q.includes('@') || /[a-zA-Z]/.test(q) ? await resolveUserIdsByEmail(supabase, q) : [];
    const parts = [
      `id.ilike.%${q}%`,
      `cardcom_low_profile_id.ilike.%${q}%`,
      `cardcom_transaction_id.ilike.%${q}%`,
      `plan_id.ilike.%${q}%`,
    ];
    if (emailIds.length) {
      parts.push(`user_id.in.(${emailIds.join(',')})`);
    }
    query = query.or(parts.join(','));
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const userIds = [...new Set((data ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
  let usersById: Record<string, { email?: string | null; full_name?: string | null; display_name?: string | null }> =
    {};
  if (userIds.length) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name, display_name')
      .in('id', userIds);
    for (const u of users ?? []) {
      usersById[u.id] = u;
    }
  }

  const transactions = (data ?? []).map((tx) => ({
    ...tx,
    hasToken: Boolean(tx.cardcom_token),
    // Never expose raw token / description to list accidentally as token:
    cardcom_token: tx.cardcom_token ? '[set]' : null,
    user: tx.user_id ? usersById[tx.user_id] ?? null : null,
  }));

  return json({ transactions, total: count ?? 0, page, pageSize });
}

const SUB_LIST_SELECT =
  'id, user_id, plan_id, status, auto_renew, starts_at, expires_at, cancelled_at, cardcom_token, cardcom_token_exp_date, card_last4_digits, card_brand, source_transaction_id, created_at, updated_at';

async function listUserSubscriptions(supabase: SupabaseClient, body: Record<string, unknown>) {
  const page = Math.max(1, Number(body.page) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(body.pageSize) || 30));
  const from = (page - 1) * pageSize;
  const status = body.status != null && String(body.status).trim() ? String(body.status).trim() : null;
  const planId = body.planId != null && String(body.planId).trim() ? String(body.planId).trim() : null;
  const userId = body.userId != null && String(body.userId).trim() ? String(body.userId).trim() : null;
  const hasToken =
    body.hasToken === true || body.hasToken === 'true'
      ? true
      : body.hasToken === false || body.hasToken === 'false'
        ? false
        : null;
  const q = String(body.query || '').trim();

  let query = supabase
    .from('user_subscriptions')
    .select(SUB_LIST_SELECT, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (status) query = query.eq('status', status);
  if (planId) query = query.eq('plan_id', planId);
  if (userId) query = query.eq('user_id', userId);
  if (hasToken === true) query = query.not('cardcom_token', 'is', null);
  if (hasToken === false) query = query.is('cardcom_token', null);

  if (q) {
    const emailIds = await resolveUserIdsByEmail(supabase, q);
    const parts = [`plan_id.ilike.%${q}%`, `id.ilike.%${q}%`];
    if (emailIds.length) parts.push(`user_id.in.(${emailIds.join(',')})`);
    query = query.or(parts.join(','));
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const userIds = [...new Set((data ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
  let usersById: Record<string, { email?: string | null; full_name?: string | null; display_name?: string | null }> =
    {};
  if (userIds.length) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name, display_name')
      .in('id', userIds);
    for (const u of users ?? []) {
      usersById[u.id] = u;
    }
  }

  const now = Date.now();
  const subscriptions = (data ?? []).map((sub) => {
    const hasTok = Boolean(sub.cardcom_token);
    const autoRenew = Boolean(sub.auto_renew);
    const expiresAt = sub.expires_at ? String(sub.expires_at) : null;
    const nextCycleAt =
      autoRenew && sub.status === 'active' && expiresAt && new Date(expiresAt).getTime() > now
        ? expiresAt
        : autoRenew && sub.status === 'active' && expiresAt
          ? expiresAt
          : null;
    return {
      ...sub,
      hasToken: hasTok,
      cardcom_token: hasTok ? '[set]' : null,
      next_cycle_at: nextCycleAt,
      user: sub.user_id ? usersById[sub.user_id] ?? null : null,
    };
  });

  return json({ subscriptions, total: count ?? 0, page, pageSize });
}

/** Monthly payment summary + upcoming billing cycles (admin-only, no secrets). */
async function billingOverview(supabase: SupabaseClient, body: Record<string, unknown>) {
  const userId = body.userId != null && String(body.userId).trim() ? String(body.userId).trim() : null;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const upcomingHorizon = new Date(now.getTime() + 60 * 864e5).toISOString();

  let monthQuery = supabase
    .from('payment_transactions')
    .select('id, amount, status, created_at')
    .gte('created_at', monthStart);
  if (userId) monthQuery = monthQuery.eq('user_id', userId);

  let upcomingQuery = supabase
    .from('user_subscriptions')
    .select(SUB_LIST_SELECT)
    .eq('status', 'active')
    .eq('auto_renew', true)
    .not('expires_at', 'is', null)
    .lte('expires_at', upcomingHorizon)
    .order('expires_at', { ascending: true })
    .limit(40);
  if (userId) upcomingQuery = upcomingQuery.eq('user_id', userId);

  let activeQuery = supabase
    .from('user_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');
  if (userId) activeQuery = activeQuery.eq('user_id', userId);

  const [monthRes, upcomingRes, activeRes] = await Promise.all([
    monthQuery,
    upcomingQuery,
    activeQuery,
  ]);
  if (monthRes.error) throw monthRes.error;
  if (upcomingRes.error) throw upcomingRes.error;
  if (activeRes.error) throw activeRes.error;

  const rows = monthRes.data ?? [];
  let success = 0;
  let failed = 0;
  let pending = 0;
  let revenue = 0;
  for (const r of rows) {
    const st = String(r.status || '');
    const amt = Number(r.amount) || 0;
    if (st === 'success') {
      success += 1;
      revenue += amt;
    } else if (st === 'failed') {
      failed += 1;
    } else if (st === 'pending' || st === 'pending_charge') {
      pending += 1;
    }
  }

  const upcomingSubs = upcomingRes.data ?? [];
  const userIds = [...new Set(upcomingSubs.map((r) => r.user_id).filter(Boolean))] as string[];
  let usersById: Record<string, { email?: string | null; full_name?: string | null; display_name?: string | null }> =
    {};
  if (userIds.length) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name, display_name')
      .in('id', userIds);
    for (const u of users ?? []) {
      usersById[u.id] = u;
    }
  }

  const upcoming = upcomingSubs.map((sub) => {
    const hasTok = Boolean(sub.cardcom_token);
    const expiresAt = sub.expires_at ? String(sub.expires_at) : null;
    return {
      ...sub,
      hasToken: hasTok,
      cardcom_token: hasTok ? '[set]' : null,
      next_cycle_at: expiresAt,
      user: sub.user_id ? usersById[sub.user_id] ?? null : null,
    };
  });

  return json({
    month: {
      total: rows.length,
      success,
      failed,
      pending,
      revenue,
    },
    activeSubscriptions: activeRes.count ?? 0,
    upcoming,
  });
}

async function getPaymentTransaction(supabase: SupabaseClient, body: Record<string, unknown>) {
  const transactionId = String(body.transactionId || '').trim();
  if (!transactionId) return json({ error: 'transactionId required' }, 400);

  const { data, error } = await supabase
    .from('payment_transactions')
    .select(`${PAYMENT_LIST_SELECT}, cardcom_token_token_approval_number, cardcom_token_card_owner_identity_number`)
    .eq('id', transactionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: 'Transaction not found' }, 404);

  let user: Record<string, unknown> | null = null;
  if (data.user_id) {
    const { data: u } = await supabase
      .from('users')
      .select('id, email, full_name, display_name, phone, subscription_plan, subscription_role')
      .eq('id', data.user_id)
      .maybeSingle();
    user = u;
  }

  const canRefund =
    data.status === 'success' &&
    data.cardcom_document_number != null &&
    Boolean(data.cardcom_document_type);
  const canChargeDeferred =
    String(data.cardcom_operation) === 'CreateTokenOnly' &&
    data.status === 'pending_charge' &&
    isEmptyOrZeroTxnId(data.cardcom_transaction_id) &&
    Boolean(data.cardcom_token) &&
    data.cardcom_token_card_month != null &&
    data.cardcom_token_card_year != null;

  return json({
    transaction: {
      ...data,
      hasToken: Boolean(data.cardcom_token),
      // Admin may see Description; still mask raw token in transport if undesired — keep for charge
      cardcom_token_present: Boolean(data.cardcom_token),
      cardcom_token: data.cardcom_token ? `${String(data.cardcom_token).slice(0, 4)}…` : null,
    },
    user,
    actions: { canRefund, canChargeDeferred },
  });
}

async function refundPayment(
  supabase: SupabaseClient,
  adminId: string,
  body: Record<string, unknown>,
) {
  const transactionId = String(body.transactionId || '').trim();
  if (!transactionId) return json({ error: 'transactionId required' }, 400);

  const { data: order, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('id', transactionId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return json({ error: 'Transaction not found' }, 404);

  if (order.status === 'refunded') {
    return json({ error: 'העסקה כבר הוחזרה' }, 400);
  }
  if (order.status !== 'success') {
    return json({ error: 'ניתן לבצע החזר רק לעסקה בסטטוס success' }, 400);
  }
  if (order.cardcom_document_number == null || !order.cardcom_document_type) {
    return json({ error: 'חסרים DocumentNumber / DocumentType — לא ניתן לבטל מסמך' }, 400);
  }

  const config = await loadCardComConfig(supabase);
  if (!config) return json({ error: 'הגדרות CardCom חסרות' }, 503);
  if (!config.apiPassword) {
    return json({ error: 'ApiPassword נדרש להחזרים — הגדירו באדמין CardCom' }, 400);
  }

  let result: Awaited<ReturnType<typeof cancelDocument>>;
  try {
    result = await cancelDocument(
      config,
      Number(order.cardcom_document_number),
      String(order.cardcom_document_type),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin-cardcom] CancelDoc network', msg);
    return json({ error: msg, description: msg }, 502);
  }

  const responseCode = Number(result.ResponseCode);
  const description = result.Description ?? null;

  if (responseCode !== 0) {
    await supabase
      .from('payment_transactions')
      .update({
        cardcom_response_code: String(responseCode),
        cardcom_description: description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    await audit(supabase, adminId, 'refund_payment_failed', order.user_id, {
      transactionId,
      responseCode,
      description,
    });

    return json({
      success: false,
      responseCode,
      description,
      error: description || `CancelDoc failed (${responseCode})`,
    });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from('payment_transactions')
    .update({
      status: 'refunded',
      cardcom_response_code: String(responseCode),
      cardcom_description: description,
      updated_at: now,
      callback_data: {
        ...(typeof order.callback_data === 'object' && order.callback_data ? order.callback_data : {}),
        refund: result,
        refunded_at: now,
        refunded_by: adminId,
      },
    })
    .eq('id', transactionId)
    .select(PAYMENT_LIST_SELECT)
    .single();
  if (updErr) throw updErr;

  await audit(supabase, adminId, 'refund_payment', order.user_id, {
    transactionId,
    newDocumentNumber: result.NewDocumentNumber,
    newDocumentType: result.NewDocumentType,
  });

  return json({
    success: true,
    responseCode,
    description,
    newDocumentNumber: result.NewDocumentNumber ?? null,
    newDocumentType: result.NewDocumentType ?? null,
    transaction: updated,
  });
}

async function chargeDeferred(
  supabase: SupabaseClient,
  adminId: string,
  body: Record<string, unknown>,
) {
  const transactionId = String(body.transactionId || '').trim();
  if (!transactionId) return json({ error: 'transactionId required' }, 400);

  const { data: order, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('id', transactionId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return json({ error: 'Transaction not found' }, 404);

  if (String(order.cardcom_operation) !== 'CreateTokenOnly') {
    return json({ error: 'Charge דחוי זמין רק כש-Operation = CreateTokenOnly' }, 400);
  }
  if (order.status !== 'pending_charge') {
    return json({ error: 'סטטוס העסקה חייב להיות pending_charge' }, 400);
  }
  if (!isEmptyOrZeroTxnId(order.cardcom_transaction_id)) {
    return json({ error: 'לעסקה כבר יש TranzactionId — לא ניתן לחייב שוב' }, 400);
  }
  if (!order.cardcom_token) {
    return json({ error: 'חסר CardCom Token בעסקה' }, 400);
  }
  if (order.cardcom_token_card_month == null || order.cardcom_token_card_year == null) {
    return json({ error: 'חסרים חודש/שנת תוקף הטוקן' }, 400);
  }

  const config = await loadCardComConfig(supabase);
  if (!config) return json({ error: 'הגדרות CardCom חסרות' }, 503);

  let fullName = 'Customer';
  let email = '';
  let phone = '';
  if (order.user_id) {
    const { data: u } = await supabase
      .from('users')
      .select('email, full_name, display_name, phone')
      .eq('id', order.user_id)
      .maybeSingle();
    if (u) {
      fullName = String(u.display_name || u.full_name || 'Customer').trim() || 'Customer';
      email = String(u.email || '').trim();
      phone = String(u.phone || '').trim();
    }
  }

  const amount = Number(order.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return json({ error: 'סכום עסקה לא תקין' }, 400);
  }

  const exp = formatCardExpirationMMYY(
    Number(order.cardcom_token_card_month),
    Number(order.cardcom_token_card_year),
  );

  let result: Awaited<ReturnType<typeof chargeWithToken>>;
  try {
    result = await chargeWithToken(config, {
      amount,
      token: String(order.cardcom_token),
      cardExpirationMMYY: exp,
      isoCoinId: 1,
      fullName,
      identityNumber: order.cardcom_token_card_owner_identity_number
        ? String(order.cardcom_token_card_owner_identity_number)
        : undefined,
      email: email || undefined,
      phone: phone || undefined,
      productDescription: `מנוי ${order.plan_id}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin-cardcom] Transactions/Transaction network', msg);
    return json({ error: msg, description: msg }, 502);
  }

  const responseCode = Number(result.ResponseCode);
  const description = result.Description ?? null;
  const now = new Date().toISOString();
  const documentType = result.DocumentType != null ? String(result.DocumentType) : null;
  const documentNumber =
    result.DocumentNumber != null ? Number(result.DocumentNumber) : null;
  let documentUrl: string | null = null;
  if (responseCode === 0) {
    documentUrl = await resolveCardComDocumentUrl(config, {
      documentUrl: result.DocumentUrl,
      documentNumber,
      documentType,
    });
  }

  const patch: Record<string, unknown> = {
    cardcom_response_code: String(responseCode),
    cardcom_description: description,
    cardcom_document_type: documentType,
    cardcom_document_number: documentNumber,
    cardcom_document_url: documentUrl,
    updated_at: now,
    callback_data: {
      ...(typeof order.callback_data === 'object' && order.callback_data ? order.callback_data : {}),
      deferred_charge: result,
      charged_at: now,
      charged_by: adminId,
    },
  };

  if (responseCode === 0) {
    patch.status = 'success';
    patch.cardcom_transaction_id =
      result.TranzactionId != null ? String(result.TranzactionId) : `ok_${order.id}`;
  }

  const { data: updated, error: updErr } = await supabase
    .from('payment_transactions')
    .update(patch)
    .eq('id', transactionId)
    .select(PAYMENT_LIST_SELECT)
    .single();
  if (updErr) throw updErr;

  if (responseCode !== 0) {
    await audit(supabase, adminId, 'charge_deferred_failed', order.user_id, {
      transactionId,
      responseCode,
      description,
    });
    return json({
      success: false,
      responseCode,
      description,
      error: description || `Charge failed (${responseCode})`,
      transaction: updated,
    });
  }

  if (order.user_id && order.plan_id) {
    const act = await activateSubscriptionFromPayment(supabase, {
      userId: order.user_id,
      planId: order.plan_id,
      sourceTransactionId: order.id,
      paymentToken: order.cardcom_token ? String(order.cardcom_token) : null,
    });
    if (!act.ok) {
      console.error('[admin-cardcom] subscription activate failed after charge', act.error);
    }
  }

  await audit(supabase, adminId, 'charge_deferred', order.user_id, {
    transactionId,
    tranzactionId: result.TranzactionId,
    documentNumber: result.DocumentNumber,
    documentType: result.DocumentType,
  });

  return json({
    success: true,
    responseCode,
    description,
    tranzactionId: result.TranzactionId ?? null,
    documentNumber: result.DocumentNumber ?? null,
    documentType: result.DocumentType ?? null,
    transaction: updated,
  });
}
