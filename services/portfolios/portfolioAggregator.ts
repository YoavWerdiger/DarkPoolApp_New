/**
 * portfolioAggregator.ts
 * --------------------------------------------------------------------------
 * Orchestration layer:
 *   טרנזקציות מ-Supabase → FIFO → מחירים שוטפים → Holdings/Summary/Distribution
 *
 * זוהי שכבת הביניים שמאפשרת לרינדר UI מסך-תיק לקבל פלט מוכן לשימוש
 * מבלי שיצטרך להכיר ב-Supabase, Finnhub, או חישובי FIFO.
 *
 * רץ ב-React Native (client-side) כדי להפחית עומס על Edge Functions.
 */

import {
  listTransactions,
  getHoldingsRaw,
  getCashFlowSummary,
} from './portfolioService';
import {
  getQuotes,
  getHistoricalPrices,
} from './portfolioPriceFeed';
import {
  calculateFifoPosition,
  buildPortfolioCashFlows,
  computeWinRatePct,
  xirr,
} from './portfolioCalc';
import type {
  PortfolioHolding,
  PortfolioSummary,
  PortfolioTransaction,
  DistributionSlice,
  DistributionGroupBy,
} from '../../screens/Portfolios/portfolioTypes';
import {
  ASSET_TYPE_LABELS,
  DISTRIBUTION_PALETTE,
  SECTOR_LABELS,
  SYMBOL_SECTOR_MAP,
} from '../../screens/Portfolios/portfolioConstants';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * מסיק סקטור מה-symbol וה-asset_type.
 *
 * סדר עדיפויות:
 *  1. סוג נכס שאינו מניה (crypto/etf/fund/forex) → סקטור ישיר
 *  2. מניה ישראלית (suffix .TA) → 'israel'
 *  3. symbol בטבלת SYMBOL_SECTOR_MAP → הסקטור המוגדר
 *  4. סמלי קריפטו ידועים (suffix -USD / -USDT) → 'crypto'
 *  5. ברירת מחדל → 'other'
 */
function inferSector(symbol: string, assetType: string | null): string {
  if (assetType === 'crypto') return 'crypto';
  if (assetType === 'etf') return 'etf';
  if (assetType === 'fund') return 'fund';
  if (assetType === 'forex') return 'forex';

  const upper = symbol.toUpperCase();

  // מניה ישראלית
  if (upper.endsWith('.TA')) return 'israel';

  // lookup טבלה סטטית
  const mapped = SYMBOL_SECTOR_MAP.get(upper);
  if (mapped) return mapped;

  // קריפטו לפי suffix נפוץ
  if (upper.endsWith('-USD') || upper.endsWith('-USDT') || upper.endsWith('USD')) {
    return 'crypto';
  }

  return 'other';
}

function getDaysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return null;
  return (Date.now() - t) / DAY_MS;
}

/**
 * חישוב פוזיציות + מחירים שוטפים → Holdings מלאים.
 */
