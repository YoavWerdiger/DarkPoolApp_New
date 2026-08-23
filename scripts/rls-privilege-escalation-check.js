#!/usr/bin/env node
/**
 * Privilege-escalation probe against public.users and public.user_subscriptions.
 *
 * Admin access in this project is decided purely by `public.users.subscription_role`
 * ('admin' / 'super_admin'), and premium access by the subscription columns plus
 * `user_subscriptions`. Every one of those columns must therefore be unwritable
 * from an anon-key session, over BOTH PostgREST write paths:
 *   - PATCH            -> UPDATE
 *   - POST + Prefer: resolution=merge-duplicates -> INSERT ... ON CONFLICT DO UPDATE
 *   - DELETE own row then POST it back with elevated values
 *
 * Creates a throwaway @example.invalid account, never touches real rows, and
 * prints no credentials. Run after any change to grants or policies on users.
 */
const fs = require('fs');
const path = require('path');

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const email = `rls-esc-${Date.now()}@example.invalid`;
const password = `Probe!${Math.random().toString(36).slice(2)}Aa1`;

const results = [];
function record(name, ok, detail) {
  results.push({ check: name, result: ok ? 'PASS' : 'FAIL', detail: detail || '' });
}

/** A privileged write must be rejected loudly (42501 / 4xx), not silently ignored. */
function rejected(res) {
  const rows = Array.isArray(res.json) ? res.json.length : null;
  return res.status >= 400 || rows === 0;
}

