#!/usr/bin/env node
/**
 * Probes what the packaged anon key can actually reach over PostgREST.
 *
 * SELECT probes are read-only. UPDATE probes rewrite a column to the value it
 * already holds, so they prove write access without changing data. INSERT probes
 * only run with PROBE_WRITES=1 and delete whatever they created.
 * Row contents are never printed - only counts, column names and status codes.
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error('missing supabase url/anon key in .env');
  process.exit(1);
}

const DEFAULT_TABLES = [
  'users', 'channel_members', 'messages', 'polls', 'poll_votes', 'user_channel_state',
  'broker_connections', 'broker_accounts', 'broker_positions', 'broker_executions',
  'broker_statements', 'broker_account_state', 'broker_panel_config',
  'portfolios', 'portfolio_transactions', 'daily_portfolio_snapshots',
  'payment_transactions', 'user_subscriptions', 'cardcom_config',
  'device_tokens', 'user_devices', 'chat_messages', 'chat_groups', 'chat_group_members',
  'pending_notifications', 'admin_audit_log', 'trades', 'support_tickets', 'app_feedback',
];

const TABLES = (process.env.PROBE_TABLES || DEFAULT_TABLES.join(','))
  .split(',').map((s) => s.trim()).filter(Boolean);

const TOKEN = process.env.PROBE_TOKEN || ANON;
const headers = {
  apikey: ANON,
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

const SENSITIVE_HINTS = ['email', 'phone', 'password', 'token', 'secret', 'api_key', 'apikey',
  'credential', 'vault', 'card', 'iban', 'account_number', 'login', 'username'];

async function readProbe(table) {
  const res = await fetch(`${URL}/rest/v1/${table}?select=*&limit=1`, {
    headers: { ...headers, Prefer: 'count=exact' },
  });
  const range = res.headers.get('content-range');
  const total = range ? range.split('/')[1] : null;
  let cols = [];
  let row = null;
  let msg = '';
  try {
    const body = await res.json();
    if (Array.isArray(body)) {
      if (body[0]) { cols = Object.keys(body[0]); row = body[0]; }
    } else if (body && body.message) msg = body.message;
  } catch (_) {}
  const ok = res.status === 200 || res.status === 206;
  return { ok, status: res.status, total, cols, row, msg };
}

// Rewrites a column to its existing value: proves UPDATE reaches the row without mutating it.
async function idempotentUpdateProbe(table, row) {
  if (!row || !row.id) return { verdict: 'n/a (no id column / no readable row)' };
  const col = ['full_name', 'name', 'title', 'content', 'status', 'updated_at']
    .find((c) => c in row);
  if (!col) return { verdict: 'n/a (no safe column)' };
  const res = await fetch(`${URL}/rest/v1/${table}?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ [col]: row[col] }),
  });
  let affected = 0;
  let msg = '';
  try {
    const body = await res.json();
    if (Array.isArray(body)) affected = body.length;
    else if (body && body.message) msg = body.message;
  } catch (_) {}
  if (res.status >= 400) return { verdict: `blocked ${res.status}${msg ? ' ' + msg.slice(0, 60) : ''}` };
  return { verdict: affected > 0 ? `WRITABLE (${affected} row touched)` : `blocked (0 rows visible)` };
}

async function insertProbe(table, payload) {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  let msg = '';
  let id = null;
  try {
    const body = await res.json();
    if (Array.isArray(body) && body[0]) id = body[0].id ?? null;
    else if (body && body.message) msg = body.message;
  } catch (_) {}
  return { ok: res.status < 300, status: res.status, id, msg };
}

(async () => {
  const label = process.env.PROBE_TOKEN ? 'AUTHENTICATED USER' : 'ANON (packaged key)';
  console.log(`\n=== PostgREST probe as ${label} ===\n`);
  const rows = [];
  for (const t of TABLES) {
    const r = await readProbe(t);
    let read;
    if (!r.ok) read = `error ${r.status} ${r.msg.slice(0, 40)}`;
    else if (r.total && Number(r.total) > 0) read = `READABLE (${r.total} rows)`;
    else read = 'empty / filtered (0 rows)';

    const u = r.ok && r.row ? await idempotentUpdateProbe(t, r.row) : { verdict: 'n/a' };
    const sensitive = r.cols.filter((c) => SENSITIVE_HINTS.some((h) => c.toLowerCase().includes(h)));

    rows.push({ table: t, read, update: u.verdict, exposedCols: sensitive.join(',') || '-' });
  }
  console.table(rows);

  if (process.env.PROBE_WRITES === '1') {
    console.log('\n--- INSERT probes ---');
    const probeId = '11111111-2222-3333-4444-555555555555';
    const attempts = [
      ['users', { id: probeId, email: 'rls-probe@example.invalid', full_name: 'RLS PROBE' }],
      ['channel_members', { channel_id: probeId, user_id: probeId }],
      ['messages', { channel_id: probeId, sender_id: probeId, content: 'rls probe' }],
      ['user_channel_state', { channel_id: probeId, user_id: probeId }],
      ['polls', { chat_id: probeId, creator_id: probeId, question: 'rls probe' }],
    ];
    for (const [t, payload] of attempts) {
      const r = await insertProbe(t, payload);
      console.log(`${t}: ${r.ok ? '*** WRITABLE ***' : 'blocked'} ${r.status}${r.msg ? ' (' + r.msg.slice(0, 90) + ')' : ''}`);
      if (r.ok) {
        const del = await fetch(`${URL}/rest/v1/${t}?id=eq.${r.id ?? probeId}`, { method: 'DELETE', headers });
        console.log(`   -> cleanup delete status ${del.status}`);
      }
    }
  }
})();
