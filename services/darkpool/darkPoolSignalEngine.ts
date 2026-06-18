/**
 * darkPoolSignalEngine.ts
 * -----------------------------------------------------------------------------
 * מנוע זיהוי סיגנלים ב-Dark Pool — Pure TypeScript.
 *
 * זיהויים:
 *   1. UNUSUAL_VOLUME            — DP volume היום > 300% מממוצע 30 יום
 *   2. SWEEP                     — מספר prints על אותו טיקר ב-≤5 דקות
 *   3. WHALE                     — print בודד premium > $1M
 *   4. HIDDEN_ACCUMULATION       — buy flow > sell flow במשך 3 ימים אחרונים
 *   5. INSIDER_DARKPOOL_CONFLUENCE — accumulation/whale + insider P buy ב-30 יום אחרונים
 *
 * הקובץ pure — אין כאן אינטראקציה עם DB. ה-Edge Function מזין/מחלץ את הקלט.
 */

import {
  DARK_POOL_INSIDER_LOOKBACK_DAYS,
  DARK_POOL_SWEEP_WINDOW_MIN,
  DARK_POOL_UNUSUAL_VOLUME_RATIO,
  DARK_POOL_WHALE_THRESHOLD,
} from '../../types/darkpool.types';
import type {
  DarkPoolSignalMetrics,
  DarkPoolSignalType,
  InsiderBuyRow,
  NormalizedDarkPoolTrade,
} from '../../types/darkpool.types';
import { scoreSignal } from './darkPoolScoring';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SignalDetectionInput {
  /** טיקר נחקר. */
  ticker: string;
  /** company name (לתצוגה). */
  companyName?: string | null;
  /** market cap (לתצוגה). */
  marketCap?: number | null;
  /** ההדפסות החדשות שמגיעות מהקרון (אצווה אחת). */
  newTrades: NormalizedDarkPoolTrade[];
  /** היסטוריה של ה-3 ימים האחרונים (לחישוב hidden_accumulation + repeats). */
  trailing3dTrades: NormalizedDarkPoolTrade[];
  /** סך premium ממוצע יומי על 30 ימים (לחישוב Relative Volume). */
  avg30dPremium: number | null;
  /** premium היום עד כה. */
  todayPremium: number;
  /** רכישות bullish של בכירים ב-30 ימים. */
  recentInsiderBuys: InsiderBuyRow[];
  /** כמה סיגנלים שונים יש על הטיקר ב-72h (לחישוב Repeat). */
  recent72hSignals: number;
}

