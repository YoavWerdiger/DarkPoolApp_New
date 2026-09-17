/**
 * profilePortfolioEngine.ts
 * -----------------------------------------------------------------------------
 * אלגוריתם שחזור תיק לפרופיל משקיע/פוליטיקאי.
 *
 * Pipeline:
 *   1. normalizeTrades     — עסקאות STIR/Form4 → buy/sell + $ + qty
 *   2. replayPositions     — avg-cost, ללא FIFO (positions-only)
 *   3. buildDailySeries    — שווי תיק יומי לפי מחירי Yahoo
 *   4. buildHoldings       — פוזיציות פתוחות + allocation
 *   5. computeRiskMetrics  — Sharpe, Sortino, volatility, max drawdown
 *   6. computeConcentration — HHI + top-3 weight
 *   7. computeProfileScore — ציון 0–100 (נפרד מ-dark pool signal scoring)
 *
 * מודל: positions-only — אין cash flows מדויקים (כמו Insider Wave / STIR).
 */

import {
  computePortfolioAnalytics,
  sortinoRatio,
} from '../portfolios/portfolioCalc';
import type {
  PortfolioHoldingMetric,
  PortfolioValuePoint,
  ProfilePortfolioRiskMetrics,
  ProfilePortfolioScore,
  ReconstructedPortfolioMetrics,
} from './portfolioMetricsTypes';

export interface ProfileTradeInput {
  date: string;
  ticker: string;
  side: 'buy' | 'sell';
  /** שווי עסקה ב-USD */
  amountUsd: number;
  price: number;
  qty: number;
  /** true כש־qty הוערך מטווח $ (לא מניות מדווחות) */
  qtyEstimated?: boolean;
  /** false כשאין מחיר/שווי מדווח (Form4 בלי מחיר → Yahoo@first_added) */
  priceDisclosed?: boolean;
}

export interface ProfilePortfolioBuildInput {
  trades: ProfileTradeInput[];
  /** ticker → date → close */
  pricesByTicker: Map<string, Map<string, number>>;
  winRate?: number | null;
  avgDelayDays?: number | null;
  riskFreeRate?: number;
}

const DEFAULT_RF = 0.04;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function priceOnOrBefore(priceMap: Map<string, number>, date: string): number | null {
  const d = date.slice(0, 10);
  if (priceMap.has(d)) return priceMap.get(d)!;
  let best: string | null = null;
  for (const k of priceMap.keys()) {
    if (k <= d && (!best || k > best)) best = k;
  }
  return best ? priceMap.get(best)! : null;
}

export type ProfilePositionState = {
  qty: number;
  cost: number;
  /** תאריך פתיחת הפוזיציה הנוכחית (קנייה ראשונה אחרי אפס) */
  first_added_date: string | null;
  /** false אם אין מחיר מדווח (טווח $ / Form4 בלי מחיר) */
  basisReliable: boolean;
  /** false אם qty מטווח $ מוערך */
  qtyDisclosed: boolean;
};

/** שלב 2 — replay avg-cost positions */
export function replayProfilePositions(
  trades: ProfileTradeInput[]
): Map<string, ProfilePositionState> {
  const pos = new Map<string, ProfilePositionState>();
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));

  for (const t of sorted) {
    const cur = pos.get(t.ticker) ?? {
      qty: 0,
      cost: 0,
      first_added_date: null,
      basisReliable: true,
      qtyDisclosed: true,
    };
    const day = t.date.slice(0, 10);
    const priceDisclosed = t.priceDisclosed !== false && !t.qtyEstimated;
    if (t.side === 'buy') {
      if (cur.qty <= 0) {
        cur.first_added_date = day;
        cur.basisReliable = !t.qtyEstimated && priceDisclosed;
        cur.qtyDisclosed = !t.qtyEstimated;
      } else {
        if (t.qtyEstimated || !priceDisclosed) cur.basisReliable = false;
        if (t.qtyEstimated) cur.qtyDisclosed = false;
      }
      cur.qty += t.qty;
      cur.cost += t.amountUsd;
    } else if (cur.qty > 0) {
      const sellQty = Math.min(cur.qty, t.qty);
      const avg = cur.cost / cur.qty;
      cur.qty -= sellQty;
      cur.cost -= avg * sellQty;
      if (cur.qty < 1e-8) {
        cur.qty = 0;
        cur.cost = 0;
        cur.first_added_date = null;
        cur.basisReliable = true;
        cur.qtyDisclosed = true;
      }
    }
    pos.set(t.ticker, cur);
  }
  return pos;
}

