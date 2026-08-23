/**
 * סיכום תיק להצגה ב-UI.
 * תיקי Colmex: equity/cash/PnL מ-broker + trades + cashflow אמיתי.
 * תיקים ידניים: loadPortfolioSummary מ-portfolio_transactions.
 */

import { getBrokerPortfolioSummary } from '../brokers/brokerService';
import { loadPortfolioSummary } from './portfolioAggregator';
import { loadTrades } from './portfolioTradeDerive';
import { getCashFlowSummary } from './portfolioService';
import { getQuotes } from './portfolioPriceFeed';
import type { Portfolio, PortfolioSummary } from '../../screens/Portfolios/portfolioTypes';

export async function loadPortfolioDisplaySummary(
  portfolio: Pick<Portfolio, 'id' | 'currency' | 'source' | 'available_cash'>
): Promise<PortfolioSummary> {
  if (portfolio.source === 'colmex_pro') {
    return loadColmexPortfolioSummary(portfolio);
  }

  const s = await loadPortfolioSummary(portfolio.id, portfolio.currency);
  const availableCash = Number(portfolio.available_cash ?? 0);
  if (availableCash > 0 && availableCash !== s.cash) {
    return {
      ...s,
      cash: availableCash,
      total_value: availableCash + s.value,
    };
  }
  return s;
}

async function loadColmexPortfolioSummary(
  portfolio: Pick<Portfolio, 'id' | 'currency' | 'source' | 'available_cash'>
): Promise<PortfolioSummary> {
  const [brokerSummary, closedTrades, openTrades, cashFlow] = await Promise.all([
    getBrokerPortfolioSummary(portfolio.id).catch(() => null),
    loadTrades(portfolio.id, 'CLOSED').catch(() => []),
    loadTrades(portfolio.id, 'OPEN').catch(() => []),
    getCashFlowSummary(portfolio.id).catch(() => null),
  ]);

  const funds = Number(
    brokerSummary?.available_funds ?? portfolio.available_cash ?? 0
  );
  const balance = Number(brokerSummary?.balance ?? 0);
  let equity = Number(brokerSummary?.equity ?? 0);
  const realizedPnl = closedTrades.reduce(
    (sum, t) => sum + Number(t.profit_loss ?? 0),
    0
  );

  // מחירים חיים + previous_close לשינוי יומי
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

    // קודם previous_close (שינוי יום אמיתי). "נפתח היום" רק אם אין prevClose —
    // אחרת entry_date שגוי (sync בלי openDate) מנפח את "היום" לכל ה-unrealized.
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

  // שווי חי: מזומן + MTM של פוזיציות פתוחות (עדיף על equity ישן מהברוקר)
  const liveEquity = funds + openMtm;
  if (liveEquity > 0) {
    equity = liveEquity;
  } else if (!(equity > 0)) {
    equity = funds + openNotional;
  }

  const unrealized =
    openTrades.length > 0
      ? openMtm - openNotional
      : brokerSummary?.unrealized_pnl != null
        ? Number(brokerSummary.unrealized_pnl)
        : equity > 0 && balance > 0
          ? equity - balance
          : 0;

  const totalGain = realizedPnl + unrealized;
  const wins = closedTrades.filter((t) => Number(t.profit_loss ?? 0) > 0);
  const winRate =
    closedTrades.length > 0
      ? (wins.length / closedTrades.length) * 100
      : null;
  const contributed = equity - totalGain;
  const totalGainPct =
    contributed > 0 ? (totalGain / contributed) * 100 : 0;

  // שינוי יומי: מפוזיציות פתוחות; fallback לברוקר
  let dailyGain = hasDayChangeBasis
    ? dailyGainFromQuotes
    : Number(brokerSummary?.realized_pnl_today ?? 0);
  const yesterdayValue = equity - dailyGain;
  const dailyGainPct =
    yesterdayValue > 0 ? (dailyGain / yesterdayValue) * 100 : 0;

  return {
    portfolio_id: portfolio.id,
    currency: portfolio.currency,
    cash: funds,
    invested: openNotional,
    value: Math.max(0, equity - funds),
    total_value: equity,
    unrealized_gain: unrealized,
    realized_gain: realizedPnl,
    total_gain: totalGain,
    total_gain_pct: totalGainPct,
    daily_gain: dailyGain,
    daily_gain_pct: dailyGainPct,
    annualized_yield: 0,
    win_rate_pct: winRate,
    total_deposits: Number(cashFlow?.total_deposits ?? 0),
    total_withdrawals: Number(cashFlow?.total_withdrawals ?? 0),
    total_fees: Number(cashFlow?.total_fees ?? 0),
    total_dividends: Number(cashFlow?.total_dividends ?? 0),
    holdings_count:
      Number(brokerSummary?.open_positions_count ?? openTrades.length) ||
      openTrades.length,
  };
}
