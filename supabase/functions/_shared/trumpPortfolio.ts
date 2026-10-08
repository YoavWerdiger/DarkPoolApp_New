/**
 * מנוע תיק טראמפ — Quiver trumpstocktrades (סכום $ מדויק, לא STOCK Act).
 * Mark-to-market: נומינל FIFO × יחס close Yahoo.
 */

import {
  computeAvgDelay,
  type CongressTradeInput,
  type CongressPortfolioMetrics,
  type PortfolioHoldingMetric,
  type ValuePoint,
  isChartSeriesReliable,
  parseTxnSide,
  priceOnOrBefore,
  sanitizePeriodReturnPct,
  sparsifyValueSeries,
  twrPeriodReturnPct,
} from './congressPortfolio.ts';
import { parseQuiverUsd, TRUMP_DARKPOOL_PERSON_ID } from './quiverQuant.ts';

export { TRUMP_DARKPOOL_PERSON_ID };

export interface TrumpTradeInput {
  ticker: string;
  transaction_date: string;
  side: 'buy' | 'sell';
  /** אמצע הטווח (או הסכום המדויק) — לגרף ולמשקלים */
  amountUsd: number;
  /** גבולות הטווח המדווח — לשווי משוער low–high */
  amountLow: number;
  amountHigh: number;
  price?: number | null;
}

/** «$1,001 - $15,000» → [1001, 15000]; «Over $50,000,000» → [50M, 50M]; סכום בודד → [x, x] */
export function parseUsdRangeBounds(raw: string | null | undefined): { low: number; high: number } | null {
  if (!raw?.trim()) return null;
  const nums = (raw.replace(/,/g, '').match(/\d+(?:\.\d+)?/g) ?? [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;
  const low = Math.min(...nums);
  const high = Math.max(...nums);
  return { low, high };
}

/**
 * Quiver ו-UW מחזירים את אותה עסקה פעמיים (770 כפילויות נמדדו) — עסקה אחת לכל
 * טיקר+תאריך+כיוון+טווח; Quiver קודם.
 */
export function dedupeTrumpInputs(rows: Array<CongressTradeInput & { source?: string | null }>): CongressTradeInput[] {
  const byKey = new Map<string, CongressTradeInput & { source?: string | null }>();
  for (const r of rows) {
    const key = [
      String(r.ticker ?? '').toUpperCase().trim(),
      String(r.transaction_date ?? '').slice(0, 10),
      String(r.txn_type ?? '').toLowerCase(),
      String(r.amounts ?? '').replace(/\s+/g, ''),
    ].join('|');
    const prev = byKey.get(key);
    if (!prev || (String(prev.source ?? '') !== 'quiverquant' && String(r.source ?? '') === 'quiverquant')) {
      byKey.set(key, r);
    }
  }
  return [...byKey.values()];
}

interface TrumpLot {
  date: string;
  notional: number;
  entryPrice: number | null;
}

const RANGE_RE = /[\d.]+\s*[-–—]|to\s*[\d.$]/i;


function isTrumpStockActRangeLabel(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  if (parseExactUsdAmount(raw) != null) return false;
  return RANGE_RE.test(raw.replace(/,/g, ''));
}

/** סכום דולרי מדויק בלבד — לא טווח STOCK Act. */
export function parseExactUsdAmount(
  raw: string | number | null | undefined
): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }
  const text = raw.trim();
  if (!text) return null;
  if (RANGE_RE.test(text.replace(/,/g, ''))) return null;
  if (/over|above|\+/i.test(text)) return null;
  const n = parseQuiverUsd(text);
  return n != null && n > 0 ? n : null;
}