/** ממלא מחירים יומיים (forward-fill) */
function forwardFillDailyPrices(
  raw: Map<string, number>,
  startDate: string,
  endDate: string
): Map<string, number> {
  const out = new Map<string, number>();
  let last: number | null = null;
  const d = new Date(`${startDate.slice(0, 10)}T12:00:00Z`);
  const end = new Date(`${endDate.slice(0, 10)}T12:00:00Z`);
  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    if (raw.has(key)) last = raw.get(key)!;
    if (last != null) out.set(key, last);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function mergeTradePricesIntoMap(
  ticker: string,
  txs: ProfileTradeInput[],
  priceMap: Map<string, number>
): Map<string, number> {
  const merged = new Map(priceMap);
  for (const t of txs) {
    if (t.ticker !== ticker || t.price <= 0) continue;
    merged.set(t.date.slice(0, 10), t.price);
  }
  return merged;
}

function prepareFilledPricesByTicker(
  trades: ProfileTradeInput[],
  pricesByTicker: Map<string, Map<string, number>>
): Map<string, Map<string, number>> {
  if (!trades.length) return new Map();
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sorted[0].date.slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);
  const tickers = Array.from(new Set(sorted.map((t) => t.ticker)));
  const out = new Map<string, Map<string, number>>();
  for (const sym of tickers) {
    const raw = pricesByTicker.get(sym) ?? new Map();
    const withTrades = mergeTradePricesIntoMap(sym, sorted, raw);
    out.set(sym, forwardFillDailyPrices(withTrades, startDate, endDate));
  }
  return out;
}

/** שלב 3 — סדרת שווי יומית */
export function buildProfileValueSeries(
  trades: ProfileTradeInput[],
  pricesByTicker: Map<string, Map<string, number>>
): PortfolioValuePoint[] {
  if (!trades.length) return [];

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sorted[0].date.slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);
  const filledPrices = prepareFilledPricesByTicker(sorted, pricesByTicker);

  const dateSet = new Set<string>();
  for (const m of filledPrices.values()) {
    for (const d of m.keys()) {
      if (d >= startDate && d <= endDate) dateSet.add(d);
    }
  }
  const dates = Array.from(dateSet).sort();
  if (dates.length < 2) return [];

  let txIdx = 0;
  const positions = new Map<string, { qty: number; cost: number }>();
  const series: PortfolioValuePoint[] = [];

  for (const day of dates) {
    let dayFlow = 0;
    while (txIdx < sorted.length && sorted[txIdx].date.slice(0, 10) <= day) {
      const t = sorted[txIdx];
      const cur = positions.get(t.ticker) ?? { qty: 0, cost: 0 };
      if (t.side === 'buy') {
        cur.qty += t.qty;
        cur.cost += t.amountUsd;
        dayFlow += t.amountUsd;
      } else if (cur.qty > 0) {
        const sellQty = Math.min(cur.qty, t.qty);
        const avg = cur.cost / cur.qty;
        const sellNotional = sellQty * t.price;
        cur.qty -= sellQty;
        cur.cost -= avg * sellQty;
        dayFlow -= sellNotional > 0 ? sellNotional : avg * sellQty;
        if (cur.qty < 1e-8) {
          cur.qty = 0;
          cur.cost = 0;
        }
      }
      positions.set(t.ticker, cur);
      txIdx++;
    }

    let value = 0;
    let hasPosition = false;
    for (const [sym, p] of positions) {
      if (p.qty <= 0) continue;
      hasPosition = true;
      const px = filledPrices.get(sym)?.get(day);
      if (px != null && px > 0) value += p.qty * px;
    }
    if (hasPosition && value > 0) {
      series.push({
        date: day,
        value,
        ...(dayFlow !== 0 ? { external_flow: dayFlow } : {}),
      });
    }
  }
  return series;
}

