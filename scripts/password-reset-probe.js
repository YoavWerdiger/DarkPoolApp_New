#!/usr/bin/env node
/**
 * Answers one question: can a user who forgot their password actually get back in?
 *
 * Creates a throwaway @example.invalid account, calls /auth/v1/recover on it, and
 * reports whether GoTrue accepted the request, how long the call took, and which
 * rate limit it trips. A ~2/hour ceiling means the project is still on Supabase's
 * built-in shared mailer (not usable in production); ~30/hour means custom SMTP.
 *
 * GoTrue answers 200 for unknown addresses on purpose (enumeration defence), so a
 * 200 alone proves nothing about delivery - auth.users.recovery_sent_at is the only
 * server-side evidence that a mail was actually handed to the mailer. Check it with:
 *   select recovery_sent_at from auth.users where email = '<the printed address>';
 *
 * Prints no passwords or tokens. Delete the account afterwards:
 *   delete from auth.users where email like '%@example.invalid';
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
if (!URL || !ANON) {
  console.error('missing supabase url/anon key in .env');
  process.exit(1);
}

/**
 * GoTrue rejects reserved TLDs such as .invalid at /auth/v1/recover with
 * email_address_invalid, so the mailer is never reached and the probe learns
 * nothing. PROBE_DOMAIN lets the caller point at an unregistered but
 * syntactically ordinary domain, which passes validation and then fails at DNS -
 * no mail can land in a real inbox either way.
 */
const DOMAIN = process.env.PROBE_DOMAIN || 'example.invalid';
const password = `Probe!${Math.random().toString(36).slice(2)}Aa1`;
const ACCOUNTS = Number(process.env.PROBE_ACCOUNTS || 1);
const ATTEMPTS = Number(process.env.PROBE_ATTEMPTS || 3);

async function post(pathname, body) {
  const started = Date.now();
  const res = await fetch(`${URL}${pathname}`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch (_) {}
  return { status: res.status, ms: Date.now() - started, body: parsed || {} };
}

(async () => {
  console.log(`\n=== password reset probe (domain: ${DOMAIN}) ===\n`);
  const emails = [];

  for (let a = 0; a < ACCOUNTS; a++) {
    const email = `pwreset-probe-${Date.now()}-${a}@${DOMAIN}`;
    const signup = await post('/auth/v1/signup', { email, password });
    emails.push(email);
    console.log(`signup #${a + 1}          : ${signup.status} (${signup.ms}ms)  ${email}`);
    if (signup.body.msg || signup.body.error_description) {
      console.log(`  message         : ${signup.body.msg || signup.body.error_description}`);
    }
    console.log(
      `  email_confirmed : ${signup.body.user?.email_confirmed_at ? 'YES (autoconfirm on - no mail sent)' : 'no'}`
    );
  }

  console.log('');
  for (const email of emails) {
    for (let i = 1; i <= ATTEMPTS; i++) {
      const r = await post('/auth/v1/recover', { email });
      const msg = r.body.msg || r.body.error_description || r.body.message || '';
      console.log(`recover ${i}/${email.split('@')[0].slice(-1)} : ${r.status} (${r.ms}ms)${msg ? ' - ' + msg : ''}`);
      if (r.body.error_code) console.log(`  error_code      : ${r.body.error_code}`);
    }
  }

  console.log(
    '\nNow verify server-side delivery evidence:\n' +
      `  select email, recovery_sent_at from auth.users where email like '%@${DOMAIN}';\n` +
      'recovery_sent_at stays NULL when the mailer refused the message.\n' +
      `Clean up:  delete from auth.users where email like '%@${DOMAIN}';\n`
  );
})();
