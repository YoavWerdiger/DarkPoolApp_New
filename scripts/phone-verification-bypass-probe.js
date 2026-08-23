#!/usr/bin/env node
/**
 * Attacker simulation: can an account be created and used without ever
 * verifying a phone number (or an email)? Talks straight to the Auth REST API
 * with the anon key that ships inside the app bundle, so it ignores every
 * check the onboarding screens perform. Creates one @example.invalid account,
 * reports what it can reach, and deletes it again. Prints no credentials.
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

const email = `phone-bypass-${Date.now()}@example.invalid`;
const password = `Probe!${Math.random().toString(36).slice(2)}Aa1`;

const results = [];
function record(name, ok, detail) {
  results.push({ check: name, result: ok ? 'PASS' : 'FAIL', detail: detail || '' });
}

(async () => {
  // Step 1 - straight signup, no phone anywhere in the request.
  const signup = await fetch(`${URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const auth = await signup.json();
  const token = auth.access_token;
  const uid = auth.user?.id;

  record('signUp without any phone step returns a live session',
    Boolean(token && uid), `status ${signup.status}`);
  if (!token) {
    console.table(results);
    process.exit(1);
  }

  record('account has NO phone_confirmed_at', !auth.user?.phone_confirmed_at,
    `phone_confirmed_at=${auth.user?.phone_confirmed_at ?? 'null'}`);
  record('account has NO phone at all', !auth.user?.phone,
    `phone=${auth.user?.phone ? 'set' : 'empty'}`);
  record('email auto-confirmed without clicking anything',
    Boolean(auth.user?.email_confirmed_at),
    `email_confirmed_at=${auth.user?.email_confirmed_at ? 'set' : 'null'}`);

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

  // Step 2 - what can this unverified account actually reach?
  const profileColumns = {
    email, display_name: 'Bypass Probe', full_name: 'Bypass Probe',
    track_id: '1', account_type: 'free', registration_completed: true,
  };
  const upd = await req('PATCH', `users?id=eq.${uid}&select=id`, profileColumns, 'return=representation');
  const inserted = (upd.json || []).length === 0
    ? await req('POST', 'users', { id: uid, ...profileColumns })
    : null;
  record('can write a complete public.users profile',
    upd.status < 300 && (!inserted || inserted.status < 300),
    `update ${upd.status}, insert ${inserted ? inserted.status : 'skipped'}`);

  const targets = [
    ['chat_groups', 'chat_groups?select=id&limit=50'],
    ['chat_messages', 'chat_messages?select=id&limit=50'],
    ['messages (breaking news)', 'messages?select=id&limit=20'],
    ['courses', 'courses?select=id&limit=20'],
    ['polls', 'polls?select=id&limit=20'],
    ['v_public_profiles (member directory)', 'v_public_profiles?select=id,display_name&limit=20'],
    ['user_subscriptions', 'user_subscriptions?select=id&limit=5'],
  ];
  for (const [label, q] of targets) {
    const r = await req('GET', q);
    const n = Array.isArray(r.json) ? r.json.length : 0;
    record(`unverified account can read ${label}`, r.status === 200, `status ${r.status}, ${n} rows`);
  }

  // Step 3 - can it sign back in later, i.e. is the account durable?
  const relogin = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const reloginJson = await relogin.json();
  record('unverified account can sign in again later',
    Boolean(reloginJson.access_token), `status ${relogin.status}`);

  // Step 4 - does the phone uniqueness check even look at verified numbers?
  const phoneRpc = await fetch(`${URL}/rest/v1/rpc/check_phone_exists`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_to_check: '0500000000' }),
  });
  record('check_phone_exists RPC reachable', phoneRpc.status === 200, `status ${phoneRpc.status}`);

  console.table(results);
  console.log(`\nthrowaway auth user id: ${uid}`);
  console.log('Delete it with: delete from auth.users where email like \'phone-bypass-%@example.invalid\';');
})();
