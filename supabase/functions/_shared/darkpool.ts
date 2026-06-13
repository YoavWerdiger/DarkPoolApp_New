/**
 * supabase/functions/_shared/darkpool.ts
 * -----------------------------------------------------------------------------
 * Wrappers Deno-friendly מעל הליבה ב-`services/darkpool/*`.
 *
 * הקובץ הזה לא ייבא ישירות מ-/services/ (כדי לא להכניס יחסי-תלות של RN ל-Deno),
 * אלא מספק re-shape של ה-API בצורת copy/paste בטוחה. הוא מכיל פונקציות שמתקבלות
 * כקלט DB rows ומחזירות `DetectedSignal[]` — בדיוק כמו `detectSignals()`.
 *
 * הסיבה לשכפול: ב-Edge Function אנחנו לא יכולים לייבא קבצי TS מחוץ ל-supabase/
 * (Deno bundler לא ימצא אותם). אז אנחנו מייצרים copy עם אותה לוגיקה.
 */

// ---------------------------------------------------------------------------
// Types (copy מצומצם מ-types/darkpool.types.ts)
// ---------------------------------------------------------------------------

export type DarkPoolSide = 'buy' | 'sell' | 'unknown';
export type DarkPoolProviderName = 'polygon' | 'unusualwhales' | 'intrinio' | 'mock';
export type DarkPoolSignalType =
  | 'UNUSUAL_VOLUME'
  | 'SWEEP'
  | 'WHALE'
  | 'HIDDEN_ACCUMULATION'
  | 'INSIDER_DARKPOOL_CONFLUENCE';

export const DARK_POOL_WHALE_THRESHOLD = 1_000_000;
export const DARK_POOL_UNUSUAL_VOLUME_RATIO = 3.0;
export const DARK_POOL_SWEEP_WINDOW_MIN = 5;
export const DARK_POOL_INSIDER_LOOKBACK_DAYS = 30;

export interface NormalizedTrade {
  externalId: string | null;
  ticker: string;
  companyName: string | null;
  timestamp: number;
  price: number;
  size: number;
  premium: number;
  volume: number | null;
  side: DarkPoolSide;
  exchange: string | null;
  marketCap: number | null;
  provider: DarkPoolProviderName;
}

export interface InsiderBuy {
  ticker: string;
  insider_name: string | null;
  value: number;
  transaction_date: string;
  transaction_type: string;
}

export interface ScoreBreakdown {
  premium_score: number;
  repeat_score: number;
  insider_score: number;
  rel_volume_score: number;
  total: number;
}

export interface SignalMetrics {
  premium_total?: number;
  premium_buy?: number;
  premium_sell?: number;
  prints?: number;
  whale_count?: number;
  relative_volume?: number;
  insider_days_ago?: number;
  insider_value?: number;
  insider_name?: string | null;
  company_name?: string | null;
  market_cap?: number | null;
  score_breakdown?: ScoreBreakdown;
}

export interface DetectedSignal {
  ticker: string;
  signal_type: DarkPoolSignalType;
  score: number;
  reason: string;
  metrics: SignalMetrics;
  detected_at: string;
}

// ---------------------------------------------------------------------------
// Scoring (copy)
// ---------------------------------------------------------------------------

const WEIGHTS = { premium: 40, repeat: 20, insider: 20, rel_volume: 20 };

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
function round1(n: number): number { return Math.round(n * 10) / 10; }

export function premiumSubScore(premiumUsd: number): number {
  if (!Number.isFinite(premiumUsd) || premiumUsd <= 0) return 0;
  const raw = 1 / (1 + Math.exp(-0.000_000_15 * (premiumUsd - 5_000_000)));
  return clamp01(raw) * 100;
}
export function repeatSubScore(n: number): number {
  if (!Number.isFinite(n) || n <= 1) return 0;
  return clamp01(1 - Math.exp(-(n - 1) / 3)) * 100;
}
export function insiderSubScore(
  has: boolean, days?: number | null, value?: number | null
): number {
  if (!has) return 0;
  let s = 70;
  if (days != null) s += clamp01(1 - days / 30) * 20;
  if (value != null && value > 0) s += clamp01(Math.log10(value + 1) / 8) * 10;
  return Math.min(100, s);
}
export function relativeVolumeSubScore(r: number): number {
  if (!Number.isFinite(r) || r <= 1) return 0;
  return clamp01(Math.log(r) / Math.log(10)) * 100;
}