/**
 * דילול סדרה יומית — ימי מסחר + דגימה שבועית (מונע עקומה צפופה מזויפת).
 */
export function sparsifyProfileValueSeries(
  series: PortfolioValuePoint[],
  maxGapDays = 7
): PortfolioValuePoint[] {
  if (series.length <= 3) return series;
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const out: PortfolioValuePoint[] = [];
  let lastKept: string | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const isEdge = i === 0 || i === sorted.length - 1;
    const hasFlow = (p.external_flow ?? 0) !== 0;
    const gapDays =
      lastKept != null
        ? (Date.parse(p.date) - Date.parse(lastKept)) / 86400000
        : Infinity;
    if (isEdge || hasFlow || gapDays >= maxGapDays) {
      out.push({ ...p });
      lastKept = p.date;
    }
  }
  return out;
}

export function isProfileChartReliable(
  series: PortfolioValuePoint[],
  tradeCount: number
): boolean {
  if (tradeCount < 3) return false;
  if (series.length < 2) return false;
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const spanDays =
    (Date.parse(sorted[sorted.length - 1].date) - Date.parse(sorted[0].date)) /
    86400000;
  return spanDays >= 21;
}

const MAX_DISPLAYABLE_PERIOD_RETURN_PCT = 250;

function twrPeriodReturnPct(series: PortfolioValuePoint[]): number | null {
  if (series.length < 2) return null;
  const hasFlow = series.some((p) => (p.external_flow ?? 0) !== 0);
  if (hasFlow) {
    let cumulative = 1;
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1].value;
      const curr = series[i].value;
      const flow = series[i].external_flow ?? 0;
      const denom = prev + flow;
      if (denom > 1e-9 && curr >= 0) cumulative *= curr / denom;
    }
    const pct = (cumulative - 1) * 100;
    if (!Number.isFinite(pct) || Math.abs(pct) > MAX_DISPLAYABLE_PERIOD_RETURN_PCT) {
      return null;
    }
    return round2(pct);
  }
  const first = series[0].value;
  const last = series[series.length - 1].value;
  if (!(first > 0)) return null;
  const pct = ((last - first) / first) * 100;
  if (!Number.isFinite(pct) || Math.abs(pct) > MAX_DISPLAYABLE_PERIOD_RETURN_PCT) {
    return null;
  }
  return round2(pct);
}

function periodReturnPct(series: PortfolioValuePoint[], days: number): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const startIdx = series.findIndex((p) => p.date >= cutoffIso);
  if (startIdx < 0) return null;
  return twrPeriodReturnPct(series.slice(startIdx));
}

function ytdReturnPct(series: PortfolioValuePoint[]): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const yearStart = `${last.date.slice(0, 4)}-01-01`;
  const startIdx = series.findIndex((p) => p.date >= yearStart);
  if (startIdx < 0) return null;
  return twrPeriodReturnPct(series.slice(startIdx));
}

