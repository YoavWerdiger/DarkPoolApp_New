#!/usr/bin/env node
/**
 * Asserts the profile privacy boundary from a real signed-in session:
 * what user A may read about user B, and what A may still read about itself.
 *
 * Read-only apart from the throwaway account it signs up and the chat groups it
 * joins. It never writes to anybody else's row and never prints an email,
 * a phone number or a token - only counts, column names and status codes.
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

const results = [];
function record(name, ok, detail) {
  results.push({ check: name, result: ok ? 'PASS' : 'FAIL', detail: detail || '' });
}

(async () => {
  const email = `rls-privacy-${Date.now()}@example.invalid`;
  const password = `Probe!${Math.random().toString(36).slice(2)}Aa1`;
  const signup = await fetch(`${URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const auth = await signup.json();
  const token = auth.access_token;
  const uid = auth.user?.id;
  if (!token) {
    console.error('signup did not return a session; cannot run the check');
    process.exit(1);
  }
  const H = { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function req(method, q, body, prefer) {
    const res = await fetch(`${URL}/rest/v1/${q}`, {
      method,
      headers: prefer ? { ...H, Prefer: prefer } : H,
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    return { status: res.status, json };
  }

  // ---- what A may NOT read about B -------------------------------------
  for (const col of ['email', 'phone', 'intro_data', 'subscription_role', 'is_suspended']) {
    const r = await req('GET', `users?select=id,${col}&limit=1`);
    record(`users.${col} is unreadable`, r.status >= 400 && r.json?.code === '42501',
      `status ${r.status}, code ${r.json?.code ?? '-'}`);
  }

  const star = await req('GET', 'users?select=*&limit=1');
  record('select(*) on users is refused, not silently trimmed',
    star.status >= 400, `status ${star.status}, code ${star.json?.code ?? '-'}`);

  const emailFilter = await req('GET', 'users?select=id&email=like.*%40*&limit=1');
  record('cannot filter users by email', emailFilter.status >= 400,
    `status ${emailFilter.status}, code ${emailFilter.json?.code ?? '-'}`);

  const viewEmail = await req('GET', 'v_public_profiles?select=email&limit=1');
  record('v_public_profiles has no email column', viewEmail.status >= 400,
    `status ${viewEmail.status}, code ${viewEmail.json?.code ?? '-'}`);

  // ---- what A must still see about B -----------------------------------
  const directory = await req('GET', 'v_public_profiles?select=id,display_name,full_name,profile_picture,is_online&limit=20');
  const others = (directory.json || []).filter((u) => u.id !== uid);
  record('directory lists other users via v_public_profiles',
    directory.status === 200 && others.length > 0, `${others.length} other users`);
  record('other users still expose a name',
    others.some((u) => u.display_name || u.full_name),
    `${others.filter((u) => u.display_name || u.full_name).length} named`);
  record('other users still expose an avatar field',
    directory.status === 200 && others.every((u) => 'profile_picture' in u));

  const publicCols = await req('GET', 'users?select=id,display_name,full_name,profile_picture,avatar_url,is_online,last_active&limit=5');
  record('public columns on users are still readable for everyone',
    publicCols.status === 200 && (publicCols.json || []).length > 0,
    `status ${publicCols.status}, ${(publicCols.json || []).length} rows`);

  // ---- what A must still see about itself ------------------------------
  const mine = await fetch(`${URL}/rest/v1/rpc/get_my_profile`, { method: 'POST', headers: H, body: '{}' });
  const mineJson = await mine.json().catch(() => null);
  const myRow = Array.isArray(mineJson) ? mineJson[0] : mineJson;
  record('get_my_profile returns own row', mine.status === 200 && myRow?.id === uid,
    `status ${mine.status}`);
  record('get_my_profile includes own private columns',
    Boolean(myRow) && 'email' in myRow && 'phone' in myRow && 'intro_data' in myRow);
  record('get_my_profile returns exactly one row (own)',
    !Array.isArray(mineJson) || mineJson.length === 1,
    `${Array.isArray(mineJson) ? mineJson.length : 1} row(s)`);

  // ---- PostgREST embeds of users must keep resolving -------------------
  const groups = await req('GET', 'chat_groups?select=id&limit=20');
  for (const g of groups.json || []) {
    await req('POST', 'chat_group_members', { group_id: g.id, user_id: uid, role: 'member' });
  }
  const embeds = [
    ['chat_messages sender embed', 'chat_messages?select=id,sender:users!chat_messages_sender_id_fkey(id,display_name,profile_picture,is_online)&limit=1', 'sender'],
    ['group members user embed', 'chat_group_members?select=user_id,user:users(id,display_name,full_name,profile_picture,is_online,last_active)&limit=1', 'user'],
    ['group members via view', 'chat_group_members?select=user_id,user:v_public_profiles(id,display_name,full_name,profile_picture)&limit=1', 'user'],
  ];
  for (const [name, q, key] of embeds) {
    const r = await req('GET', q);
    const first = (r.json || [])[0];
    record(name, r.status === 200 && (!first || Boolean(first[key])),
      `status ${r.status}, ${(r.json || []).length} row(s), embedded ${first ? (first[key] ? 'resolved' : 'NULL') : 'n/a'}`);
  }

  const memberEmail = await req('GET', 'chat_group_members?select=user_id,user:users(id,email)&limit=1');
  record('embedding email through a member row is refused', memberEmail.status >= 400,
    `status ${memberEmail.status}, code ${memberEmail.json?.code ?? '-'}`);

  // ---- legacy channel_members: only my own memberships ------------------
  const myMemberships = await req('GET', 'channel_members?select=channel_id,user_id&limit=500');
  const foreignMemberships = (myMemberships.json || []).filter((m) => m.user_id !== uid);
  record('channel_members exposes only my own rows',
    myMemberships.status === 200 && foreignMemberships.length === 0,
    `${(myMemberships.json || []).length} rows, ${foreignMemberships.length} foreign`);

  const myChannels = new Set((myMemberships.json || []).map((m) => m.channel_id));

  // ---- legacy messages: only channels I belong to -----------------------
  const visibleMsgs = await req('GET', 'messages?select=id,channel_id&limit=1000');
  const rows = visibleMsgs.json || [];
  const outsiders = rows.filter((m) => !myChannels.has(m.channel_id));
  record('messages exposes no channel I am not in',
    visibleMsgs.status === 200 && outsiders.length === 0,
    `${rows.length} rows across ${myChannels.size} of my channels, ${outsiders.length} foreign`);

  const msgCount = await fetch(`${URL}/rest/v1/messages?select=id&limit=1`, {
    headers: { ...H, Prefer: 'count=exact' },
  });
  record('messages is no longer fully readable',
    Number((msgCount.headers.get('content-range') || '/0').split('/')[1]) < 413,
    `visible total ${(msgCount.headers.get('content-range') || '').split('/')[1]}, was 413`);

  console.table(results);
  const failed = results.filter((r) => r.result === 'FAIL');
  console.log(failed.length === 0 ? '\nAll privacy checks passed.' : `\n${failed.length} check(s) FAILED.`);
  console.log(`throwaway auth user id: ${uid}`);
  process.exitCode = failed.length === 0 ? 0 : 1;
})();
