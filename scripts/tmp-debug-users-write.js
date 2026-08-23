const fs = require('fs');
const path = require('path');
const env = {};
for (const l of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

(async () => {
  const email = `rls-dbg-${Date.now()}@example.invalid`;
  const r = await fetch(`${BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Probe!xyzAa1234' }),
  });
  const a = await r.json();
  console.log('signup status', r.status, 'has_token', !!a.access_token);
  if (!a.access_token) { console.log(JSON.stringify(a).slice(0, 500)); return; }
  const claims = JSON.parse(Buffer.from(a.access_token.split('.')[1], 'base64').toString());
  console.log('jwt role:', claims.role, '| sub matches user:', claims.sub === a.user.id, '| aal:', claims.aal);

  const H = { apikey: ANON, Authorization: `Bearer ${a.access_token}`, 'Content-Type': 'application/json' };
  for (const [label, body] of [
    ['display_name only', { display_name: 'dbg' }],
    ['full_name only', { full_name: 'dbg' }],
    ['is_online only', { is_online: true }],
  ]) {
    const p = await fetch(`${BASE}/rest/v1/users?id=eq.${a.user.id}&select=id`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(body),
    });
    console.log(label, '(select=id) ->', p.status, JSON.stringify(await p.json().catch(() => null)));

    const p2 = await fetch(`${BASE}/rest/v1/users?id=eq.${a.user.id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify(body),
    });
    console.log(label, '(no repr)   ->', p2.status, JSON.stringify(await p2.json().catch(() => null)));
  }

  const g = await fetch(`${BASE}/rest/v1/users?id=eq.${a.user.id}&select=id`, { headers: H });
  console.log('select own id ->', g.status, JSON.stringify(await g.json().catch(() => null)));
  console.log('uid', a.user.id);
})();