export interface ScoreInputs {
  premium: number;
  repeatCount: number;
  hasRecentInsider: boolean;
  insiderValue?: number | null;
  insiderDaysAgo?: number | null;
  relativeVolume: number;
  signalType: DarkPoolSignalType;
}

export function scoreSignal(inputs: ScoreInputs): ScoreBreakdown {
  const premium_score = premiumSubScore(inputs.premium);
  const repeat_score  = repeatSubScore(inputs.repeatCount);
  const insider_score = insiderSubScore(
    inputs.hasRecentInsider, inputs.insiderDaysAgo ?? null, inputs.insiderValue ?? null
  );
  const rel_volume_score = relativeVolumeSubScore(inputs.relativeVolume);
  let total = (
    premium_score * WEIGHTS.premium +
    repeat_score  * WEIGHTS.repeat +
    insider_score * WEIGHTS.insider +
    rel_volume_score * WEIGHTS.rel_volume
  ) / 100;
  if (inputs.signalType === 'INSIDER_DARKPOOL_CONFLUENCE'
      && premium_score >= 50 && rel_volume_score >= 50) {
    total = Math.min(100, total + 10);
  }
  return {
    premium_score: round1(premium_score),
    repeat_score: round1(repeat_score),
    insider_score: round1(insider_score),
    rel_volume_score: round1(rel_volume_score),
    total: round1(Math.max(0, Math.min(100, total))),
  };
}

// ---------------------------------------------------------------------------
// Signal detection (copy)
// ---------------------------------------------------------------------------

export interface SignalInput {
  ticker: string;
  companyName?: string | null;
  marketCap?: number | null;
  newTrades: NormalizedTrade[];
  trailing3dTrades: NormalizedTrade[];
  avg30dPremium: number | null;
  todayPremium: number;
  recentInsiderBuys: InsiderBuy[];
  recent72hSignals: number;
}

export function detectSignals(input: SignalInput): DetectedSignal[] {
  const out: DetectedSignal[] = [];
  const nowIso = new Date().toISOString();
  if (!input.newTrades.length) return out;

  const todayBuy = sumPremium(input.newTrades, 'buy');
  const todaySell = sumPremium(input.newTrades, 'sell');
  const todayTotal = sumPremium(input.newTrades);
  const todayCumulative = (input.todayPremium || 0) + todayTotal;
  const whales = input.newTrades.filter((t) => t.premium >= DARK_POOL_WHALE_THRESHOLD);

  const unusual = detectUnusualVolume(todayCumulative, input.avg30dPremium, input);
  if (unusual) out.push({ ...unusual, detected_at: nowIso });

  const sweep = detectSweep(input);
  if (sweep) out.push({ ...sweep, detected_at: nowIso });

  if (whales.length) {
    const w = buildWhale(whales, input);
    if (w) out.push({ ...w, detected_at: nowIso });
  }

  const accum = detectAccumulation(input, todayBuy, todaySell);
  if (accum) out.push({ ...accum, detected_at: nowIso });

  const conflu = detectConfluence(input, accum, whales);
  if (conflu) out.push({ ...conflu, detected_at: nowIso });

  // dedupe by type, keep highest score
  const map = new Map<string, DetectedSignal>();
  for (const s of out) {
    const prev = map.get(s.signal_type);
    if (!prev || s.score > prev.score) map.set(s.signal_type, s);
  }
  return Array.from(map.values());
}