/** שלב 4 — holdings snapshot */
export function buildProfileHoldings(
  positions: Map<string, ProfilePositionState | { qty: number; cost: number }>,
  pricesByTicker: Map<string, Map<string, number>>
): PortfolioHoldingMetric[] {
  const holdings: PortfolioHoldingMetric[] = [];
  let totalValue = 0;

  for (const [ticker, p] of positions) {
    if (p.qty <= 0) continue;
    const priceMap = pricesByTicker.get(ticker);
    const lastDate = priceMap ? Array.from(priceMap.keys()).sort().pop() : undefined;
    const currentPrice =
      (lastDate && priceMap?.get(lastDate)) ||
      priceOnOrBefore(priceMap ?? new Map(), new Date().toISOString().slice(0, 10)) ||
      0;
    if (currentPrice <= 0) continue;
    const marketValue = p.qty * currentPrice;
    totalValue += marketValue;
    const firstAdded =
      'first_added_date' in p && typeof p.first_added_date === 'string'
        ? p.first_added_date.slice(0, 10)
        : null;
    const basisReliable =
      'basisReliable' in p ? p.basisReliable !== false : true;
    const qtyDisclosed =
      'qtyDisclosed' in p ? p.qtyDisclosed !== false : basisReliable;
    let entryPrice: number | null = null;
    let returnPct = 0;

    if (basisReliable && p.qty > 0 && p.cost > 0) {
      entryPrice = p.cost / p.qty;
      returnPct = round2(((marketValue - p.cost) / p.cost) * 100);
    } else if (firstAdded) {
      // STOCK Act — מחיר כניסה לתצוגה; בלי return_pct מטעה
      const atEntry = priceOnOrBefore(priceMap ?? new Map(), firstAdded);
      if (atEntry != null && atEntry > 0) {
        entryPrice = atEntry;
        returnPct = 0;
      }
    }

    holdings.push({
      ticker,
      qty: p.qty,
      cost_usd: p.cost,
      current_price: currentPrice,
      market_value: marketValue,
      allocation_pct: 0,
      return_pct: returnPct,
      first_added_date: firstAdded,
      basis_reliable: basisReliable,
      qty_disclosed: qtyDisclosed,
      entry_price: entryPrice != null ? round2(entryPrice) : null,
    });
  }

  holdings.sort((a, b) => b.market_value - a.market_value);
  for (const h of holdings) {
    h.allocation_pct =
      totalValue > 0 ? round2((h.market_value / totalValue) * 100) : 0;
  }
  return holdings;
}

/** שלב 6 — ריכוזיות (HHI 0–1, 1 = מניה בודדת) */
export function computeHoldingsConcentration(holdings: PortfolioHoldingMetric[]): {
  hhi: number;
  top3_pct: number;
  unique_tickers: number;
} {
  if (!holdings.length) {
    return { hhi: 0, top3_pct: 0, unique_tickers: 0 };
  }
  const weights = holdings.map((h) => h.allocation_pct / 100);
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const top3 = holdings.slice(0, 3).reduce((s, h) => s + h.allocation_pct, 0);
  return {
    hhi: round2(hhi),
    top3_pct: round2(top3),
    unique_tickers: holdings.length,
  };
}

/** שלב 5 — מטריקות סיכון מסדרת שווי */
export function computeProfileRiskMetrics(
  series: PortfolioValuePoint[],
  riskFreeRate = DEFAULT_RF
): ProfilePortfolioRiskMetrics {
  const analytics = computePortfolioAnalytics(
    series.map((p) => ({ date: p.date, value: p.value })),
    riskFreeRate
  );

  const returns: number[] = [];
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].value;
    const curr = sorted[i].value;
    if (prev > 0) returns.push((curr - prev) / prev);
  }

  return {
    volatility_pct:
      analytics.volatility != null ? round2(analytics.volatility * 100) : null,
    sharpe: analytics.sharpe != null ? round2(analytics.sharpe) : null,
    sortino:
      returns.length >= 2
        ? sortinoRatio(returns, riskFreeRate) != null
          ? round2(sortinoRatio(returns, riskFreeRate)!)
          : null
        : null,
    max_drawdown_pct:
      analytics.maxDrawdown != null ? round2(analytics.maxDrawdown * 100) : null,
    period_days: analytics.periodDays,
  };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function returnSubScore(totalReturnPct: number): number {
  // logistic around 0% — טוב מ-30% ≈ 85+
  const x = totalReturnPct / 30;
  return clampScore(100 / (1 + Math.exp(-1.2 * (x - 0.5))));
}

function winRateSubScore(winRate: number | null | undefined): number {
  if (winRate == null) return 50;
  return clampScore(winRate);
}

function sharpeSubScore(sharpe: number | null | undefined): number {
  if (sharpe == null) return 50;
  return clampScore(50 + sharpe * 12);
}

function diversificationSubScore(hhi: number): number {
  return clampScore((1 - hhi) * 100);
}

function activitySubScore(tradeCount: number): number {
  if (tradeCount <= 0) return 0;
  if (tradeCount >= 20) return 100;
  return clampScore((tradeCount / 20) * 100);
}