export interface DetectedSignal {
  ticker: string;
  signal_type: DarkPoolSignalType;
  score: number;
  reason: string;
  metrics: DarkPoolSignalMetrics;
  detected_at: string; // ISO
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

export function detectSignals(input: SignalDetectionInput): DetectedSignal[] {
  const out: DetectedSignal[] = [];
  const nowIso = new Date().toISOString();
  if (!input.newTrades.length) return out;

  // --- Common aggregations ---
  const todayBuy = sumPremium(input.newTrades, 'buy');
  const todaySell = sumPremium(input.newTrades, 'sell');
  const todayTotal = sumPremium(input.newTrades);
  const todayPremiumWithBatch = (input.todayPremium || 0) + todayTotal;
  const whales = input.newTrades.filter(
    (t) => t.premium >= DARK_POOL_WHALE_THRESHOLD
  );

  // ---------- 1. UNUSUAL_VOLUME ----------
  const unusual = detectUnusualVolume(
    todayPremiumWithBatch,
    input.avg30dPremium,
    input
  );
  if (unusual) out.push({ ...unusual, detected_at: nowIso });

  // ---------- 2. SWEEP ----------
  const sweep = detectSweep(input);
  if (sweep) out.push({ ...sweep, detected_at: nowIso });

  // ---------- 3. WHALE ----------
  if (whales.length) {
    const whale = buildWhaleSignal(whales, input);
    if (whale) out.push({ ...whale, detected_at: nowIso });
  }

  // ---------- 4. HIDDEN_ACCUMULATION ----------
  const accumulation = detectHiddenAccumulation(input, todayBuy, todaySell);
  if (accumulation) out.push({ ...accumulation, detected_at: nowIso });

  // ---------- 5. INSIDER_DARKPOOL_CONFLUENCE ----------
  const conflu = detectInsiderConfluence(input, accumulation, whales);
  if (conflu) out.push({ ...conflu, detected_at: nowIso });

  return dedupeByType(out);
}

// ---------------------------------------------------------------------------
// 1. Unusual Volume
// ---------------------------------------------------------------------------

export function detectUnusualVolume(
  todayPremium: number,
  avg30d: number | null,
  input: SignalDetectionInput
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
    reason: `Dark-pool volume היום ${formatRatio(ratio)} מהממוצע (${formatUsd(
      todayPremium
    )})`,
    metrics: {
      premium_total: todayPremium,
      relative_volume: ratio,
      company_name: input.companyName ?? undefined,
      market_cap: input.marketCap ?? undefined,
      score_breakdown: breakdown,
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Sweep — מספר prints בחלון 5 דקות
// ---------------------------------------------------------------------------

export function detectSweep(
  input: SignalDetectionInput
): Omit<DetectedSignal, 'detected_at'> | null {
  const window = DARK_POOL_SWEEP_WINDOW_MIN * 60 * 1000;
  const sorted = [...input.newTrades].sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 3) return null;
  // sliding window
  let bestCount = 0;
  let bestStart = 0;
  let bestEnd = 0;
  let bestPremium = 0;
  let bestBuy = 0;
  let bestSell = 0;
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    let prem = 0;
    let buy = 0;
    let sell = 0;
    while (j < sorted.length && sorted[j].timestamp - sorted[i].timestamp <= window) {
      const t = sorted[j];
      prem += t.premium;
      if (t.side === 'buy') buy += t.premium;
      else if (t.side === 'sell') sell += t.premium;
      j++;
    }
    const count = j - i;
    if (count > bestCount || (count === bestCount && prem > bestPremium)) {
      bestCount = count;
      bestPremium = prem;
      bestBuy = buy;
      bestSell = sell;
      bestStart = i;
      bestEnd = j;
    }
  }
  if (bestCount < 4) return null;
  // dampen low-premium spam
  if (bestPremium < 500_000) return null;
  void bestStart;
  void bestEnd;
  const ratio =
    input.avg30dPremium && input.avg30dPremium > 0
      ? bestPremium / input.avg30dPremium
      : 1;
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
    reason: `סוויפ של ${bestCount} הדפסות תוך ${DARK_POOL_SWEEP_WINDOW_MIN} דקות בסך ${formatUsd(bestPremium)}`,
    metrics: {
      premium_total: bestPremium,
      premium_buy: bestBuy,
      premium_sell: bestSell,
      prints: bestCount,
      relative_volume: ratio,
      company_name: input.companyName ?? undefined,
      market_cap: input.marketCap ?? undefined,
      score_breakdown: breakdown,
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Whale — print בודד מעל $1M
// ---------------------------------------------------------------------------

function buildWhaleSignal(
  whales: NormalizedDarkPoolTrade[],
  input: SignalDetectionInput
): Omit<DetectedSignal, 'detected_at'> | null {
  const biggest = whales.reduce((a, b) => (b.premium > a.premium ? b : a));
  const totalWhale = whales.reduce((s, t) => s + t.premium, 0);
  const ratio =
    input.avg30dPremium && input.avg30dPremium > 0
      ? totalWhale / input.avg30dPremium
      : 1;
  const breakdown = scoreSignal({
    premium: totalWhale,
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
    reason: `הדפסת ענק ${formatUsd(biggest.premium)} (${whales.length} סה"כ)`,
    metrics: {
      premium_total: totalWhale,
      prints: whales.length,
      whale_count: whales.length,
      relative_volume: ratio,
      company_name: input.companyName ?? undefined,
      market_cap: input.marketCap ?? undefined,
      score_breakdown: breakdown,
    },
  };
}

// ---------------------------------------------------------------------------
// 4. Hidden Accumulation — buy > sell ב-3d
// ---------------------------------------------------------------------------

export function detectHiddenAccumulation(
  input: SignalDetectionInput,
  todayBuy: number,
  todaySell: number
): Omit<DetectedSignal, 'detected_at'> | null {
  const trailingBuy = sumPremium(input.trailing3dTrades, 'buy') + todayBuy;
  const trailingSell = sumPremium(input.trailing3dTrades, 'sell') + todaySell;
  const trailingTotal =
    sumPremium(input.trailing3dTrades) + sumPremium(input.newTrades);
  const net = trailingBuy - trailingSell;
  if (net <= 0) return null;
  if (trailingTotal < 250_000) return null;
  const sideRatio = trailingTotal > 0 ? net / trailingTotal : 0;
  if (sideRatio < 0.2) return null; // need at least 20% net buy-flow

  const relative =
    input.avg30dPremium && input.avg30dPremium > 0
      ? trailingTotal / (input.avg30dPremium * 3)
      : 1;
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
    reason: `Buy-flow נטו של ${formatUsd(net)} ב-3 ימים אחרונים (${formatPct(sideRatio)} מהזרימה)`,
    metrics: {
      premium_total: trailingTotal,
      premium_buy: trailingBuy,
      premium_sell: trailingSell,
      relative_volume: relative,
      company_name: input.companyName ?? undefined,
      market_cap: input.marketCap ?? undefined,
      score_breakdown: breakdown,
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Insider × Dark-Pool Confluence
// ---------------------------------------------------------------------------

export function detectInsiderConfluence(
  input: SignalDetectionInput,
  accumulation: Omit<DetectedSignal, 'detected_at'> | null,
  whales: NormalizedDarkPoolTrade[]
): Omit<DetectedSignal, 'detected_at'> | null {
  if (!input.recentInsiderBuys.length) return null;
  // נדרש: יש insider P-buy ב-LOOKBACK + יש סימן ל-DP accumulation/whale
  const hasAccumulation = !!accumulation;
  const hasWhale = whales.length > 0;
  if (!hasAccumulation && !hasWhale) return null;

  const nearest = input.recentInsiderBuys.reduce((a, b) =>
    new Date(b.transaction_date) > new Date(a.transaction_date) ? b : a
  );
  const daysAgo = nearestInsiderDays(input.recentInsiderBuys) ?? 0;
  if (daysAgo > DARK_POOL_INSIDER_LOOKBACK_DAYS) return null;

  const premiumTotal = accumulation
    ? Number(accumulation.metrics.premium_total) || 0
    : whales.reduce((s, t) => s + t.premium, 0);
  const relative =
    accumulation?.metrics.relative_volume ??
    (input.avg30dPremium && input.avg30dPremium > 0
      ? premiumTotal / input.avg30dPremium
      : 1);

  const breakdown = scoreSignal({
    premium: premiumTotal,
    repeatCount: input.recent72hSignals + 1,
    hasRecentInsider: true,
    insiderDaysAgo: daysAgo,
    insiderValue: nearest.value,
    relativeVolume: relative,
    signalType: 'INSIDER_DARKPOOL_CONFLUENCE',
  });

  const reason = `${nearest.insider_name || 'בכיר'} רכש ${formatUsd(nearest.value)} לפני ${daysAgo} ימים, ובמקביל זוהתה צבירה ב-Dark Pool בסך ${formatUsd(premiumTotal)}`;

  return {
    ticker: input.ticker,
    signal_type: 'INSIDER_DARKPOOL_CONFLUENCE',
    score: breakdown.total,
    reason,
    metrics: {
      premium_total: premiumTotal,
      relative_volume: relative,
      insider_days_ago: daysAgo,
      insider_value: nearest.value,
      insider_name: nearest.insider_name,
      company_name: input.companyName ?? undefined,
      market_cap: input.marketCap ?? undefined,
      score_breakdown: breakdown,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sumPremium(
  trades: NormalizedDarkPoolTrade[],
  side?: 'buy' | 'sell'
): number {
  let total = 0;
  for (const t of trades) {
    if (side && t.side !== side) continue;
    total += t.premium;
  }
  return total;
}

function nearestInsiderDays(insiders: InsiderBuyRow[]): number | null {
  if (!insiders.length) return null;
  const now = Date.now();
  let nearest = Number.POSITIVE_INFINITY;
  for (const i of insiders) {
    const t = Date.parse(i.transaction_date);
    if (!Number.isFinite(t)) continue;
    const d = Math.max(0, Math.floor((now - t) / (24 * 60 * 60 * 1000)));
    if (d < nearest) nearest = d;
  }
  return Number.isFinite(nearest) ? nearest : null;
}

function maxInsiderValue(insiders: InsiderBuyRow[]): number | null {
  if (!insiders.length) return null;
  return insiders.reduce((m, x) => (x.value > m ? x.value : m), 0);
}

function dedupeByType(signals: DetectedSignal[]): DetectedSignal[] {
  const map = new Map<string, DetectedSignal>();
  for (const s of signals) {
    const prev = map.get(s.signal_type);
    if (!prev || s.score > prev.score) map.set(s.signal_type, s);
  }
  return Array.from(map.values());
}

function formatUsd(v: number): string {
  if (!Number.isFinite(v)) return '$0';
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function formatRatio(r: number): string {
  if (!Number.isFinite(r)) return '×0';
  return `×${r.toFixed(1)}`;
}

function formatPct(r: number): string {
  if (!Number.isFinite(r)) return '0%';
  return `${(r * 100).toFixed(0)}%`;
}