function detectUnusualVolume(
  todayPremium: number, avg30d: number | null, input: SignalInput
): Omit<DetectedSignal, 'detected_at'> | null {
  if (!avg30d || avg30d <= 0) return null;
  const ratio = todayPremium / avg30d;
  if (ratio < DARK_POOL_UNUSUAL_VOLUME_RATIO) return null;
  const breakdown = scoreSignal({
    premium: todayPremium,
    repeatCount: input.recent72hSignals + 1,
    hasRecentInsider: input.recentInsiderBuys.length > 0,
    insiderDaysAgo: nearestInsiderDays(input.recentInsiderBuys),
    insiderValue: maxInsiderValue(input.recentInsiderBuys),
    relativeVolume: ratio,
    signalType: 'UNUSUAL_VOLUME',
  });
  return {
    ticker: input.ticker,
    signal_type: 'UNUSUAL_VOLUME',
    score: breakdown.total,
    reason: `Dark-pool volume היום ×${ratio.toFixed(1)} מהממוצע (${fmtUsd(todayPremium)})`,
    metrics: {
      premium_total: todayPremium,
      relative_volume: ratio,
      company_name: input.companyName ?? null,
      market_cap: input.marketCap ?? null,
      score_breakdown: breakdown,
    },
  };
}

function detectSweep(input: SignalInput): Omit<DetectedSignal, 'detected_at'> | null {
  const window = DARK_POOL_SWEEP_WINDOW_MIN * 60 * 1000;
  const sorted = [...input.newTrades].sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 3) return null;
  let bestCount = 0, bestPremium = 0, bestBuy = 0, bestSell = 0;
  for (let i = 0; i < sorted.length; i++) {
    let j = i, prem = 0, buy = 0, sell = 0;
    while (j < sorted.length && sorted[j].timestamp - sorted[i].timestamp <= window) {
      const t = sorted[j];
      prem += t.premium;
      if (t.side === 'buy') buy += t.premium;
      else if (t.side === 'sell') sell += t.premium;
      j++;
    }
    const count = j - i;
    if (count > bestCount || (count === bestCount && prem > bestPremium)) {
      bestCount = count; bestPremium = prem; bestBuy = buy; bestSell = sell;
    }
  }
  if (bestCount < 4 || bestPremium < 500_000) return null;
  const ratio = input.avg30dPremium && input.avg30dPremium > 0
    ? bestPremium / input.avg30dPremium : 1;
  const breakdown = scoreSignal({
    premium: bestPremium,
    repeatCount: input.recent72hSignals + 1,
    hasRecentInsider: input.recentInsiderBuys.length > 0,
    insiderDaysAgo: nearestInsiderDays(input.recentInsiderBuys),
    insiderValue: maxInsiderValue(input.recentInsiderBuys),
    relativeVolume: ratio,
    signalType: 'SWEEP',
  });
  return {
    ticker: input.ticker,
    signal_type: 'SWEEP',
    score: breakdown.total,
    reason: `סוויפ של ${bestCount} הדפסות תוך ${DARK_POOL_SWEEP_WINDOW_MIN} דקות (${fmtUsd(bestPremium)})`,
    metrics: {
      premium_total: bestPremium,
      premium_buy: bestBuy,
      premium_sell: bestSell,
      prints: bestCount,
      relative_volume: ratio,
      company_name: input.companyName ?? null,
      market_cap: input.marketCap ?? null,
      score_breakdown: breakdown,
    },
  };
}

function buildWhale(whales: NormalizedTrade[], input: SignalInput): Omit<DetectedSignal, 'detected_at'> | null {
  const biggest = whales.reduce((a, b) => (b.premium > a.premium ? b : a));
  const total = whales.reduce((s, t) => s + t.premium, 0);
  const ratio = input.avg30dPremium && input.avg30dPremium > 0 ? total / input.avg30dPremium : 1;
  const breakdown = scoreSignal({
    premium: total,
    repeatCount: input.recent72hSignals + 1,
    hasRecentInsider: input.recentInsiderBuys.length > 0,
    insiderDaysAgo: nearestInsiderDays(input.recentInsiderBuys),
    insiderValue: maxInsiderValue(input.recentInsiderBuys),
    relativeVolume: ratio,
    signalType: 'WHALE',
  });
  return {
    ticker: input.ticker,
    signal_type: 'WHALE',
    score: breakdown.total,
    reason: `הדפסת ענק ${fmtUsd(biggest.premium)} (${whales.length} סה"כ)`,
    metrics: {
      premium_total: total, prints: whales.length, whale_count: whales.length,
      relative_volume: ratio,
      company_name: input.companyName ?? null,
      market_cap: input.marketCap ?? null,
      score_breakdown: breakdown,
    },
  };
}

