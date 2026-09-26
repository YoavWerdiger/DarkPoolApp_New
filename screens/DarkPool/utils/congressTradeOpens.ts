/**
 * פתיחה יומית ליום עסקת קונגרס — Yahoo chart v8 (אותו נתיב כמו סל/גרף).
 * לא midpoint של STOCK Act. לא נתיב UW historical-prices (אין ב-repo).
 */

import { getHistoricalPrices } from '../../../services/portfolios/portfolioPriceFeed';
import type { HistoricalPricePoint } from '../../Portfolios/portfolioTypes';
import {
  pickDailyOpenOnDate,
  yahooRangeForTransactionDate,
} from './congressSinceTrade';

export {
  congressFeedDailyBarRequest,
  congressTickersNeedingOpen,
} from './congressSinceTrade';

const CHUNK = 4;
const MAX_TICKERS = 40;

function uniqueTickers(tickers: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tickers) {
    const t = typeof raw === 'string' ? raw.trim().toUpperCase().replace(/^\$/, '') : '';
    if (!t || t.length > 8 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TICKERS) break;
  }
  return out;
}

export async function fetchDailyBarsForTickers(
  tickers: Array<string | null | undefined>,
  range: '1y' | '5y' = '5y'
): Promise<Map<string, HistoricalPricePoint[]>> {
  const unique = uniqueTickers(tickers);
  const out = new Map<string, HistoricalPricePoint[]>();
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (sym) => {
        const points = await getHistoricalPrices(sym, range, { interval: '1d' });
        if (points.length) out.set(sym, points);
      })
    );
  }
  return out;
}

export async function fetchOpenOnTransactionDate(
  ticker: string,
  transactionDate: string | null | undefined
): Promise<number | null> {
  const sym = ticker.trim().toUpperCase().replace(/^\$/, '');
  if (!sym || !transactionDate) return null;
  const preferred = yahooRangeForTransactionDate(transactionDate);
  const first = await getHistoricalPrices(sym, preferred, { interval: '1d' });
  const fromFirst = pickDailyOpenOnDate(first, transactionDate);
  if (fromFirst != null) return fromFirst;
  if (preferred === '5y') return null;
  const wider = await getHistoricalPrices(sym, '5y', { interval: '1d' });
  return pickDailyOpenOnDate(wider, transactionDate);
}
