/**
 * התראות אישיות ברשימת מעקב — בדיקה בשרת ופוש אמיתי.
 *
 * רץ מ-pg_cron (invoke_watchlist_alerts) כל 3 דקות בימי חול; פועל רק בשעות המסחר
 * בניו יורק (09:30–16:05 ET, בלי חגי NYSE). לכל פריט עם alerts_enabled:
 *   מחיר (Finnhub, גיבוי Yahoo) → הערכת כללים (_shared/watchlistAlertRules.ts)
 *   → watchlist_alerts_apply (מצב + dedupe אטומי ב-DB, כיבוד user_allows_notification)
 *   → Expo push למכשירים הפעילים.
 *
 * פרמטרים (רק עם service key): ?force=1 — גם מחוץ לשעות המסחר; ?seed=1 — רישום מצב בלי
 * לשלוח (הפעלה ראשונה); ?dry=1 — מחזיר את ההערכות בלי לגעת ב-DB.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';
import { isServiceCaller, serviceOnlyDenied } from '../_shared/serviceOnly.ts';
import { ensurePushBidi } from '../_shared/notificationBidi.ts';
import {
  evaluateWatchlistItem,
  itemNeedsRange,
  rangeFromDailyBars,
  type WatchlistAlertEval,
  type WatchlistAlertItem,
  type WatchlistAlertMarket,
} from '../_shared/watchlistAlertRules.ts';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') || '';
const FINNHUB_KEY = (Deno.env.get('FINNHUB_API_KEY') ?? '').trim();
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const UA = { 'User-Agent': 'Mozilla/5.0 (DarkPool watchlist alerts)' };

const NYSE_HOLIDAYS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19',
  '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18',
  '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);
const NYSE_EARLY_CLOSE = new Set(['2026-11-27', '2026-12-24', '2027-11-26']);
const OPEN_MIN = 9 * 60 + 30;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function nyNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = Number(get('hour')) % 24;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: get('weekday'),
    minutes: hour * 60 + Number(get('minute')),
  };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function mapLimit<T, R>(list: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (i < list.length) {
      const idx = i++;
      out[idx] = await fn(list[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

type Quote = { price: number | null; previousClose: number | null; open: number | null; dayHigh: number | null };

const finite = (v: unknown): number | null => {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n > 0 ? n : null;
};

async function finnhubQuote(symbol: string): Promise<Quote | null> {
  if (!FINNHUB_KEY) return null;
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol.replace('-', '.'))}&token=${FINNHUB_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    const price = finite(d?.c);
    if (price == null) return null;
    return { price, previousClose: finite(d?.pc), open: finite(d?.o), dayHigh: finite(d?.h) };
  } catch {
    return null;
  }
}

async function yahooChart(symbol: string, range: string) {
  try {
    const res = await fetch(`${YAHOO_CHART}/${encodeURIComponent(symbol.replace('.', '-'))}?range=${range}&interval=1d`, { headers: UA });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.chart?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

async function yahooQuote(symbol: string): Promise<Quote | null> {
  const r = await yahooChart(symbol, '1d');
  const meta = r?.meta;
  const price = finite(meta?.regularMarketPrice);
  if (price == null) return null;
  return {
    price,
    previousClose: finite(meta?.chartPreviousClose ?? meta?.previousClose),
    open: finite(r?.indicators?.quote?.[0]?.open?.[0]),
    dayHigh: finite(meta?.regularMarketDayHigh),
  };
}

async function yahooDailyBars(symbol: string) {
  const r = await yahooChart(symbol, '1y');
  const ts: number[] = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0] ?? {};
  return ts.map((t, i) => ({
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t * 1000)),
    high: finite(q.high?.[i]),
    low: finite(q.low?.[i]),
  }));
}

serve(async (req) => {
  if (!isServiceCaller(req)) return serviceOnlyDenied();
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  const seed = url.searchParams.get('seed') === '1';
  const dry = url.searchParams.get('dry') === '1';

  const now = nyNow();
  const closeMin = NYSE_EARLY_CLOSE.has(now.date) ? 13 * 60 : 16 * 60;
  if (!force) {
    if (now.weekday === 'Sat' || now.weekday === 'Sun' || NYSE_HOLIDAYS.has(now.date)) {
      return json({ skipped: 'market closed', ny: now });
    }
    if (now.minutes < OPEN_MIN || now.minutes > closeMin + 5) {
      return json({ skipped: 'outside market hours', ny: now });
    }
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: itemsRaw, error: itemsErr } = await supabase
    .from('stock_watchlist_items')
    .select('*')
    .eq('alerts_enabled', true)
    .limit(5000);
  if (itemsErr) return json({ error: itemsErr.message }, 500);
  let items = (itemsRaw ?? []) as WatchlistAlertItem[];
  if (items.length === 0) return json({ ok: true, items: 0 });

  // היקף «לפי הבחירה שלי» בהגדרות ההתראות — רק הטיקרים שנבחרו
  const userIds = Array.from(new Set(items.map((i) => i.user_id)));
  const { data: settings } = await supabase
    .from('user_notification_settings')
    .select('user_id, watchlist_alert_scope, watchlist_alert_symbols')
    .in('user_id', userIds);
  const scopeByUser = new Map<string, Set<string> | null>();
  for (const s of (settings ?? []) as Array<{ user_id: string; watchlist_alert_scope: string | null; watchlist_alert_symbols: string[] | null }>) {
    if (s.watchlist_alert_scope === 'selected' && Array.isArray(s.watchlist_alert_symbols)) {
      scopeByUser.set(s.user_id, new Set(s.watchlist_alert_symbols.map((x) => String(x).trim().toUpperCase())));
    }
  }
  items = items.filter((i) => {
    const picked = scopeByUser.get(i.user_id);
    return !picked || picked.has(String(i.symbol).toUpperCase());
  });

  const symbols = Array.from(new Set(items.map((i) => String(i.symbol).toUpperCase())));
  const rangeSymbols = new Set(items.filter(itemNeedsRange).map((i) => String(i.symbol).toUpperCase()));
  const earningsSymbols = Array.from(new Set(items.filter((i) => i.alert_earnings).map((i) => String(i.symbol).toUpperCase())));

  const quotes = new Map<string, Quote>();
  await mapLimit(symbols, 6, async (sym) => {
    const q = (await finnhubQuote(sym)) ?? (await yahooQuote(sym));
    if (q) quotes.set(sym, q);
  });

  const ranges = new Map<string, ReturnType<typeof rangeFromDailyBars>>();
  await mapLimit(Array.from(rangeSymbols), 4, async (sym) => {
    const bars = await yahooDailyBars(sym);
    if (bars.length > 0) ranges.set(sym, rangeFromDailyBars(bars, now.date));
  });

  const earnings = new Map<string, string>();
  if (earningsSymbols.length > 0) {
    const { data: rows } = await supabase
      .from('earnings_calendar')
      .select('code, report_date')
      .in('code', earningsSymbols)
      .gte('report_date', now.date)
      .lte('report_date', addDays(now.date, 1))
      .order('report_date', { ascending: true });
    for (const r of (rows ?? []) as Array<{ code: string; report_date: string }>) {
      const sym = String(r.code).toUpperCase();
      if (!earnings.has(sym) && r.report_date) earnings.set(sym, String(r.report_date).slice(0, 10));
    }
  }

  const ctx = { tradeDate: now.date, minutesSinceOpen: now.minutes - OPEN_MIN };
  const evals: WatchlistAlertEval[] = [];
  for (const item of items) {
    const sym = String(item.symbol).toUpperCase();
    const q = quotes.get(sym);
    const r = ranges.get(sym);
    const market: WatchlistAlertMarket = {
      price: q?.price ?? null,
      previousClose: q?.previousClose ?? null,
      open: q?.open ?? null,
      dayHigh: q?.dayHigh ?? null,
      prevWeekHigh: r?.prevWeekHigh ?? null,
      prevWeekLow: r?.prevWeekLow ?? null,
      prev52High: r?.prev52High ?? null,
      prev52Low: r?.prev52Low ?? null,
      earningsDate: earnings.get(sym) ?? null,
    };
    evals.push(...evaluateWatchlistItem(item, market, ctx));
  }

  if (dry) {
    return json({ ny: now, items: items.length, quotes: Object.fromEntries(quotes), evals });
  }

  const { data: fires, error: applyErr } = await supabase.rpc('watchlist_alerts_apply', {
    p_evals: evals,
    p_item_ids: items.map((i) => i.id),
    p_seed: seed,
  });
  if (applyErr) return json({ error: applyErr.message }, 500);

  type Fire = { user_id: string; item_id: string; symbol: string; rule_key: string; kind: string; threshold: number | null; price: number | null; message: string };
  const list = (fires ?? []) as Fire[];
  if (list.length === 0) {
    return json({ ok: true, ny: now, seed, items: items.length, symbols: symbols.length, quotes: quotes.size, evals: evals.length, fired: 0 });
  }

  const fireUsers = Array.from(new Set(list.map((f) => f.user_id)));
  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('user_id, expo_push_token')
    .eq('is_active', true)
    .in('user_id', fireUsers);
  const tokensByUser = new Map<string, Set<string>>();
  for (const t of (tokens ?? []) as Array<{ user_id: string; expo_push_token: string | null }>) {
    if (!t.expo_push_token?.startsWith('ExponentPushToken')) continue;
    if (!tokensByUser.has(t.user_id)) tokensByUser.set(t.user_id, new Set());
    tokensByUser.get(t.user_id)!.add(t.expo_push_token);
  }

  const messages: Record<string, unknown>[] = [];
  for (const f of list) {
    const collapseId = `darkpool-watchlist-${f.item_id}-${f.rule_key}`.slice(0, 64);
    for (const to of tokensByUser.get(f.user_id) ?? []) {
      messages.push({
        to,
        sound: 'default',
        title: ensurePushBidi(`${f.symbol} · התראת מעקב`),
        body: ensurePushBidi(f.message),
        data: {
          type: 'watchlist_alert',
          appName: 'DarkPool',
          notificationType: 'watchlist_alert',
          symbol: f.symbol,
          price: f.price,
          kind: f.kind,
          threshold: f.threshold,
        },
        priority: 'high',
        channelId: 'default',
        collapseId,
        android: { channelId: 'default', priority: 'high', tag: collapseId },
        ios: { sound: 'default', threadId: 'darkpool-watchlist' },
      });
    }
  }

  let sent = 0;
  let failed = 0;
  const errors: unknown[] = [];
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (EXPO_TOKEN) headers.Authorization = `Bearer ${EXPO_TOKEN}`;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_URL, { method: 'POST', headers, body: JSON.stringify(batch) });
      if (!res.ok) {
        failed += batch.length;
        errors.push({ status: res.status, body: (await res.text()).slice(0, 300) });
        continue;
      }
      const result = await res.json();
      for (const ticket of Array.isArray(result?.data) ? result.data : []) {
        if (ticket?.status === 'ok') sent += 1;
        else {
          failed += 1;
          errors.push(ticket?.details ?? ticket?.message ?? ticket);
        }
      }
    } catch (e) {
      failed += batch.length;
      errors.push(String(e));
    }
  }
  if (errors.length) console.warn('watchlist-alerts push errors', JSON.stringify(errors).slice(0, 1000));

  return json({
    ok: true,
    ny: now,
    items: items.length,
    symbols: symbols.length,
    quotes: quotes.size,
    evals: evals.length,
    fired: list.length,
    messages: messages.length,
    sent,
    failed,
  });
});
