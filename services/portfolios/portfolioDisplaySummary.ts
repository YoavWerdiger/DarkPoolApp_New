/**
 * סיכום תיק להצגה ב-UI.
 * Colmex: equity/cash/PnL מ-broker + trades + cashflow.
 * ידני: available_cash + פוזיציות OPEN מ-trades (+ fallback ל-TX הישן אם אין trades).
 */

import { getBrokerPortfolioSummary } from '../brokers/brokerService';
import { loadPortfolioSummary } from './portfolioAggregator';
import { loadTrades } from './portfolioTradeDerive';
import { getCashFlowSummary } from './portfolioService';
import { getQuotes } from './portfolioPriceFeed';
import type { Portfolio, PortfolioSummary, Trade } from '../../screens/Portfolios/portfolioTypes';

export async function loadPortfolioDisplaySummary(
  portfolio: Pick<Portfolio, 'id' | 'currency' | 'source' | 'available_cash'>
): Promise<PortfolioSummary> {
  if (portfolio.source === 'colmex_pro') {
    return loadColmexPortfolioSummary(portfolio);
  }
  return loadManualPortfolioSummary(portfolio);
}

/**
 * תיק ידני במודל trades: מזומן + MTM של OPEN.
 * אם אין trades כלל — fallback ל-FIFO מ-portfolio_transactions (legacy).
 */
async function loadManualPortfolioSummary(
  portfolio: Pick<Portfolio, 'id' | 'currency' | 'source' | 'available_cash'>
): Promise<PortfolioSummary> {
  const [openTrades, closedTrades, cashFlow, txSummary] = await Promise.all([
    loadTrades(portfolio.id, 'OPEN').catch(() => [] as Trade[]),
    loadTrades(portfolio.id, 'CLOSED').catch(() => [] as Trade[]),
    getCashFlowSummary(portfolio.id).catch(() => null),
    loadPortfolioSummary(portfolio.id, portfolio.currency).catch(() => null),
  ]);

  const hasTradesModel = openTrades.length > 0 || closedTrades.length > 0;
  if (!hasTradesModel && txSummary) {
    const availableCash = Number(portfolio.available_cash ?? 0);
    const baseValue = Number(txSummary.value);
    const baseCash = Number(txSummary.cash);
    const baseTotal = Number(txSummary.total_value);
    if (availableCash > 0 && availableCash !== baseCash) {
      const total = availableCash + (Number.isFinite(baseValue) ? baseValue : 0);
      return {
        ...txSummary,
        cash: availableCash,
        total_value: Number.isFinite(total) ? total : 0,
      };
    }
    return {
      ...txSummary,
      total_value: Number.isFinite(baseTotal)
        ? baseTotal
        : (Number.isFinite(baseCash) ? baseCash : 0) +
          (Number.isFinite(baseValue) ? baseValue : 0),
    };
  }

  return buildTradesBasedSummary({
    portfolio,
    openTrades,
    closedTrades,
    cash: Number(portfolio.available_cash ?? txSummary?.cash ?? 0),
    cashFlow,
    fallbackTx: txSummary,
  });
}

async function loadColmexPortfolioSummary(
  portfolio: Pick<Portfolio, 'id' | 'currency' | 'source' | 'available_cash'>
): Promise<PortfolioSummary> {
  const [brokerSummary, closedTrades, openTrades, cashFlow] = await Promise.all([
    getBrokerPortfolioSummary(portfolio.id).catch(() => null),
    loadTrades(portfolio.id, 'CLOSED').catch(() => [] as Trade[]),
    loadTrades(portfolio.id, 'OPEN').catch(() => [] as Trade[]),
    getCashFlowSummary(portfolio.id).catch(() => null),
  ]);

  const funds = Number(
    brokerSummary?.available_funds ?? portfolio.available_cash ?? 0
  );
  const balance = Number(brokerSummary?.balance ?? 0);
  let equity = Number(brokerSummary?.equity ?? 0);

  const base = await buildTradesBasedSummary({
    portfolio,
    openTrades,
    closedTrades,
    cash: funds,
    cashFlow,
    fallbackTx: null,
  });

  // אם אין פוזיציות — שמור equity מהברוקר כשיש
  if (openTrades.length === 0 && equity > 0) {
    const unrealized =
      brokerSummary?.unrealized_pnl != null
        ? Number(brokerSummary.unrealized_pnl)
        : equity > 0 && balance > 0
          ? equity - balance
          : 0;
    const realizedPnl = base.realized_gain;
    const totalGain = realizedPnl + unrealized;
    const contributed = equity - totalGain;
    return {
      ...base,
      cash: Number.isFinite(funds) ? funds : 0,
      value: Math.max(0, equity - (Number.isFinite(funds) ? funds : 0)),
      total_value: equity,
      unrealized_gain: unrealized,
      total_gain: totalGain,
      total_gain_pct: contributed > 0 ? (totalGain / contributed) * 100 : 0,
      daily_gain: Number(brokerSummary?.realized_pnl_today ?? base.daily_gain) || 0,
      holdings_count:
        Number(brokerSummary?.open_positions_count ?? 0) || base.holdings_count,
    };
  }

  return {
    ...base,
    holdings_count:
      Number(brokerSummary?.open_positions_count ?? openTrades.length) ||
      openTrades.length,
  };
}