function detectAccumulation(
  input: SignalInput, todayBuy: number, todaySell: number
): Omit<DetectedSignal, 'detected_at'> | null {
  const trailingBuy = sumPremium(input.trailing3dTrades, 'buy') + todayBuy;
  const trailingSell = sumPremium(input.trailing3dTrades, 'sell') + todaySell;
  const trailingTotal = sumPremium(input.trailing3dTrades) + sumPremium(input.newTrades);
  const net = trailingBuy - trailingSell;
  if (net <= 0) return null;
  if (trailingTotal < 250_000) return null;
  const sideRatio = trailingTotal > 0 ? net / trailingTotal : 0;
  if (sideRatio < 0.2) return null;
  const relative = input.avg30dPremium && input.avg30dPremium > 0
    ? trailingTotal / (input.avg30dPremium * 3) : 1;
  const breakdown = scoreSignal({
    premium: net,
    repeatCount: input.recent72hSignals + 1,
    hasRecentInsider: input.recentInsiderBuys.length > 0,
    insiderDaysAgo: nearestInsiderDays(input.recentInsiderBuys),
    insiderValue: maxInsiderValue(input.recentInsiderBuys),
    relativeVolume: relative,
    signalType: 'HIDDEN_ACCUMULATION',
  });
  return {
    ticker: input.ticker,
    signal_type: 'HIDDEN_ACCUMULATION',
    score: breakdown.total,
    reason: `Buy-flow נטו של ${fmtUsd(net)} ב-3 ימים (${(sideRatio * 100).toFixed(0)}%)`,
    metrics: {
      premium_total: trailingTotal,
      premium_buy: trailingBuy,
      premium_sell: trailingSell,
      relative_volume: relative,
      company_name: input.companyName ?? null,
      market_cap: input.marketCap ?? null,
      score_breakdown: breakdown,
    },
  };
}