export async function loadPortfolioHoldings(
  portfolioId: string
): Promise<PortfolioHolding[]> {
  const [transactions, holdingsRaw] = await Promise.all([
    listTransactions(portfolioId, { limit: 5000 }),
    getHoldingsRaw(portfolioId),
  ]);

  const symbols = holdingsRaw.map((h) => h.symbol);
  const quotes = await getQuotes(symbols);

  // קיבוץ tx לפי symbol עבור FIFO
  const txBySymbol = new Map<string, PortfolioTransaction[]>();
  // מיפוי symbol → מטבע (לפי הטרנזקציה האחרונה מסוג buy)
  const symbolCurrencyMap = new Map<string, string>();
  for (const tx of transactions) {
    if (!tx.symbol) continue;
    const arr = txBySymbol.get(tx.symbol) ?? [];
    arr.push(tx);
    txBySymbol.set(tx.symbol, arr);
    if (tx.type === 'buy' && tx.currency) {
      symbolCurrencyMap.set(tx.symbol, tx.currency);
    }
  }

  let totalValue = 0;
  const tempHoldings: PortfolioHolding[] = [];

  for (const raw of holdingsRaw) {
    const txs = txBySymbol.get(raw.symbol) ?? [];
    const fifoTxs = txs
      .filter((t) => t.type === 'buy' || t.type === 'sell')
      .map((t) => ({
        type: t.type as 'buy' | 'sell',
        date: t.date,
        quantity: Number(t.quantity ?? 0),
        price: Number(t.price ?? 0),
        commission: Number(t.commission ?? 0),
      }));
    const fifo = calculateFifoPosition(fifoTxs);

    const quote = quotes.get(raw.symbol);
    const lastPrice = quote?.price ?? 0;
    const previousClose = quote?.previous_close ?? null;

    const value = fifo.open_quantity * lastPrice;
    const unrealizedGain = value - fifo.invested;
    const unrealizedGainPct =
      fifo.invested > 0 ? (unrealizedGain / fifo.invested) * 100 : 0;

    const dailyGain =
      previousClose != null
        ? fifo.open_quantity * (lastPrice - previousClose)
        : 0;
    const dailyGainPct =
      previousClose && previousClose > 0
        ? ((lastPrice - previousClose) / previousClose) * 100
        : 0;

    const totalDividends = Number(raw.total_dividends ?? 0);
    const realizedGain = fifo.realized_gain + totalDividends;
    const totalGain = unrealizedGain + realizedGain;
    const totalInvestedHistorical =
      Number(raw.total_invested ?? 0); // כולל קניות סגורות
    const totalGainPct =
      totalInvestedHistorical > 0
        ? (totalGain / totalInvestedHistorical) * 100
        : 0;

    // annualized yield – XIRR per-symbol
    const symbolFlows = buildPortfolioCashFlows(
      txs.map((t) => ({
        type: t.type as
          | 'buy'
          | 'sell'
          | 'deposit'
          | 'withdrawal'
          | 'fee'
          | 'dividend',
        date: t.date,
        quantity: t.quantity != null ? Number(t.quantity) : undefined,
        price: t.price != null ? Number(t.price) : undefined,
        commission:
          t.commission != null ? Number(t.commission) : undefined,
        amount: t.amount != null ? Number(t.amount) : undefined,
      })),
      value,
      new Date().toISOString()
    );
    const irr = xirr(symbolFlows);
    const annualizedYield = irr != null ? irr * 100 : 0;

    if (fifo.open_quantity > 0) totalValue += value;

    const holdingAssetType = (raw.asset_type as PortfolioHolding['asset_type']) ?? null;
    const holdingCurrency = symbolCurrencyMap.get(raw.symbol) ?? 'USD';
    const holdingSector = inferSector(raw.symbol, holdingAssetType);

    tempHoldings.push({
      symbol: raw.symbol,
      asset_type: holdingAssetType,
      exchange: raw.exchange,
      currency: holdingCurrency,
      sector: holdingSector,
      quantity: fifo.open_quantity,
      avg_price: fifo.avg_price,
      invested: fifo.invested,
      last_price: lastPrice,
      previous_close: previousClose,
      value,
      unrealized_gain: unrealizedGain,
      unrealized_gain_pct: unrealizedGainPct,
      daily_gain: dailyGain,
      daily_gain_pct: dailyGainPct,
      realized_gain: realizedGain,
      total_gain: totalGain,
      total_gain_pct: totalGainPct,
      total_dividends: totalDividends,
      annualized_yield: annualizedYield,
      allocation: 0,
      is_closed: fifo.is_closed,
    });
  }

  // חישוב allocation (% מתוך סך value של פוזיציות פתוחות)
  return tempHoldings.map((h) => ({
    ...h,
    allocation: totalValue > 0 && !h.is_closed ? (h.value / totalValue) * 100 : 0,
  }));
}

/**
 * סיכום ראשי של תיק - Header summary
 */