export function trumpTradesFromCongressInputs(
  rows: CongressTradeInput[]
): TrumpTradeInput[] {
  const out: TrumpTradeInput[] = [];
  for (const row of rows) {
    const ticker = String(row.ticker ?? '')
      .toUpperCase()
      .trim();
    const txn = String(row.txn_type ?? '').toLowerCase();
    const side: 'buy' | 'sell' | null =
      txn === 'sell' || txn.includes('sell')
        ? 'sell'
        : txn === 'buy' || txn.includes('buy')
          ? 'buy'
          : parseTxnSide(txn);
    const day = String(row.transaction_date ?? '').slice(0, 10);
    if (!ticker || !side || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;

    const fromLabel = parseExactUsdAmount(row.amounts ?? null);
    const shares = row.shares;
    const price = row.disclosed_price;
    const fromPx =
      shares != null &&
      price != null &&
      Number.isFinite(shares) &&
      Number.isFinite(price) &&
      shares > 0 &&
      price > 0
        ? shares * price
        : null;
    // סכום מדויק אם יש; אחרת טווח STOCK Act → low/high, ואמצע לגרף ולמשקלים
    // (במקום «משקל שווה» של $1 לעסקה — שנתן «שווי» של 120 ותשואה של אלפי אחוזים)
    let amountLow: number | null = null;
    let amountHigh: number | null = null;
    let amountUsd = fromLabel ?? fromPx;
    if (amountUsd != null) {
      amountLow = amountUsd;
      amountHigh = amountUsd;
    } else {
      // טווח («$1,001 - $15,000») או רצפה («Over $50,000,000») — כל מה שיש בו מספרים
      const b = parseUsdRangeBounds(row.amounts ?? null);
      if (b) {
        amountLow = b.low;
        amountHigh = b.high;
        amountUsd = (b.low + b.high) / 2;
      }
    }
    if (amountUsd == null || !(amountUsd > 0) || amountLow == null || amountHigh == null) continue;

    const entryPrice =
      price != null && Number.isFinite(price) && price > 0 ? price : null;
    out.push({
      ticker,
      transaction_date: day,
      side,
      amountUsd,
      amountLow,
      amountHigh,
      price: entryPrice,
    });
  }
  return out.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
}

function applyTrumpTrade(lots: TrumpLot[], t: TrumpTradeInput): TrumpLot[] {
  if (t.side === 'buy') {
    return [
      ...lots,
      {
        date: t.transaction_date,
        notional: t.amountUsd,
        entryPrice: t.price != null && t.price > 0 ? t.price : null,
      },
    ];
  }
  let remain = t.amountUsd;
  const next: TrumpLot[] = [];
  for (const lot of lots) {
    if (remain <= 0) {
      next.push(lot);
      continue;
    }
    if (lot.notional <= remain) {
      remain -= lot.notional;
    } else {
      next.push({ ...lot, notional: lot.notional - remain });
      remain = 0;
    }
  }
  return next;
}

function closeOnOrBeforeMap(
  priceMap: Map<string, number> | undefined,
  date: string
): number | null {
  if (!priceMap?.size) return null;
  return priceOnOrBefore(priceMap, date);
}

function lotMarketValue(
  lot: TrumpLot,
  live: number | null,
  priceMap: Map<string, number> | undefined
): number {
  if (live != null && live > 0 && lot.entryPrice != null && lot.entryPrice > 0) {
    return lot.notional * (live / lot.entryPrice);
  }
  const entryClose = closeOnOrBeforeMap(priceMap, lot.date);
  if (live != null && live > 0 && entryClose != null && entryClose > 0) {
    return lot.notional * (live / entryClose);
  }
  return lot.notional;
}

function unionTradingDates(
  pricesByTicker: Map<string, Map<string, number>>,
  start?: string,
  end?: string
): string[] {
  const dates = new Set<string>();
  for (const map of pricesByTicker.values()) {
    for (const day of map.keys()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      if (start && day < start) continue;
      if (end && day > end) continue;
      dates.add(day);
    }
  }
  return [...dates].sort();
}

function buildTrumpFullSeries(
  trades: TrumpTradeInput[],
  pricesByTicker: Map<string, Map<string, number>>
): ValuePoint[] {
  if (!trades.length) return [];

  const sorted = [...trades].sort((a, b) =>
    a.transaction_date.localeCompare(b.transaction_date)
  );

  let lastPriceDate: string | null = null;
  for (const map of pricesByTicker.values()) {
    for (const day of map.keys()) {
      if (lastPriceDate == null || day > lastPriceDate) lastPriceDate = day;
    }
  }

  const start = sorted[0].transaction_date;
  const endTrade = sorted[sorted.length - 1].transaction_date;
  const end =
    lastPriceDate != null && lastPriceDate > endTrade ? lastPriceDate : endTrade;
  const days = unionTradingDates(pricesByTicker, start, end);
  if (days.length < 2) return [];

  const pos = new Map<string, TrumpLot[]>();
  const lastClose = new Map<string, number>();
  const flowByDay = new Map<string, number>();
  let tradeIdx = 0;
  const out: ValuePoint[] = [];

  for (const date of days) {
    while (tradeIdx < sorted.length && sorted[tradeIdx].transaction_date <= date) {
      const t = sorted[tradeIdx];
      tradeIdx += 1;
      const prevLots = pos.get(t.ticker) ?? [];
      const before = prevLots.reduce((s, l) => s + l.notional, 0);
      const afterLots = applyTrumpTrade(prevLots, t);
      const after = afterLots.reduce((s, l) => s + l.notional, 0);
      pos.set(t.ticker, afterLots);
      const flow = after - before;
      if (flow !== 0) {
        flowByDay.set(date, (flowByDay.get(date) ?? 0) + flow);
      }
    }
    for (const [ticker, map] of pricesByTicker) {
      const px = map.get(date);
      if (px != null && px > 0) lastClose.set(ticker.toUpperCase(), px);
    }

    let value = 0;
    for (const [ticker, lots] of pos) {
      const sym = ticker.toUpperCase();
      const map = pricesByTicker.get(sym);
      const live =
        map?.get(date) ??
        (lastClose.get(sym) != null && lastClose.get(sym)! > 0
          ? lastClose.get(sym)!
          : null);
      for (const lot of lots) {
        value += lotMarketValue(lot, live, map);
      }
    }
    if (value <= 0) continue;
    const dayFlow = flowByDay.get(date) ?? 0;
    out.push({
      date,
      value,
      ...(dayFlow !== 0 ? { external_flow: dayFlow } : {}),
    });
  }

  return out;
}

function periodReturn(series: ValuePoint[], days: number): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const startIdx = series.findIndex((p) => p.date >= cutoffIso);
  if (startIdx < 0) return null;
  return twrPeriodReturnPct(series.slice(startIdx));
}