/** שלב 7 — ציון פרופיל 0–100 */
export function computeProfileScore(input: {
  totalReturnPct: number;
  winRate?: number | null;
  sharpe?: number | null;
  hhi: number;
  tradeCount: number;
}): ProfilePortfolioScore {
  const returnScore = returnSubScore(input.totalReturnPct);
  const winScore = winRateSubScore(input.winRate);
  const sharpeScore = sharpeSubScore(input.sharpe);
  const divScore = diversificationSubScore(input.hhi);
  const activityScore = activitySubScore(input.tradeCount);

  const total = clampScore(
    returnScore * 0.3 +
      winScore * 0.25 +
      sharpeScore * 0.2 +
      divScore * 0.15 +
      activityScore * 0.1
  );

  return {
    total,
    components: {
      return: returnScore,
      win_rate: winScore,
      sharpe: sharpeScore,
      diversification: divScore,
      activity: activityScore,
    },
  };
}

/** Pipeline מלא — מעסקאות מנורמלות + מחירים */
export function buildProfilePortfolioMetrics(
  input: ProfilePortfolioBuildInput
): ReconstructedPortfolioMetrics {
  const { trades, pricesByTicker, winRate, avgDelayDays, riskFreeRate = DEFAULT_RF } =
    input;

  const fullSeries = buildProfileValueSeries(trades, pricesByTicker);
  const series = sparsifyProfileValueSeries(fullSeries, 7);
  const chartReliable = isProfileChartReliable(series, trades.length);
  const positions = replayProfilePositions(trades);
  const holdings = buildProfileHoldings(positions, pricesByTicker);

  let totalValue = 0;
  let totalCost = 0;
  for (const h of holdings) {
    totalValue += h.market_value;
    totalCost += h.cost_usd;
  }

  const totalReturnUsd = totalValue - totalCost;
  const rawTotalReturnPct = totalCost > 0 ? (totalReturnUsd / totalCost) * 100 : 0;
  const totalReturnPct =
    Number.isFinite(rawTotalReturnPct) &&
    Math.abs(rawTotalReturnPct) <= MAX_DISPLAYABLE_PERIOD_RETURN_PCT
      ? rawTotalReturnPct
      : 0;
  const allReturn = twrPeriodReturnPct(fullSeries);

  const risk = computeProfileRiskMetrics(fullSeries, riskFreeRate);
  const concentration = computeHoldingsConcentration(holdings);
  const score = computeProfileScore({
    totalReturnPct,
    winRate,
    sharpe: risk.sharpe,
    hhi: concentration.hhi,
    tradeCount: trades.length,
  });

  return {
    portfolio_value: round2(totalValue),
    total_cost: round2(totalCost),
    total_return_usd: round2(totalReturnUsd),
    total_return_pct: round2(totalReturnPct),
    series,
    chart_reliable: chartReliable,
    holdings,
    period_returns: {
      '1D': periodReturnPct(fullSeries, 1),
      '1W': periodReturnPct(fullSeries, 7),
      '1M': periodReturnPct(fullSeries, 30),
      '3M': periodReturnPct(fullSeries, 90),
      YTD: ytdReturnPct(fullSeries),
      '1Y': periodReturnPct(fullSeries, 365),
      '5Y': periodReturnPct(fullSeries, 365 * 5),
      ALL: allReturn,
    },
    win_rate: winRate ?? null,
    avg_delay_days: avgDelayDays ?? null,
    trade_count: trades.length,
    risk,
    concentration,
    score,
  };
}

/** מעשיר metrics קיימים (מ-edge) במטריקות סיכון + ציון */
export function enrichProfilePortfolioMetrics(
  metrics: ReconstructedPortfolioMetrics,
  riskFreeRate = DEFAULT_RF
): ReconstructedPortfolioMetrics {
  if (metrics.risk && metrics.score) return metrics;

  const risk = computeProfileRiskMetrics(metrics.series, riskFreeRate);
  const concentration =
    metrics.concentration ?? computeHoldingsConcentration(metrics.holdings);
  const score =
    metrics.score ??
    computeProfileScore({
      totalReturnPct: metrics.total_return_pct,
      winRate: metrics.win_rate,
      sharpe: risk.sharpe,
      hhi: concentration.hhi,
      tradeCount: metrics.trade_count,
    });

  return { ...metrics, risk, concentration, score };
}