export async function loadPortfolioSummary(
  portfolioId: string,
  currency: string
): Promise<PortfolioSummary> {
  const [holdings, transactions, cashFlow] = await Promise.all([
    loadPortfolioHoldings(portfolioId),
    listTransactions(portfolioId, { limit: 5000 }),
    getCashFlowSummary(portfolioId),
  ]);

  const open = holdings.filter((h) => !h.is_closed);

  const value = open.reduce((s, h) => s + h.value, 0);
  const invested = open.reduce((s, h) => s + h.invested, 0);
  const unrealizedGain = open.reduce((s, h) => s + h.unrealized_gain, 0);
  const realizedGain = holdings.reduce((s, h) => s + h.realized_gain, 0);
  const totalGain = unrealizedGain + realizedGain;
  const dailyGain = open.reduce((s, h) => s + h.daily_gain, 0);

  const totalDeposits = Number(cashFlow?.total_deposits ?? 0);
  const totalWithdrawals = Number(cashFlow?.total_withdrawals ?? 0);
  const totalFees = Number(cashFlow?.total_fees ?? 0);
  const totalBuys = Number(cashFlow?.total_buys ?? 0);
  const totalSells = Number(cashFlow?.total_sells ?? 0);
  const totalDividends = Number(cashFlow?.total_dividends ?? 0);

  const cash =
    totalDeposits -
    totalWithdrawals -
    totalFees -
    totalBuys +
    totalSells +
    totalDividends;

  const totalValue = cash + value;

  // Daily gain % - יחסית לאתמול (totalValue - dailyGain)
  const yesterdayValue = totalValue - dailyGain;
  const dailyGainPct =
    yesterdayValue > 0 ? (dailyGain / yesterdayValue) * 100 : 0;

  // Total gain % – יחסית להפקדות נטו
  const netDeposits = totalDeposits - totalWithdrawals;
  const totalGainPct = netDeposits > 0 ? (totalGain / netDeposits) * 100 : 0;

  // Annualized yield – XIRR ברמת התיק
  const portfolioFlows = buildPortfolioCashFlows(
    transactions.map((t) => ({
      type: t.type as
        | 'buy'
        | 'sell'
        | 'deposit'
        | 'withdrawal'
        | 'fee'
        | 'dividend',
      date: t.date,
      quantity: t.quantity != null ? Number(t.quantity) : undefined,
      price: t.price != null ? Number(t.price) : undefined,
      commission: t.commission != null ? Number(t.commission) : undefined,
      amount: t.amount != null ? Number(t.amount) : undefined,
    })),
    totalValue,
    new Date().toISOString()
  );
  const irr = xirr(portfolioFlows);
  const annualizedYield = irr != null ? irr * 100 : 0;
  const win_rate_pct = computeWinRatePct(open);

  return {
    portfolio_id: portfolioId,
    currency,
    cash,
    invested,
    value,
    total_value: totalValue,
    unrealized_gain: unrealizedGain,
    realized_gain: realizedGain,
    total_gain: totalGain,
    total_gain_pct: totalGainPct,
    daily_gain: dailyGain,
    daily_gain_pct: dailyGainPct,
    annualized_yield: annualizedYield,
    win_rate_pct,
    total_deposits: totalDeposits,
    total_withdrawals: totalWithdrawals,
    total_fees: totalFees,
    total_dividends: totalDividends,
    holdings_count: open.length,
  };
}

/**
 * Distribution slices – משמש בגרף Donut/Pie ב-Overview
 */
export function buildDistribution(
  holdings: PortfolioHolding[],
  groupBy: DistributionGroupBy
): DistributionSlice[] {
  const open = holdings.filter((h) => !h.is_closed);
  const total = open.reduce((s, h) => s + h.value, 0);
  if (total <= 0) return [];

  const groups = new Map<string, { value: number; label: string }>();
  for (const h of open) {
    let key: string;
    let label: string;
    switch (groupBy) {
      case 'symbol':
        key = h.symbol;
        label = h.symbol;
        break;
      case 'asset_type':
        key = h.asset_type ?? 'unknown';
        label = h.asset_type
          ? (ASSET_TYPE_LABELS[h.asset_type] ?? h.asset_type)
          : 'לא ידוע';
        break;
      case 'currency':
        key = h.currency || 'USD';
        label = h.currency || 'USD';
        break;
      case 'sector':
      default: {
        const sec = h.sector ?? 'other';
        key = sec;
        label = SECTOR_LABELS[sec] ?? sec;
      }
    }
    const prev = groups.get(key) ?? { value: 0, label };
    prev.value += h.value;
    groups.set(key, prev);
  }

  const arr = Array.from(groups.entries())
    .map(([key, g]) => ({
      key,
      label: g.label,
      value: g.value,
      percentage: (g.value / total) * 100,
    }))
    .sort((a, b) => b.value - a.value);

  return arr.map((s, i) => ({
    ...s,
    color: DISTRIBUTION_PALETTE[i % DISTRIBUTION_PALETTE.length],
  }));
}

/**
 * Daily gainers/losers – Top 5 בכל קבוצה לפי השפעה דולרית על התיק
 * (daily_gain = qty × Δprice), לא לפי % המניה.
 */
export function getDailyGainersLosers(holdings: PortfolioHolding[]) {
  const open = holdings.filter((h) => !h.is_closed);
  const positive = open.filter((h) => h.daily_gain > 0);
  const negative = open.filter((h) => h.daily_gain < 0);
  const gainers = [...positive]
    .sort((a, b) => b.daily_gain - a.daily_gain)
    .slice(0, 5);
  const losers = [...negative]
    .sort((a, b) => a.daily_gain - b.daily_gain)
    .slice(0, 5);
  return { gainers, losers };
}

/**
 * חישוב גרף ביצועי תיק יחסית ל-benchmark
 */
export async function loadPerformanceVsBenchmark(
  portfolioId: string,
  benchmarkSymbol: string,
  days = 365
) {
  const benchmark = await getHistoricalPrices(
    benchmarkSymbol,
    days <= 30 ? '1mo' : days <= 90 ? '3mo' : days <= 365 ? '1y' : '5y'
  );
  return { benchmark };
}

/** עזר: XIRR קוסר ב-callers - ייתכן ולא נחוץ */
export const __utils = { getDaysSince };