function ytdReturn(series: ValuePoint[]): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const yearStart = `${last.date.slice(0, 4)}-01-01`;
  const startIdx = series.findIndex((p) => p.date >= yearStart);
  if (startIdx < 0) return null;
  return twrPeriodReturnPct(series.slice(startIdx));
}

function buildTrumpHoldingsMetrics(
  trades: TrumpTradeInput[],
  pricesByTicker: Map<string, Map<string, number>>
): PortfolioHoldingMetric[] {
  const pos = new Map<string, TrumpLot[]>();
  for (const t of trades) {
    pos.set(t.ticker, applyTrumpTrade(pos.get(t.ticker) ?? [], t));
  }

  const rows: PortfolioHoldingMetric[] = [];
  let totalValue = 0;
  let totalCost = 0;

  for (const [ticker, lots] of pos) {
    const sym = ticker.toUpperCase();
    const remaining = lots.reduce((s, l) => s + l.notional, 0);
    if (!(remaining > 0)) continue;
    const map = pricesByTicker.get(sym);
    const lastDate = map ? Array.from(map.keys()).sort().pop() : undefined;
    const live =
      (lastDate && map?.get(lastDate)) ||
      closeOnOrBeforeMap(map, new Date().toISOString().slice(0, 10)) ||
      0;

    let market = 0;
    let firstDate: string | null = null;
    let weightedEntry = 0;
    for (const lot of lots) {
      market += lotMarketValue(lot, live > 0 ? live : null, map);
      if (!firstDate || lot.date < firstDate) firstDate = lot.date;
      const entryPx =
        lot.entryPrice != null && lot.entryPrice > 0
          ? lot.entryPrice
          : closeOnOrBeforeMap(map, lot.date);
      if (entryPx != null && entryPx > 0) weightedEntry += lot.notional * entryPx;
    }

    totalValue += market;
    totalCost += remaining;
    const avgEntry =
      remaining > 0 && weightedEntry > 0 ? weightedEntry / remaining : null;
    const returnPct =
      live > 0 && avgEntry != null && avgEntry > 0
        ? Math.round(((live - avgEntry) / avgEntry) * 10000) / 100
        : 0;

    rows.push({
      ticker: sym,
      qty: 0,
      cost_usd: Math.round(remaining * 100) / 100,
      current_price: live > 0 ? live : 0,
      market_value: Math.round(market * 100) / 100,
      allocation_pct: 0,
      return_pct: returnPct,
      first_added_date: firstDate,
      basis_reliable: true,
      qty_disclosed: false,
      entry_price:
        avgEntry != null ? Math.round(avgEntry * 10000) / 10000 : null,
    });
  }

  rows.sort((a, b) => b.market_value - a.market_value);
  for (const h of rows) {
    h.allocation_pct =
      totalValue > 0 ? Math.round((h.market_value / totalValue) * 1000) / 10 : 0;
  }

  return rows;
}

