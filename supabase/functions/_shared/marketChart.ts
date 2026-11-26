/**
 * היסטוריית מחירים מ-EODHD (ספק מורשה) בפורמט התשובה של Yahoo v8 chart —
 * כדי שקוד הפענוח הקיים (שנכתב ל-Yahoo) ימשיך לעבוד בלי שינוי (פריט 17).
 *
 * fetchChartYahooShape(symbol, range, interval) → Response עם { chart: { result: [ { meta, timestamp, indicators } ] } }
 * fetchYahooCompatible(url) — מקבל URL בסגנון query1.finance.yahoo.com/v8/finance/chart/SYM?range=..&interval=..
 *
 * Secret: EODHD_API_KEY.
 */
const EODHD = 'https://eodhd.com/api';

/** AAPL → AAPL.US · ^GSPC → GSPC.INDX · BTC-USD → BTC-USD.CC · EURUSD=X → EURUSD.FOREX · TEVA.TA → TEVA.TA */
export function toEodhdCode(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (s.startsWith('^')) return `${s.slice(1)}.INDX`;
  if (s.endsWith('=X')) return `${s.slice(0, -2)}.FOREX`;
  if (/^[A-Z0-9]+-USD$/.test(s)) return `${s}.CC`;
  if (/\.[A-Z]{1,4}$/.test(s) && !/\.(A|B)$/.test(s)) return s; // כבר עם בורסה (TEVA.TA)
  return `${s.replace('.', '-')}.US`; // BRK.B → BRK-B.US
}

const DAY = 86_400_000;

function rangeStart(range: string, now: number): number | null {
  const m: Record<string, number> = {
    '1d': 1, '5d': 7, '1mo': 31, '3mo': 92, '6mo': 183, '1y': 366, '2y': 731, '5y': 1827, '10y': 3653,
  };
  if (range === 'max') return null;
  if (range === 'ytd') return Date.UTC(new Date(now).getUTCFullYear(), 0, 1);
  return now - (m[range] ?? 31) * DAY;
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

type Bar = { t: number; o: number | null; h: number | null; l: number | null; c: number | null; v: number | null };

async function getJson(url: string, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`EODHD ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchChartYahooShape(symbol: string, range = '1mo', interval = '1d'): Promise<Response> {
  const key = (Deno.env.get('EODHD_API_KEY') ?? '').trim();
  if (!key) return new Response(JSON.stringify({ error: 'EODHD_API_KEY missing' }), { status: 500 });
  const code = toEodhdCode(symbol);
  const now = Date.now();
  const intraday = /^(1m|2m|5m|15m|30m|60m|90m|1h)$/.test(interval);
  let bars: Bar[] = [];
  let chartPreviousClose: number | null = null;

  try {
    if (intraday) {
      const eInt = interval === '1m' || interval === '2m' ? '1m' : interval === '60m' || interval === '90m' || interval === '1h' ? '1h' : '5m';
      const from = Math.floor((rangeStart(range, now) ?? now - 7 * DAY) / 1000);
      const rows = await getJson(`${EODHD}/intraday/${encodeURIComponent(code)}?interval=${eInt}&from=${from}&to=${Math.floor(now / 1000)}&api_token=${key}&fmt=json`);
      bars = (Array.isArray(rows) ? rows : []).map((r: any) => ({
        t: Number(r.timestamp), o: r.open ?? null, h: r.high ?? null, l: r.low ?? null, c: r.close ?? null, v: r.volume ?? null,
      }));
    } else {
      const period = interval === '1wk' ? 'w' : interval === '1mo' ? 'm' : 'd';
      const start = rangeStart(range, now);
      // עוד שבוע אחורה — בשביל chartPreviousClose (הסגירה שלפני הטווח)
      const fromParam = start != null ? `&from=${iso(start - 7 * DAY)}` : '';
      const rows = await getJson(`${EODHD}/eod/${encodeURIComponent(code)}?period=${period}${fromParam}&to=${iso(now)}&api_token=${key}&fmt=json`);
      const all: Bar[] = (Array.isArray(rows) ? rows : []).map((r: any) => ({
        // 14:30 UTC ≈ פתיחת המסחר — התאריך נשאר נכון גם בשעון ישראל וגם ב-ET
        t: Math.floor(Date.parse(`${r.date}T14:30:00Z`) / 1000),
        o: r.open ?? null, h: r.high ?? null, l: r.low ?? null, c: r.close ?? null, v: r.volume ?? null,
      }));
      if (start != null) {
        const startSec = Math.floor(start / 1000);
        const before = all.filter((b) => b.t < startSec);
        chartPreviousClose = before.length ? before[before.length - 1].c : null;
        bars = all.filter((b) => b.t >= startSec);
      } else {
        bars = all;
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502 });
  }

  // מחיר עדכני ליום (real-time מושהה של EODHD) — בשביל meta
  let rt: any = null;
  try {
    rt = await getJson(`${EODHD}/real-time/${encodeURIComponent(code)}?api_token=${key}&fmt=json`, 5000);
  } catch {
    rt = null;
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== 'NA' && Number.isFinite(Number(v)) ? Number(v) : null);
  const last = bars[bars.length - 1];
  const meta = {
    currency: 'USD',
    symbol,
    regularMarketPrice: num(rt?.close) ?? last?.c ?? null,
    regularMarketTime: num(rt?.timestamp) ?? last?.t ?? null,
    previousClose: num(rt?.previousClose),
    chartPreviousClose: chartPreviousClose ?? bars[0]?.c ?? null,
    regularMarketOpen: num(rt?.open),
    regularMarketDayHigh: num(rt?.high),
    regularMarketDayLow: num(rt?.low),
    regularMarketVolume: num(rt?.volume),
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    marketCap: null,
    dataSource: 'eodhd',
  };
  const body = {
    chart: {
      result: [
        {
          meta,
          timestamp: bars.map((b) => b.t),
          indicators: {
            quote: [{ open: bars.map((b) => b.o), high: bars.map((b) => b.h), low: bars.map((b) => b.l), close: bars.map((b) => b.c), volume: bars.map((b) => b.v) }],
            adjclose: [{ adjclose: bars.map((b) => b.c) }],
          },
        },
      ],
      error: null,
    },
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/** מקבל URL בסגנון Yahoo chart ומחזיר תשובה בפורמט Yahoo מ-EODHD */
export function fetchYahooCompatible(url: string): Promise<Response> {
  const u = new URL(url);
  const symbol = decodeURIComponent(u.pathname.split('/').pop() ?? '');
  return fetchChartYahooShape(symbol, u.searchParams.get('range') ?? '1mo', u.searchParams.get('interval') ?? '1d');
}
