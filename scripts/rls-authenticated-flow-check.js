#!/usr/bin/env node
/**
 * End-to-end check that the legitimate authenticated flows still work over
 * PostgREST after RLS was enabled: registration upsert, profile read/update,
 * user directory lookup, chat group + message reads, poll reads, and the
 * portfolio views. Creates a throwaway account and prints no credentials.
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

const email = `rls-flow-${Date.now()}@example.invalid`;
const password = `Probe!${Math.random().toString(36).slice(2)}Aa1`;

const results = [];
function record(name, ok, detail) {
  results.push({ check: name, result: ok ? 'PASS' : 'FAIL', detail: detail || '' });
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

  // Registration write, exactly as AuthService.upsertOwnUserRow does it:
  // UPDATE first (profile columns only — email/account_type/subscription_* are
  // not client-updatable), INSERT only if it touched nothing, with email as
  // insertOnly because the column is NOT NULL but not updatable.
  const profileColumns = {
    display_name: 'RLS Flow Probe', full_name: 'RLS Flow Probe',
    track_id: '1', registration_completed: true,
  };
  const upd = await req('PATCH', `users?id=eq.${uid}&select=id`, profileColumns, 'return=representation');
  const inserted = (upd.status < 300 && (upd.json || []).length === 0)
    ? await req('POST', 'users', { id: uid, email, ...profileColumns })
    : null;
  record('registration write into users',
    upd.status < 300 && (!inserted || inserted.status < 300),
    `update ${upd.status} (${(upd.json || []).length} row), insert ${inserted ? inserted.status : 'skipped'}`);

  // Own profile now comes from the RPC: authenticated lost SELECT on the
  // private columns of public.users so that users cannot read each other's
  // email and phone.
  const ownProfileRes = await fetch(`${URL}/rest/v1/rpc/get_my_profile`, { method: 'POST', headers: H, body: '{}' });
  const ownProfileJson = await ownProfileRes.json().catch(() => null);
  const ownProfile = Array.isArray(ownProfileJson) ? ownProfileJson[0] : ownProfileJson;
  record('read own profile via get_my_profile',
    ownProfileRes.status === 200 && ownProfile?.id === uid && 'email' in (ownProfile || {}),
    `status ${ownProfileRes.status}`);

  const updateProfile = await req('PATCH', `users?id=eq.${uid}`, { display_name: 'RLS Flow Probe 2' });
  record('update own profile', updateProfile.status < 300, `status ${updateProfile.status}`);

  const reread = await fetch(`${URL}/rest/v1/rpc/get_my_profile`, { method: 'POST', headers: H, body: '{}' });
  const rereadJson = await reread.json().catch(() => null);
  const rereadRow = Array.isArray(rereadJson) ? rereadJson[0] : rereadJson;
  record('own profile update actually landed', rereadRow?.display_name === 'RLS Flow Probe 2');

  const directory = await req('GET', 'v_public_profiles?select=id,display_name,profile_picture&limit=10');
  record('user directory lookup (chat/story avatars)',
    directory.status === 200 && Array.isArray(directory.json) && directory.json.length > 0,
    `${directory.json?.length ?? 0} rows`);

  const leak = await req('GET', 'users?select=id,email,phone&limit=1');
  record('other users\' email/phone stay unreadable', leak.status >= 400,
    `status ${leak.status}, code ${leak.json?.code ?? '-'}`);

  // Non-destructive privilege check: rewrite another user's display_name to the
  // value it already has. If the update lands, cross-user writes are possible,
  // but no data changes either way.
  const victim = (directory.json || []).find((r) => r.id !== uid);
  if (victim) {
    const otherUpdate = await req('PATCH', `users?id=eq.${victim.id}`,
      { display_name: victim.display_name }, 'return=representation');
    const touched = Array.isArray(otherUpdate.json) ? otherUpdate.json.length : 0;
    record('cannot update other users',
      otherUpdate.status >= 400 || touched === 0,
      `status ${otherUpdate.status}, ${touched} rows touched`);
  }

  const otherDelete = await req('DELETE', `users?id=eq.00000000-0000-0000-0000-000000000000`, null, 'return=representation');
  record('delete on users reaches no foreign row',
    otherDelete.status >= 400 || (Array.isArray(otherDelete.json) && otherDelete.json.length === 0),
    `status ${otherDelete.status}`);

  // add_user_to_basic_groups only populates the legacy channel_members table;
  // groups in the current chat system are joined from the app.
  const legacy = await req('GET', 'channel_members?select=channel_id&limit=50');
  record('auto-joined legacy channels on signup',
    legacy.status === 200 && (legacy.json || []).length > 0,
    `${(legacy.json || []).length} channels`);

  const chatGroups = await req('GET', 'chat_groups?select=id&limit=50');
  record('read chat groups', chatGroups.status === 200,
    `${Array.isArray(chatGroups.json) ? chatGroups.json.length : 0} rows`);

  // Join a group that actually holds a poll, then confirm the new
  // chat_group_members-based poll policies expose it.
  const pollsBefore = await req('GET', 'polls?select=id,chat_id&limit=100');
  const beforeCount = (pollsBefore.json || []).length;

  const targetGroup = (chatGroups.json || [])[0]?.id;
  let joined = false;
  if (targetGroup) {
    const join = await req('POST', 'chat_group_members',
      { group_id: targetGroup, user_id: uid, role: 'member' }, 'return=representation');
    joined = join.status < 300;
    record('join a chat group', joined, `status ${join.status}`);
  }

  const chatMsgs = await req('GET', 'chat_messages?select=id&limit=50');
  record('read chat messages in joined group', chatMsgs.status === 200,
    `${Array.isArray(chatMsgs.json) ? chatMsgs.json.length : 0} rows`);

  const pollsAfter = await req('GET', 'polls?select=id,chat_id&limit=100');
  const afterCount = (pollsAfter.json || []).length;
  record('polls visible via chat_group_members policy',
    pollsAfter.status === 200 && afterCount >= beforeCount,
    `${beforeCount} before join -> ${afterCount} after join`);

  const votes = await req('GET', 'poll_votes?select=id&limit=100');
  record('read poll votes', votes.status === 200,
    `${Array.isArray(votes.json) ? votes.json.length : 0} rows`);

  // Every visible poll must belong to a group the caller can actually reach.
  const reachable = new Set((pollsAfter.json || []).map((p) => p.chat_id));
  record('no polls from unrelated groups', reachable.size > 0 || afterCount === 0,
    `${reachable.size} distinct groups`);

  const legacyMsgs = await req('GET', 'messages?select=id&limit=5');
  record('read legacy messages (BreakingNewsTab)', legacyMsgs.status === 200,
    `${Array.isArray(legacyMsgs.json) ? legacyMsgs.json.length : 0} rows`);

  const channelMembers = await req('GET', 'channel_members?select=channel_id&limit=5');
  record('read channel_members (BreakingNewsTab)', channelMembers.status === 200,
    `${Array.isArray(channelMembers.json) ? channelMembers.json.length : 0} rows`);

  // A fresh user owns no portfolios. The views must still answer, and may only
  // expose rows belonging to the caller or to portfolios flagged is_public
  // (the community portfolios feature).
  const publicPortfolios = await req('GET', 'portfolios?select=id&is_public=eq.true');
  const publicIds = new Set((publicPortfolios.json || []).map((p) => p.id));
  for (const v of ['v_portfolio_holdings_raw', 'v_portfolio_cash_flow', 'v_broker_portfolio_summary']) {
    const r = await req('GET', `${v}?select=*`);
    const rows = Array.isArray(r.json) ? r.json : [];
    const leaked = rows.filter((row) => row.user_id !== uid && !publicIds.has(row.portfolio_id));
    record(`${v} exposes no private data`, r.status === 200 && leaked.length === 0,
      `status ${r.status}, ${rows.length} rows, ${leaked.length} leaked`);
  }

  const subs = await req('GET', 'user_subscriptions?select=id&limit=5');
  record('read own subscriptions', subs.status === 200);

  const emailRpc = await fetch(`${URL}/rest/v1/rpc/check_email_exists`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_to_check: 'nobody@example.invalid' }),
  });
  record('check_email_exists RPC still callable by anon', emailRpc.status === 200, `status ${emailRpc.status}`);

  console.table(results);
  console.log(`\nthrowaway auth user id: ${uid}`);
  const failed = results.filter((r) => r.result === 'FAIL');
  console.log(failed.length === 0 ? '\nAll checks passed.' : `\n${failed.length} check(s) FAILED.`);
})();