/**
 * metrics ל-snapshot / bootstrap — לא parseCongressAmount / STOCK Act.
 */
export function metricsFromTrumpCongressInputs(
  inputs: CongressTradeInput[],
  pricesByTicker: Map<string, Map<string, number>>
): CongressPortfolioMetrics | null {
  const trades = trumpTradesFromCongressInputs(inputs);
  if (!trades.length) return null;

  const fullSeries = buildTrumpFullSeries(trades, pricesByTicker);
  const series = sparsifyValueSeries(fullSeries, 7);
  const holdings = buildTrumpHoldingsMetrics(trades, pricesByTicker);
  // שווי משוער: אותו ספר FIFO עם הגבול התחתון ועם העליון של כל טווח
  const sumMarket = (rows: PortfolioHoldingMetric[]) => rows.reduce((s, h) => s + (h.market_value || 0), 0);
  const valueLow = sumMarket(
    buildTrumpHoldingsMetrics(trades.map((t) => ({ ...t, amountUsd: t.amountLow })), pricesByTicker),
  );
  const valueHigh = sumMarket(
    buildTrumpHoldingsMetrics(trades.map((t) => ({ ...t, amountUsd: t.amountHigh })), pricesByTicker),
  );

  let totalValue = 0;
  let totalCost = 0;
  for (const h of holdings) {
    totalValue += h.market_value;
    totalCost += h.cost_usd;
  }
  if (!(totalValue > 0) && fullSeries.length) {
    totalValue = fullSeries[fullSeries.length - 1].value;
  }

  const totalReturnUsd = totalValue - totalCost;
  const rawTotalReturnPct =
    totalCost > 0 ? (totalReturnUsd / totalCost) * 100 : 0;
  const totalReturnPct = sanitizePeriodReturnPct(rawTotalReturnPct) ?? 0;
  const allReturn = twrPeriodReturnPct(fullSeries);

  const chartReliable =
    fullSeries.length >= 2 ||
    isChartSeriesReliable(series, trades.length);

  return {
    portfolio_value: Math.round(totalValue * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
    total_return_usd: Math.round(totalReturnUsd * 100) / 100,
    total_return_pct: totalReturnPct,
    series,
    chart_reliable: chartReliable,
    holdings,
    period_returns: {
      '1D': periodReturn(fullSeries, 1),
      '1W': periodReturn(fullSeries, 7),
      '1M': periodReturn(fullSeries, 30),
      '3M': periodReturn(fullSeries, 90),
      YTD: ytdReturn(fullSeries),
      '1Y': periodReturn(fullSeries, 365),
      '5Y': periodReturn(fullSeries, 365 * 5),
      ALL: allReturn,
    },
    win_rate: null,
    avg_delay_days: computeAvgDelay(inputs),
    trade_count: trades.length,
    value_range: {
      low: Math.round(valueLow),
      high: Math.round(valueHigh),
      estimated: true,
    },
  };
}
