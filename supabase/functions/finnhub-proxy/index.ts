/**
 * finnhub-proxy — מפתח Finnhub נשאר בשרת (לא ב-bundle של האפליקציה).
 * רק משתמש מחובר. endpoints מותרים בלבד.
 * - { endpoint: 'quote', params: { symbol } }
 * - { endpoint: 'search', params: { q } }
 * - { endpoint: 'ws-token' } → המפתח ל-WebSocket של מחירים חיים (רק למשתמש מחובר; לא ב-bundle הציבורי)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { isUserOrServiceCaller } from '../_shared/serviceOnly.ts';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const ALLOWED: Record<string, string[]> = {
  quote: ['symbol'],
  search: ['q'],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (!(await isUserOrServiceCaller(req))) return json({ error: 'unauthorized' }, 401);

  const key = (Deno.env.get('FINNHUB_API_KEY') ?? '').trim();
  if (!key) return json({ error: 'not configured' }, 500);

  let body: { endpoint?: string; params?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  const endpoint = String(body.endpoint ?? '');

  if (endpoint === 'ws-token') return json({ token: key });

  const allowedParams = ALLOWED[endpoint];
  if (!allowedParams) return json({ error: 'endpoint not allowed' }, 400);

  const url = new URL(`${FINNHUB_BASE}/${endpoint}`);
  for (const p of allowedParams) {
    const v = body.params?.[p];
    if (v === undefined || v === null) continue;
    const s = String(v).slice(0, 64);
    url.searchParams.set(p, s);
  }
  url.searchParams.set('token', key);

  try {
    const r = await fetch(url.toString());
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return json({ error: 'upstream error' }, 502);
  }
});
