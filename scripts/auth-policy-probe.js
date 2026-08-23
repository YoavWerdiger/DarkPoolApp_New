#!/usr/bin/env node
/**
 * Reports the Auth password policy that the packaged anon key is subject to.
 *
 * The Management API is the only way to *read* GoTrue config, so this infers the
 * policy from signup responses instead. Every address used is on the reserved
 * .invalid TLD and no real account is touched. Passwords are never printed.
 */
const fs = require('fs');
const path = require('path');

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const baseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Each case probes one rule. "known-pwned" appears in HaveIBeenPwned, so it is
// accepted only while leaked-password protection is off.
const CASES = [
  ['4 chars', 'abcd'],
  ['6 chars', 'abc123'],
  ['8 lower only', 'abcdefgh'],
  ['known-pwned', 'Password123!'],
  ['strong random', 'Zx9$qL2#vR7!mN4t'],
];

(async () => {
  const rows = [];
  for (const [label, password] of CASES) {
    const email = `authprobe-${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.invalid`;
    const res = await fetch(`${baseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    let body = {};
    try { body = await res.json(); } catch (_) {}
    const reason = body.msg || body.error_description || body.error || body.message || '';
    rows.push({
      case: label,
      status: res.status,
      verdict: res.status < 300 ? 'ACCEPTED' : 'rejected',
      reason: String(reason).slice(0, 70),
    });
  }
  console.table(rows);

  const settings = await fetch(`${baseUrl}/auth/v1/settings`, { headers: { apikey: anonKey } });
  console.log('\n--- publicly exposed /auth/v1/settings ---');
  console.log(JSON.stringify(await settings.json(), null, 1));
})();
