#!/usr/bin/env node
/**
 * Answers one question: does auth.signUp return a usable session immediately?
 * If it does not, enabling RLS on public.users breaks the registration upsert,
 * which currently runs unauthenticated.
 * Creates a throwaway account; prints no credentials. Clean up the row afterwards.
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

const email = `rls-probe-${Date.now()}@example.invalid`;
const password = `Probe!${Math.random().toString(36).slice(2)}Aa1`;

(async () => {
  const res = await fetch(`${URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  const hasSession = Boolean(body.access_token);
  console.log('signup status      :', res.status);
  console.log('returns session    :', hasSession ? 'YES - RLS is safe for the registration upsert'
    : 'NO  - signUp requires email confirmation; the users upsert would run as anon');
  if (body.msg || body.error_description) console.log('message            :', body.msg || body.error_description);
  console.log('created auth id    :', body.user?.id || body.id || '(none)');
})();
