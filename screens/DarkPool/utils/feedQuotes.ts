/**
 * ציטוטי מחיר לפיד — אותו getQuotes של מסך הטיקר / פרטי עסקה.
 * לא ממציאים $0; טיקר בלי quote אמיתי מקבל «—» שמור-גובה, לא הסתרה.
 */

import { getQuotes } from '../../../services/portfolios/portfolioPriceFeed';
import type { PriceQuote } from '../../Portfolios/portfolioTypes';
import {
  isUsableFeedQuote,
  markFeedQuotesFetchEnd,
  markFeedQuotesFetchStart,
  seedFeedQuoteMap,
  writeCachedFeedQuotes,
} from './feedQuoteCache';
import { uniqueFeedTickers } from './feedQuoteTickers';

const FEED_QUOTE_CHUNK = 8;

export { FEED_QUOTE_SYMBOL_CAP, uniqueFeedTickers } from './feedQuoteTickers';
export {
  FEED_QUOTE_PLACEHOLDER,
  formatFeedLivePriceText,
  resolveFeedQuoteSlots,
} from './feedQuoteSlots';
export {
  collectItemQuotes,
  feedQuotesToPrices,
  isUsableFeedQuote,
  markFeedQuotesFetchEnd,
  markFeedQuotesFetchStart,
  mergeFeedQuotePrices,
  readCachedFeedQuotes,
  resetFeedQuotesFetchPendingForTests,
  seedFeedQuoteMap,
  writeCachedFeedQuotes,
  type FeedQuotesCache,
} from './feedQuoteCache';

export async function fetchFeedQuotes(
  tickers: Array<string | null | undefined>
): Promise<Map<string, PriceQuote>> {
  const symbols = uniqueFeedTickers(tickers);
  if (!symbols.length) return new Map();

  const map = new Map<string, PriceQuote>();
  for (let i = 0; i < symbols.length; i += FEED_QUOTE_CHUNK) {
    const chunk = await getQuotes(symbols.slice(i, i + FEED_QUOTE_CHUNK));
    chunk.forEach((quote, symbol) => {
      if (isUsableFeedQuote(quote)) {
        map.set(symbol.toUpperCase(), quote);
      }
    });
  }
  return map;
}

/** Fetch + כתיבה לקאש המשותף; שומר quotes ישנים לטיקרים שנכשלו. */
export async function fetchAndCacheFeedQuotes(
  tickers: Array<string | null | undefined>,
  seeded?: Map<string, PriceQuote>
): Promise<Map<string, PriceQuote>> {
  const merged = new Map(seeded ?? seedFeedQuoteMap());
  markFeedQuotesFetchStart();
  try {
    const fresh = await fetchFeedQuotes(tickers);
    writeCachedFeedQuotes(fresh);
    fresh.forEach((quote, symbol) => {
      merged.set(symbol, quote);
    });
    return merged;
  } catch {
    return merged;
  } finally {
    markFeedQuotesFetchEnd();
  }
}
