/**
 * Admin API — JWT + subscription_role admin/super_admin
 * Flattened single-file deploy (includes adminAuth helpers).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const PREMIUM = ['plus_user', 'premium_user', 'vip_user', 'admin', 'super_admin'];
const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') || '';

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
  meta: Record<string, unknown> = {},
) {
  // Audit must never fail the admin mutation itself.
  const { error } = await supabase.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    meta,
  });
  if (error) console.error('admin audit insert failed', action, error);
}

type Audience = 'all' | 'free' | 'premium' | 'active_7d' | 'custom';

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
      case 'stats':
        return await stats(supabase, body);
      case 'list_users':
        return await listUsers(supabase, body);
      case 'set_mute':
        return await setMute(supabase, adminId, body);
      case 'set_suspend':
        return await setSuspend(supabase, adminId, body);
      case 'set_premium':
        return await setPremium(supabase, adminId, body);
      case 'delete_user':
        return await deleteUser(supabase, adminId, body);
      case 'reset_password':
        return await resetPassword(supabase, adminId, body);
      case 'list_tickets':
        return await listTickets(supabase, body);
      case 'update_ticket':
        return await updateTicket(supabase, adminId, body);
      case 'list_feedback':
        return await listFeedback(supabase, body);
      case 'send_push':
        return await sendPush(supabase, adminId, body);
      case 'list_campaigns':
        return await listCampaigns(supabase);
      case 'get_cardcom_config':
        return await getCardcomConfig(supabase);
      case 'upsert_cardcom_config':
        return await upsertCardcomConfig(supabase, adminId, body);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('admin-api error', err);
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});

const ROLE_LABELS: Record<string, string> = {
  free_user: 'חינמי',
  free: 'חינמי',
  plus_user: 'פלוס+',
  premium_user: 'פרימיום',
  vip_user: 'VIP',
  elite_user: 'עלית',
  admin: 'מנהל',
  super_admin: 'סופר־מנהל',
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

async function stats(supabase: SupabaseClient, body: Record<string, unknown> = {}) {
  const now = Date.now();
  const dayAgo = new Date(now - 864e5).toISOString();
  const weekAgo = new Date(now - 7 * 864e5).toISOString();
  const monthAgo = new Date(now - 30 * 864e5).toISOString();
  const daysRaw = Number(body.days);
  const chartDays = daysRaw === 7 || daysRaw === 90 ? daysRaw : 30;
  const chartFrom = new Date(now - (chartDays - 1) * 864e5);
  chartFrom.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

  const [
    totalRes,
    dayRes,
    weekRes,
    monthRes,
    mutedRes,
    suspendedRes,
    premiumRes,
    tokensRes,
    growthRes,
    baselineRes,
    rolePlanRes,
    plansRes,
    monthPayRes,
    allPayRes,
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_muted', true),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_suspended', true),
    supabase.from('users').select('id', { count: 'exact', head: true }).in('subscription_role', PREMIUM),
    supabase.from('device_tokens').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('users').select('created_at').gte('created_at', chartFrom.toISOString()).order('created_at'),
    // משתמשים מלפני חלון הגרף — כדי שהנקודה הראשונה תהיה סה״כ מצטבר ולא 0
    supabase.from('users').select('id', { count: 'exact', head: true }).lt('created_at', chartFrom.toISOString()),
    supabase.from('users').select('subscription_role, subscription_plan'),
    supabase.from('subscription_plans').select('id, name, role'),
    supabase.from('payment_transactions').select('amount').eq('status', 'success').gte('created_at', monthStart),
    supabase.from('payment_transactions').select('amount').eq('status', 'success'),
  ]);

  const byDay = new Map<string, number>();
  for (let i = 0; i < chartDays; i++) {
    const d = new Date(chartFrom.getTime() + i * 864e5);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of growthRes.data ?? []) {
    const key = String(row.created_at).slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  // סכום מצטבר: baseline (לפני החלון) + סכום יומי עד כל נקודה
  let cumulative = baselineRes.count ?? 0;
  const growthSeries = Array.from(byDay.entries()).map(([date, daily]) => {
    cumulative += daily;
    return { date, count: cumulative };
  });

  const planNameById = new Map<string, string>();
  for (const p of plansRes.data ?? []) {
    planNameById.set(String(p.id), String(p.name || p.id));
  }

  const roleCounts = new Map<string, number>();
  const planCounts = new Map<string, number>();
  for (const row of rolePlanRes.data ?? []) {
    const role = String(row.subscription_role || 'free_user').toLowerCase() || 'free_user';
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    const plan = String(row.subscription_plan || 'free').toLowerCase() || 'free';
    planCounts.set(plan, (planCounts.get(plan) ?? 0) + 1);
  }

  const byRole = Array.from(roleCounts.entries())
    .map(([key, count]) => ({ key, label: roleLabel(key), count }))
    .sort((a, b) => b.count - a.count);

  const byPlan = Array.from(planCounts.entries())
    .map(([key, count]) => ({
      key,
      label: planNameById.get(key) ?? ROLE_LABELS[key] ?? key,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const sumAmounts = (rows: { amount?: number | string | null }[] | null | undefined) =>
    (rows ?? []).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

  return json({
    totals: {
      users: totalRes.count ?? 0,
      newToday: dayRes.count ?? 0,
      newWeek: weekRes.count ?? 0,
      newMonth: monthRes.count ?? 0,
      muted: mutedRes.count ?? 0,
      suspended: suspendedRes.count ?? 0,
      premium: premiumRes.count ?? 0,
      activeDevices: tokensRes.count ?? 0,
    },
    byRole,
    byPlan,
    revenue: {
      month: sumAmounts(monthPayRes.data),
      total: sumAmounts(allPayRes.data),
    },
    growthSeries,
  });
}

async function listUsers(supabase: SupabaseClient, body: Record<string, unknown>) {
  const q = String(body.query || '').trim();
  const page = Math.max(1, Number(body.page) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(body.pageSize) || 30));
  const from = (page - 1) * pageSize;
  let query = supabase
    .from('users')
    .select(
      'id, email, full_name, display_name, profile_picture, subscription_role, subscription_plan, created_at, last_active, last_seen, is_muted, muted_reason, is_suspended, suspended_reason, phone, intro_data',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,display_name.ilike.%${q}%,phone.ilike.%${q}%`);
  if (body.filter === 'muted') query = query.eq('is_muted', true);
  if (body.filter === 'suspended') query = query.eq('is_suspended', true);
  if (body.filter === 'premium') query = query.in('subscription_role', PREMIUM);
  const { data, error, count } = await query;
  if (error) throw error;
  return json({ users: data ?? [], total: count ?? 0, page, pageSize });
}

async function setMute(supabase: SupabaseClient, adminId: string, body: Record<string, unknown>) {
  const userId = String(body.userId || '');
  const muted = Boolean(body.muted);
  const reason = body.reason ? String(body.reason).slice(0, 500) : null;
  if (!userId) return json({ error: 'userId required' }, 400);
  if (userId === adminId) return json({ error: 'Cannot mute yourself' }, 400);
  const patch = muted
    ? { is_muted: true, muted_at: new Date().toISOString(), muted_reason: reason, muted_by: adminId }
    : { is_muted: false, muted_at: null, muted_reason: null, muted_by: null };
  const { data, error } = await supabase.from('users').update(patch).eq('id', userId).select('id, is_muted, muted_reason').maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: 'User not found' }, 404);
  await audit(supabase, adminId, muted ? 'mute_user' : 'unmute_user', userId, { reason });
  return json({ user: data });
}

async function setSuspend(supabase: SupabaseClient, adminId: string, body: Record<string, unknown>) {
  const userId = String(body.userId || '');
  const suspended = Boolean(body.suspended);
  const reason = body.reason ? String(body.reason).slice(0, 500) : null;
  if (!userId) return json({ error: 'userId required' }, 400);
  if (userId === adminId) return json({ error: 'Cannot suspend yourself' }, 400);
  const patch = suspended
    ? { is_suspended: true, suspended_at: new Date().toISOString(), suspended_reason: reason, suspended_by: adminId }
    : { is_suspended: false, suspended_at: null, suspended_reason: null, suspended_by: null };
  const { data, error } = await supabase.from('users').update(patch).eq('id', userId).select('id, is_suspended, suspended_reason').maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: 'User not found' }, 404);
  await audit(supabase, adminId, suspended ? 'suspend_user' : 'unsuspend_user', userId, { reason });
  return json({ user: data });
}

async function setPremium(supabase: SupabaseClient, adminId: string, body: Record<string, unknown>) {
  const userId = String(body.userId || '');
  const grant = Boolean(body.grant);
  if (!userId) return json({ error: 'userId required' }, 400);
  if (userId === adminId) return json({ error: 'Cannot change own premium' }, 400);
  const { data: target } = await supabase.from('users').select('id, subscription_role').eq('id', userId).maybeSingle();
  if (!target) return json({ error: 'User not found' }, 404);
  const currentRole = String(target.subscription_role || '').toLowerCase();
  if (ADMIN_ROLES.has(currentRole)) return json({ error: 'Cannot change admin subscription via this action' }, 400);
  const nextRole = grant ? 'premium_user' : 'free_user';
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('users')
    .update({
      subscription_role: nextRole,
      subscription_plan: grant ? 'premium' : 'free',
      subscription_expires_at: grant ? new Date(Date.now() + 365 * 864e5).toISOString() : null,
      updated_at: now,
    })
    .eq('id', userId)
    .select('id, subscription_role, subscription_plan')
    .maybeSingle();
  if (error) throw error;
  await supabase.from('user_subscriptions').update({ status: 'cancelled', cancelled_at: now }).eq('user_id', userId).eq('status', 'active');
  if (grant) {
    const { data: plans } = await supabase.from('subscription_plans').select('id').eq('role', 'premium_user').eq('active', true).limit(1);
    await supabase.from('user_subscriptions').insert({
      user_id: userId,
      plan_id: plans?.[0]?.id ?? 'monthly',
      status: 'active',
      starts_at: now,
      expires_at: new Date(Date.now() + 365 * 864e5).toISOString(),
      auto_renew: false,
    });
  }
  await audit(supabase, adminId, grant ? 'grant_premium' : 'revoke_premium', userId, { previousRole: currentRole, nextRole });
  return json({ user: data });
}

async function deleteUser(supabase: SupabaseClient, adminId: string, body: Record<string, unknown>) {
  const userId = String(body.userId || '');
  if (!userId) return json({ error: 'userId required' }, 400);
  if (userId === adminId) return json({ error: 'Cannot delete yourself' }, 400);
  const { data: target } = await supabase.from('users').select('id, subscription_role, email').eq('id', userId).maybeSingle();
  if (!target) return json({ error: 'User not found' }, 404);
  if (ADMIN_ROLES.has(String(target.subscription_role || '').toLowerCase())) {
    return json({ error: 'Cannot delete admin users' }, 400);
  }
  const now = new Date().toISOString();
  await supabase.from('users').update({
    email: `deleted_${userId.slice(0, 8)}@deleted.darkpool.local`,
    full_name: 'משתמש שנמחק',
    display_name: 'משתמש שנמחק',
    phone: null,
    profile_picture: null,
    avatar_url: null,
    deleted_at: now,
    deletion_requested_at: now,
    is_suspended: true,
    suspended_at: now,
    suspended_reason: 'deleted_by_admin',
    subscription_role: 'free_user',
    subscription_plan: 'free',
  }).eq('id', userId);
  await supabase.from('device_tokens').update({ is_active: false }).eq('user_id', userId);
  const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
  if (delErr) {
    await audit(supabase, adminId, 'delete_user_partial', userId, { authError: delErr.message });
    return json({ ok: false, partial: true, error: 'המשתמש סומן כמחוק, מחיקת Auth נכשלה' }, 500);
  }
  await audit(supabase, adminId, 'delete_user', userId, { previousEmail: target.email });
  return json({ ok: true });
}

async function resetPassword(supabase: SupabaseClient, adminId: string, body: Record<string, unknown>) {
  const userId = String(body.userId || '');
  if (!userId) return json({ error: 'userId required' }, 400);
  const { data: target } = await supabase.from('users').select('id, email').eq('id', userId).maybeSingle();
  if (!target?.email) return json({ error: 'User email not found' }, 404);
  const { data: linkData, error } = await supabase.auth.admin.generateLink({ type: 'recovery', email: target.email });
  if (error) throw error;
  await audit(supabase, adminId, 'reset_password', userId, { email: target.email });
  return json({ ok: true, email: target.email, actionLink: linkData?.properties?.action_link ?? null });
}

async function listTickets(supabase: SupabaseClient, body: Record<string, unknown>) {
  const status = body.status ? String(body.status) : null;
  const page = Math.max(1, Number(body.page) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(body.pageSize) || 30));
  const from = (page - 1) * pageSize;
  let query = supabase
    .from('support_tickets')
    .select('id, user_id, subject, body, status, admin_note, created_at, updated_at, users!support_tickets_user_id_fkey(email, full_name, display_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (status && ['new', 'in_progress', 'closed'].includes(status)) query = query.eq('status', status);
  const { data, error, count } = await query;
  if (error) throw error;
  return json({ tickets: data ?? [], total: count ?? 0, page, pageSize });
}

async function updateTicket(supabase: SupabaseClient, adminId: string, body: Record<string, unknown>) {
  const ticketId = String(body.ticketId || '');
  const status = body.status ? String(body.status) : null;
  const adminNote = body.adminNote !== undefined ? String(body.adminNote).slice(0, 2000) : undefined;
  if (!ticketId) return json({ error: 'ticketId required' }, 400);
  if (status && !['new', 'in_progress', 'closed'].includes(status)) return json({ error: 'Invalid status' }, 400);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  if (adminNote !== undefined) patch.admin_note = adminNote;
  const { data, error } = await supabase.from('support_tickets').update(patch).eq('id', ticketId).select('id, status, admin_note, updated_at').maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: 'Ticket not found' }, 404);
  await audit(supabase, adminId, 'update_ticket', null, { ticketId, status });
  return json({ ticket: data });
}

async function listFeedback(supabase: SupabaseClient, body: Record<string, unknown>) {
  const page = Math.max(1, Number(body.page) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(body.pageSize) || 30));
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from('app_feedback')
    .select(
      'id, user_id, rating, comment, created_at, users!app_feedback_user_id_fkey(email, full_name, display_name)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return json({ feedback: data ?? [], total: count ?? 0, page, pageSize });
}

async function audienceIds(supabase: SupabaseClient, audience: Audience, customIds?: string[]) {
  if (audience === 'custom') return (customIds ?? []).filter(Boolean);
  let query = supabase.from('users').select('id').eq('is_suspended', false);
  if (audience === 'free') query = query.or('subscription_role.is.null,subscription_role.eq.free_user');
  else if (audience === 'premium') query = query.in('subscription_role', PREMIUM);
  else if (audience === 'active_7d') {
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    query = query.or(`last_active.gte.${weekAgo},last_seen.gte.${weekAgo}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((u) => u.id as string);
}

async function sendPush(supabase: SupabaseClient, adminId: string, body: Record<string, unknown>) {
  const title = String(body.title || '').trim();
  const pushBody = String(body.body || '').trim();
  const audience = String(body.audience || 'all') as Audience;
  const customIds = Array.isArray(body.userIds) ? body.userIds.map(String) : undefined;
  const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data as Record<string, unknown> : {};
  if (!title || !pushBody) return json({ error: 'title and body required' }, 400);
  if (title.length > 80 || pushBody.length > 240) return json({ error: 'title/body too long' }, 400);

  const { data: campaign, error: campErr } = await supabase.from('admin_push_campaigns').insert({
    created_by: adminId,
    title,
    body: pushBody,
    data: { ...data, type: data.type || 'admin_broadcast' },
    audience,
    target_user_ids: audience === 'custom' ? customIds ?? [] : null,
    status: 'sending',
  }).select('id').single();
  if (campErr) throw campErr;

  const userIds = await audienceIds(supabase, audience, customIds);
  if (userIds.length === 0) {
    await supabase.from('admin_push_campaigns').update({ status: 'failed', failed_count: 0, sent_count: 0 }).eq('id', campaign.id);
    return json({ error: 'No users in audience', campaignId: campaign.id }, 400);
  }

  const { data: tokens, error: tokErr } = await supabase
    .from('device_tokens')
    .select('expo_push_token, user_id')
    .in('user_id', userIds)
    .eq('is_active', true);
  if (tokErr) throw tokErr;

  const messages = (tokens ?? [])
    .filter((t) => typeof t.expo_push_token === 'string' && t.expo_push_token.startsWith('ExponentPushToken'))
    .map((t) => ({
      to: t.expo_push_token as string,
      sound: 'default',
      title,
      body: pushBody,
      data: { ...data, type: data.type || 'admin_broadcast', campaignId: campaign.id },
      channelId: 'default',
    }));

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (EXPO_TOKEN) headers.Authorization = `Bearer ${EXPO_TOKEN}`;
    const res = await fetch(EXPO_URL, { method: 'POST', headers, body: JSON.stringify(batch) });
    if (!res.ok) { failed += batch.length; continue; }
    const result = await res.json();
    for (const ticket of Array.isArray(result?.data) ? result.data : []) {
      if (ticket?.status === 'ok') sent += 1; else failed += 1;
    }
  }

  await supabase.from('admin_push_campaigns').update({
    status: sent > 0 ? 'sent' : 'failed',
    sent_count: sent,
    failed_count: failed,
    sent_at: new Date().toISOString(),
  }).eq('id', campaign.id);
  await audit(supabase, adminId, 'send_push', null, { campaignId: campaign.id, audience, sent, failed, title });
  return json({ campaignId: campaign.id, audienceSize: userIds.length, tokens: messages.length, sent, failed });
}

async function listCampaigns(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('admin_push_campaigns')
    .select('id, title, body, audience, sent_count, failed_count, status, created_at, sent_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return json({ campaigns: data ?? [] });
}

function maskCardcomPassword(password: string | null | undefined): string {
  if (!password) return '';
  if (password.length <= 2) return '••';
  return `${'•'.repeat(Math.min(8, password.length - 2))}${password.slice(-2)}`;
}

async function getCardcomConfig(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('cardcom_config')
    .select('api_name, api_password, terminal_number, operation, updated_at, updated_by')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    // Bootstrap: report env presence without exposing secret values
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
            apiPasswordMasked: maskCardcomPassword(
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
      defaults: {
        apiName: 'CardTest1994',
        terminalNumber: 1000,
        operation: 'ChargeOnly',
      },
    });
  }

  return json({
    config: {
      apiName: data.api_name,
      apiPasswordMasked: maskCardcomPassword(data.api_password),
      hasPassword: Boolean(data.api_password),
      terminalNumber: data.terminal_number,
      operation: data.operation === 'CreateTokenOnly' ? 'CreateTokenOnly' : 'ChargeOnly',
      source: 'db' as const,
      updatedAt: data.updated_at,
    },
    defaults: {
      apiName: 'CardTest1994',
      terminalNumber: 1000,
      operation: 'ChargeOnly',
    },
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
  if (clearPassword) {
    apiPassword = '';
  } else if (passwordInput != null && passwordInput.length > 0 && !/^•+$/.test(passwordInput.replace(/.$/, ''))) {
    // Ignore masked placeholder submissions (contain •)
    if (!passwordInput.includes('•')) {
      apiPassword = passwordInput;
    }
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
      apiPasswordMasked: maskCardcomPassword(data.api_password),
      hasPassword: Boolean(data.api_password),
      terminalNumber: data.terminal_number,
      operation: data.operation === 'CreateTokenOnly' ? 'CreateTokenOnly' : 'ChargeOnly',
      source: 'db' as const,
      updatedAt: data.updated_at,
    },
  });
}