function detectConfluence(
  input: SignalInput,
  accumulation: Omit<DetectedSignal, 'detected_at'> | null,
  whales: NormalizedTrade[]
): Omit<DetectedSignal, 'detected_at'> | null {
  if (!input.recentInsiderBuys.length) return null;
  if (!accumulation && whales.length === 0) return null;
  const nearest = input.recentInsiderBuys.reduce((a, b) =>
    Date.parse(b.transaction_date) > Date.parse(a.transaction_date) ? b : a
  );
  const days = nearestInsiderDays(input.recentInsiderBuys) ?? 0;
  if (days > DARK_POOL_INSIDER_LOOKBACK_DAYS) return null;
  const premium = accumulation
    ? Number(accumulation.metrics.premium_total) || 0
    : whales.reduce((s, t) => s + t.premium, 0);
  const relative = accumulation?.metrics.relative_volume
    ?? (input.avg30dPremium && input.avg30dPremium > 0 ? premium / input.avg30dPremium : 1);
  const breakdown = scoreSignal({
    premium,
    repeatCount: input.recent72hSignals + 1,
    hasRecentInsider: true,
    insiderDaysAgo: days,
    insiderValue: nearest.value,
    relativeVolume: relative,
    signalType: 'INSIDER_DARKPOOL_CONFLUENCE',
  });
  return {
    ticker: input.ticker,
    signal_type: 'INSIDER_DARKPOOL_CONFLUENCE',
    score: breakdown.total,
    reason: `${nearest.insider_name || 'בכיר'} רכש ${fmtUsd(nearest.value)} לפני ${days} ימים + צבירה ב-Dark Pool ${fmtUsd(premium)}`,
    metrics: {
      premium_total: premium,
      relative_volume: relative,
      insider_days_ago: days,
      insider_value: nearest.value,
      insider_name: nearest.insider_name,
      company_name: input.companyName ?? null,
      market_cap: input.marketCap ?? null,
      score_breakdown: breakdown,
    },
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sumPremium(arr: NormalizedTrade[], side?: 'buy' | 'sell'): number {
  let s = 0;
  for (const t of arr) {
    if (side && t.side !== side) continue;
    s += t.premium;
  }
  return s;
}

function nearestInsiderDays(arr: InsiderBuy[]): number | null {
  if (!arr.length) return null;
  const now = Date.now();
  let best = Number.POSITIVE_INFINITY;
  for (const i of arr) {
    const t = Date.parse(i.transaction_date);
    if (!Number.isFinite(t)) continue;
    const d = Math.max(0, Math.floor((now - t) / 86_400_000));
    if (d < best) best = d;
  }
  return Number.isFinite(best) ? best : null;
}

function maxInsiderValue(arr: InsiderBuy[]): number | null {
  if (!arr.length) return null;
  return arr.reduce((m, x) => (x.value > m ? x.value : m), 0);
}

function fmtUsd(v: number): string {
  if (!Number.isFinite(v)) return '$0';
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Provider helpers (Deno fetch)
// ---------------------------------------------------------------------------

export interface ProviderFetch {
  trades: NormalizedTrade[];
  lastTimestamp: number | null;
}

export async function fetchFromPolygon(
  apiKey: string,
  sinceIso: string,
  universe: string[]
): Promise<ProviderFetch> {
  const out: NormalizedTrade[] = [];
  const POLYGON_DP_CONDS = new Set([12, 14, 37, 38]);
  let latest = 0;
  for (const sym of universe) {
    const url = `https://api.polygon.io/v3/trades/${encodeURIComponent(sym)}?timestamp.gte=${encodeURIComponent(sinceIso)}&order=asc&limit=2000&apiKey=${apiKey}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json() as {
        results?: Array<{
          id?: number | string;
          price: number;
          size: number;
          conditions?: number[];
          exchange?: number;
          sip_timestamp?: number;
          participant_timestamp?: number;
        }>;
      };
      for (const r of json.results || []) {
        const conds = Array.isArray(r.conditions) ? r.conditions : [];
        if (!conds.some((c) => POLYGON_DP_CONDS.has(c))) continue;
        const ts = Math.floor((r.participant_timestamp ?? r.sip_timestamp ?? 0) / 1e6);
        if (!ts) continue;
        if (ts > latest) latest = ts;
        const price = Number(r.price);
        const size = Number(r.size);
        if (!price || !size) continue;
        out.push({
          externalId: r.id != null ? `${sym}:${r.id}` : null,
          ticker: sym,
          companyName: null,
          timestamp: ts,
          price,
          size,
          premium: Math.round(price * size * 100) / 100,
          volume: null,
          side: 'unknown',
          exchange: r.exchange != null ? String(r.exchange) : null,
          marketCap: null,
          provider: 'polygon',
        });
      }
    } catch {
      // continue with next symbol
    }
  }
  return { trades: out, lastTimestamp: latest || null };
}

export async function fetchFromUnusualWhales(
  apiKey: string,
  sinceIso: string,
  limit = 200
): Promise<ProviderFetch> {
  const { fetchUwDarkpoolRecent } = await import('./unusualWhales.ts');
  const sinceMs = Date.parse(sinceIso);
  const capped = Math.min(200, Math.max(1, limit));
  const { prints, lastTimestamp } = await fetchUwDarkpoolRecent(apiKey, {
    limit: capped,
    min_premium: 50_000,
    sinceMs,
  });
  const out: NormalizedTrade[] = [];
  for (const r of prints) {
    const ts = Date.parse(r.executed_at);
    const price = Number(r.price);
    const size = Number(r.size);
    if (!price || !size) continue;
    const prem = Number(r.premium) || Math.round(price * size * 100) / 100;
    out.push({
      externalId: r.tracking_id != null ? `uw:${r.tracking_id}` : null,
      ticker: String(r.ticker).toUpperCase(),
      companyName: null,
      timestamp: ts,
      price,
      size,
      premium: prem,
      volume: r.volume != null ? Number(r.volume) : null,
      side: 'unknown',
      exchange: r.market_center ?? null,
      marketCap: null,
      provider: 'unusualwhales',
    });
  }
  return { trades: out, lastTimestamp };
}

export async function fetchFromIntrinio(
  apiKey: string,
  sinceIso: string
): Promise<ProviderFetch> {
  const url = `https://api-v2.intrinio.com/securities/dark-pool-activity?api_key=${apiKey}&start_date=${sinceIso.slice(0, 10)}&page_size=5000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`intrinio: ${res.status}`);
  const json = await res.json() as {
    dark_pool_activity?: Array<{
      id?: string;
      execution_time: string;
      price: number | string;
      size: number | string;
      side?: string;
      security?: { ticker?: string; company_name?: string };
    }>;
  };
  const sinceMs = Date.parse(sinceIso);
  const out: NormalizedTrade[] = [];
  let latest = 0;
  for (const r of json.dark_pool_activity || []) {
    const ts = Date.parse(r.execution_time);
    if (!Number.isFinite(ts) || ts < sinceMs) continue;
    if (ts > latest) latest = ts;
    const price = Number(r.price), size = Number(r.size);
    if (!price || !size || !r.security?.ticker) continue;
    out.push({
      externalId: r.id ? `intrinio:${r.id}` : null,
      ticker: r.security.ticker.toUpperCase(),
      companyName: r.security.company_name ?? null,
      timestamp: ts,
      price, size,
      premium: Math.round(price * size * 100) / 100,
      volume: null,
      side: r.side === 'buy' || r.side === 'sell' ? r.side : 'unknown',
      exchange: null,
      marketCap: null,
      provider: 'intrinio',
    });
  }
  return { trades: out, lastTimestamp: latest || null };
}

export const DEFAULT_UNIVERSE = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'GOOG', 'TSLA',
  'AMD', 'NFLX', 'AVGO', 'JPM', 'V', 'MA', 'COST', 'WMT', 'XOM',
  'PFE', 'BAC', 'WFC', 'BA', 'DIS', 'CRM', 'ORCL', 'ADBE', 'INTC',
  'KO', 'PEP', 'MCD', 'NKE', 'PYPL', 'SBUX', 'UBER', 'LYFT', 'SHOP',
  'PLTR', 'SOFI', 'COIN', 'HOOD', 'GME', 'AMC', 'BB', 'ABNB',
  'SPY', 'QQQ', 'IWM', 'DIA', 'TQQQ', 'SQQQ',
];

// ---------------------------------------------------------------------------
// AI insight (deterministic template) – Edge-safe.
// ---------------------------------------------------------------------------

export function buildTemplateInsight(
  ticker: string,
  companyName: string | null,
  type: DarkPoolSignalType,
  metrics: SignalMetrics
): string {
  const c = companyName || ticker;
  const p = fmtUsd(metrics.premium_total ?? 0);
  switch (type) {
    case 'UNUSUAL_VOLUME':
      return `מוסדיים הזרימו ${p} ב-Dark Pool של ${c} (${ticker})${
        metrics.relative_volume ? `, פעילות של ×${metrics.relative_volume.toFixed(1)} מהממוצע` : ''
      }.`;
    case 'SWEEP':
      return `${metrics.prints || 'מספר'} הדפסות זוהו ב-Dark Pool של ${c} בחלון של 5 דקות (${p}). דפוס סוויפ קלאסי.`;
    case 'WHALE':
      return `הדפסת ענק של ${p} זוהתה ב-Dark Pool של ${c}. מצביע על מעורבות מוסדית מאסיבית.`;
    case 'HIDDEN_ACCUMULATION': {
      const net = (metrics.premium_buy ?? 0) - (metrics.premium_sell ?? 0);
      return `מוסדיים צברו נטו ${fmtUsd(net)} ב-${c} ב-3 ימים אחרונים — צבירה שקטה מתחת לרדאר.`;
    }
    case 'INSIDER_DARKPOOL_CONFLUENCE': {
      const d = metrics.insider_days_ago ?? 0;
      const ins = metrics.insider_name || 'בכיר';
      const v = metrics.insider_value ? fmtUsd(metrics.insider_value) : '';
      return `${ins} רכש ${v} ב-${c} לפני ${d} ימים, ובמקביל ${p} ב-Dark Pool. קונפלוונס insider + מוסדי.`;
    }
  }
}