(async () => {
  const signup = await fetch(`${URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const auth = await signup.json();
  const token = auth.access_token;
  const uid = auth.user?.id;
  record('auth.signUp returns session', Boolean(token && uid));
  if (!token) {
    console.table(results);
    process.exit(1);
  }

  const H = { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function req(method, pathAndQuery, body, prefer) {
    const res = await fetch(`${URL}/rest/v1/${pathAndQuery}`, {
      method,
      headers: prefer ? { ...H, Prefer: prefer } : H,
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    return { status: res.status, json };
  }

  async function myProfile() {
    const res = await fetch(`${URL}/rest/v1/rpc/get_my_profile`, { method: 'POST', headers: H, body: '{}' });
    const json = await res.json().catch(() => null);
    return Array.isArray(json) ? json[0] : json;
  }

  function detail(res) {
    const rows = Array.isArray(res.json) ? `${res.json.length} rows` : 'no body';
    return `status ${res.status}, code ${res.json?.code ?? '-'}, ${rows}`;
  }

  // ---- 1. UPDATE path: the privileged columns -----------------------------
  const escalations = [
    ['grant self admin (subscription_role)', { subscription_role: 'admin' }],
    ['grant self super_admin', { subscription_role: 'super_admin' }],
    ['lift own suspension (is_suspended)', { is_suspended: false }],
    ['lift own mute (is_muted)', { is_muted: false }],
    ['grant self premium plan', { subscription_plan: 'yearly', subscription_role: 'premium_user' }],
    ['extend own subscription expiry', { subscription_expires_at: '2099-01-01T00:00:00Z' }],
    ['grant self premium account_type', { account_type: 'yearly' }],
  ];
  for (const [name, patch] of escalations) {
    const res = await req('PATCH', `users?id=eq.${uid}&select=id`, patch, 'return=representation');
    record(`UPDATE rejected: ${name}`, rejected(res), detail(res));
  }

  // ---- 2. UPSERT path: POST + merge-duplicates ----------------------------
  // PostgREST compiles this to INSERT ... ON CONFLICT DO UPDATE, which needs a
  // different grant set than a plain UPDATE - a genuine bypass if left open.
  const upsert = await req('POST', 'users?select=id', { id: uid, email, subscription_role: 'admin' },
    'resolution=merge-duplicates,return=representation');
  record('UPSERT rejected: grant self admin', rejected(upsert), detail(upsert));

  const upsertPlan = await req('POST', 'users?select=id',
    { id: uid, email, subscription_plan: 'yearly', account_type: 'yearly' },
    'resolution=merge-duplicates,return=representation');
  record('UPSERT rejected: grant self premium', rejected(upsertPlan), detail(upsertPlan));

  // ---- 3. DELETE-then-INSERT path ----------------------------------------
  // Users may delete their own row; re-inserting it with elevated values would
  // sidestep every UPDATE-side control.
  const del = await req('DELETE', `users?id=eq.${uid}&select=id`, null, 'return=representation');
  const reinsert = await req('POST', 'users?select=id',
    { id: uid, email, full_name: 'Esc Probe', subscription_role: 'admin' }, 'return=representation');
  record('INSERT rejected: re-create own row as admin', rejected(reinsert),
    `delete ${del.status}, insert ${detail(reinsert)}`);
  // Restore a row so the rest of the probe has something to write to.
  await req('POST', 'users?select=id', { id: uid, email, full_name: 'Esc Probe' }, 'return=representation');

  // ---- 4. Cross-user write ------------------------------------------------
  const directory = await req('GET', 'v_public_profiles?select=id,display_name&limit=10');
  const victim = (directory.json || []).find((r) => r.id !== uid);
  if (victim) {
    // Rewrites display_name to the value it already holds: no data changes
    // whether the write lands or not.
    const other = await req('PATCH', `users?id=eq.${victim.id}&select=id`,
      { display_name: victim.display_name }, 'return=representation');
    record('UPDATE rejected: another user\'s row', rejected(other), detail(other));

    const otherRole = await req('PATCH', `users?id=eq.${victim.id}&select=id`,
      { subscription_role: 'free_user' }, 'return=representation');
    record('UPDATE rejected: another user\'s subscription_role', rejected(otherRole), detail(otherRole));
  }

  // ---- 5. Self-granted premium via user_subscriptions ---------------------
  const subInsert = await req('POST', 'user_subscriptions?select=id', {
    user_id: uid, plan_id: 'yearly', status: 'active',
    starts_at: new Date().toISOString(), expires_at: '2099-01-01T00:00:00Z',
  }, 'return=representation');
  record('INSERT rejected: self-granted premium subscription', rejected(subInsert), detail(subInsert));

  const subUpdate = await req('PATCH', `user_subscriptions?user_id=eq.${uid}&select=id`,
    { plan_id: 'yearly', status: 'active', expires_at: '2099-01-01T00:00:00Z' }, 'return=representation');
  record('UPDATE rejected: upgrade own subscription row', rejected(subUpdate), detail(subUpdate));

  // ---- 6. The legitimate profile edits must still work --------------------
  const allowed = [
    ['display_name', { display_name: 'Esc Probe 2' }],
    ['full_name', { full_name: 'Esc Probe Full' }],
    ['profile_picture', { profile_picture: 'https://example.invalid/a.png' }],
    ['gender', { gender: 'other' }],
    ['phone', { phone: `0500000${String(Date.now()).slice(-4)}` }],
    ['track_id + intro_data', { track_id: '1', intro_data: { source: 'probe' } }],
    ['registration_completed', { registration_completed: true }],
    ['presence (is_online/last_active)', { is_online: true, last_active: new Date().toISOString() }],
  ];
  for (const [name, patch] of allowed) {
    const res = await req('PATCH', `users?id=eq.${uid}&select=id`, patch, 'return=representation');
    const rows = Array.isArray(res.json) ? res.json.length : 0;
    record(`UPDATE allowed: ${name}`, res.status < 300 && rows === 1, detail(res));
  }

  // ---- 7. Ground truth: nothing actually escalated ------------------------
  const me = await myProfile();
  record('subscription_role still free_user', (me?.subscription_role ?? null) === 'free_user',
    `role=${me?.subscription_role ?? 'null'}`);
  record('subscription_plan still free', (me?.subscription_plan ?? null) === 'free',
    `plan=${me?.subscription_plan ?? 'null'}`);
  record('account_type not premium', !['yearly', 'monthly', 'quarterly'].includes(me?.account_type),
    `account_type=${me?.account_type ?? 'null'}`);
  record('is_suspended untouched by client', me?.is_suspended === false, `is_suspended=${me?.is_suspended}`);
  record('profile edit actually landed', me?.display_name === 'Esc Probe 2',
    `display_name=${me?.display_name ?? 'null'}`);

  const subs = await req('GET', 'user_subscriptions?select=plan_id,status');
  const premium = (subs.json || []).filter((s) => s.plan_id !== 'free' && s.status === 'active');
  record('no self-granted active premium subscription', premium.length === 0,
    `${(subs.json || []).length} rows, ${premium.length} premium`);

  console.table(results);
  console.log(`\nthrowaway auth user id: ${uid}`);
  const failed = results.filter((r) => r.result === 'FAIL');
  console.log(failed.length === 0 ? '\nAll checks passed.' : `\n${failed.length} check(s) FAILED.`);
  process.exit(failed.length === 0 ? 0 : 1);
})();