async function buildTradesBasedSummary(args: {
  portfolio: Pick<Portfolio, 'id' | 'currency'>;
  openTrades: Trade[];
  closedTrades: Trade[];
  cash: number;
  cashFlow: {
    total_deposits?: number;
    total_withdrawals?: number;
    total_fees?: number;
    total_dividends?: number;
  } | null;
  fallbackTx: PortfolioSummary | null;
}): Promise<PortfolioSummary> {
  const { portfolio, openTrades, closedTrades, cashFlow, fallbackTx } = args;
  const funds = Number.isFinite(args.cash) ? args.cash : 0;

  const realizedPnl = closedTrades.reduce(
    (sum, t) => sum + Number(t.profit_loss ?? 0),
    0
  );

  const symbols = [...new Set(openTrades.map((t) => t.symbol.toUpperCase()))];
  const quotes = symbols.length > 0 ? await getQuotes(symbols) : new Map();

  let openNotional = 0;
  let openMtm = 0;
  let dailyGainFromQuotes = 0;
  let hasDayChangeBasis = false;
  const todayKey = new Date().toISOString().slice(0, 10);

  for (const t of openTrades) {
    const qty = Number(t.quantity);
    const entry = Number(t.entry_price);
    const lev = t.leverage ?? 1;
    const quote = quotes.get(t.symbol.toUpperCase());
    const livePrice = quote?.price && quote.price > 0 ? quote.price : entry;
    const prevClose =
      quote?.previous_close != null && quote.previous_close > 0
        ? quote.previous_close
        : null;
    const openedToday = (t.entry_date ?? '').slice(0, 10) >= todayKey;

    openNotional += entry * qty;
    const unrealized =
      t.direction === 'long'
        ? (livePrice - entry) * qty * lev
        : (entry - livePrice) * qty * lev;
    openMtm += entry * qty + unrealized;

    if (prevClose != null) {
      hasDayChangeBasis = true;
      dailyGainFromQuotes +=
        t.direction === 'long'
          ? (livePrice - prevClose) * qty * lev
          : (prevClose - livePrice) * qty * lev;
    } else if (openedToday) {
      hasDayChangeBasis = true;
      dailyGainFromQuotes += unrealized;
    }
  }

  const equity = funds + openMtm;
  const unrealized = openTrades.length > 0 ? openMtm - openNotional : 0;
  const totalGain = realizedPnl + unrealized;
  const wins = closedTrades.filter((t) => Number(t.profit_loss ?? 0) > 0);
  const winRate =
    closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : null;
  const safeEquity = Number.isFinite(equity) ? equity : 0;
  const contributed = safeEquity - totalGain;
  const totalGainPct = contributed > 0 ? (totalGain / contributed) * 100 : 0;

  const dailyGain = hasDayChangeBasis ? dailyGainFromQuotes : 0;
  const yesterdayValue = safeEquity - dailyGain;
  const dailyGainPct =
    yesterdayValue > 0 ? (dailyGain / yesterdayValue) * 100 : 0;

  return {
    portfolio_id: portfolio.id,
    currency: portfolio.currency,
    cash: funds,
    invested: openNotional,
    value: Math.max(0, safeEquity - funds),
    total_value: safeEquity,
    unrealized_gain: unrealized,
    realized_gain: realizedPnl,
    total_gain: totalGain,
    total_gain_pct: totalGainPct,
    daily_gain: dailyGain,
    daily_gain_pct: dailyGainPct,
    annualized_yield: 0,
    win_rate_pct: winRate,
    total_deposits: Number(
      cashFlow?.total_deposits ?? fallbackTx?.total_deposits ?? 0
    ),
    total_withdrawals: Number(
      cashFlow?.total_withdrawals ?? fallbackTx?.total_withdrawals ?? 0
    ),
    total_fees: Number(cashFlow?.total_fees ?? fallbackTx?.total_fees ?? 0),
    total_dividends: Number(
      cashFlow?.total_dividends ?? fallbackTx?.total_dividends ?? 0
    ),
    holdings_count: openTrades.length,
  };
}
