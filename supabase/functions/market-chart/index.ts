/**
 * market-chart — היסטוריית מחירים לאפליקציה דרך EODHD (במקום Yahoo הלא-רשמי). המפתח נשאר בשרת.
 * Body: { symbol, range, interval } → תשובה בפורמט Yahoo v8 chart (ראו _shared/marketChart.ts).
 * רק משתמש מחובר.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { isUserOrServiceCaller } from '../_shared/serviceOnly.ts';
import { fetchChartYahooShape } from '../_shared/marketChart.ts';

const ALLOWED_RANGES = new Set(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']);
const ALLOWED_INTERVALS = new Set(['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '1wk', '1mo']);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (!(await isUserOrServiceCaller(req))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  let body: { symbol?: string; range?: string; interval?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }
  const symbol = String(body.symbol ?? '').trim().slice(0, 24);
  const range = ALLOWED_RANGES.has(String(body.range)) ? String(body.range) : '1mo';
  const interval = ALLOWED_INTERVALS.has(String(body.interval)) ? String(body.interval) : '1d';
  if (!/^[\^A-Za-z0-9.\-=]+$/.test(symbol)) {
    return new Response(JSON.stringify({ error: 'invalid symbol' }), { status: 400 });
  }
  return fetchChartYahooShape(symbol, range, interval);
});
