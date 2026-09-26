/**
 * קאש ציטוטים לפיד — React Query נפרד משורות הפיד.
 * First paint קורא מכאן כדי שלא ייעלם מחיר חי כשהפיד חוזר בלי quotes.
 */

import { appQueryKeys } from '../../../lib/appQueryKeys';
import { queryClient } from '../../../lib/queryClient';
import type { PriceQuote } from '../../Portfolios/portfolioTypes';

export type FeedQuotesCache = Record<string, PriceQuote>;

export function isUsableFeedQuote(
  quote: PriceQuote | null | undefined
): quote is PriceQuote {
  return (
    quote != null &&
    quote.price != null &&
    Number.isFinite(quote.price) &&
    quote.price > 0
  );
}

type FeedItemQuoteSource = {
  trade?: { ticker?: string | null };
  quote?: PriceQuote | null;
};

export function collectItemQuotes(
  items: ReadonlyArray<FeedItemQuoteSource | null | undefined>
): Map<string, PriceQuote> {
  const map = new Map<string, PriceQuote>();
  for (const item of items) {
    const ticker =
      typeof item?.trade?.ticker === 'string'
        ? item.trade.ticker.trim().toUpperCase().replace(/^\$/, '')
        : '';
    if (!ticker || !isUsableFeedQuote(item?.quote)) continue;
    map.set(ticker, item.quote);
  }
  return map;
}

export function readCachedFeedQuotes(): Map<string, PriceQuote> {
  const rec = queryClient.getQueryData<FeedQuotesCache>(appQueryKeys.feedQuotes);
  const map = new Map<string, PriceQuote>();
  if (!rec) return map;
  for (const [sym, quote] of Object.entries(rec)) {
    const ticker = sym.trim().toUpperCase().replace(/^\$/, '');
    if (!ticker || !isUsableFeedQuote(quote)) continue;
    map.set(ticker, quote);
  }
  return map;
}

export function writeCachedFeedQuotes(quotes: Map<string, PriceQuote>): void {
  if (quotes.size === 0) return;
  const prev =
    queryClient.getQueryData<FeedQuotesCache>(appQueryKeys.feedQuotes) ?? {};
  const next: FeedQuotesCache = { ...prev };
  quotes.forEach((quote, symbol) => {
    if (!isUsableFeedQuote(quote)) return;
    next[symbol.trim().toUpperCase()] = quote;
  });
  queryClient.setQueryData(appQueryKeys.feedQuotes, next);
}

/** First paint: cache גלובלי + quotes שכבר יש על שורות הפיד הקודמות. */
export function seedFeedQuoteMap(opts?: {
  previousItems?: ReadonlyArray<FeedItemQuoteSource | null | undefined>;
}): Map<string, PriceQuote> {
  const map = readCachedFeedQuotes();
  collectItemQuotes(opts?.previousItems ?? []).forEach((quote, symbol) => {
    if (!map.has(symbol)) map.set(symbol, quote);
  });
  return map;
}

export function feedQuotesToPrices(
  quotes: Map<string, PriceQuote>
): Record<string, number> {
  const prices: Record<string, number> = {};
  quotes.forEach((quote, symbol) => {
    if (isUsableFeedQuote(quote)) prices[symbol] = quote.price;
  });
  return prices;
}

export function mergeFeedQuotePrices(
  ...sources: Array<Record<string, number> | null | undefined>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const src of sources) {
    if (!src) continue;
    for (const [raw, price] of Object.entries(src)) {
      if (price == null || !Number.isFinite(price) || price <= 0) continue;
      out[raw.trim().toUpperCase()] = price;
    }
  }
  return out;
}

let quoteFetchesInFlight = 0;

export function markFeedQuotesFetchStart(): void {
  quoteFetchesInFlight += 1;
  queryClient.setQueryData(appQueryKeys.feedQuotesPending, true);
}

export function markFeedQuotesFetchEnd(): void {
  quoteFetchesInFlight = Math.max(0, quoteFetchesInFlight - 1);
  if (quoteFetchesInFlight === 0) {
    queryClient.setQueryData(appQueryKeys.feedQuotesPending, false);
  }
}

/** לבדיקות — לא לשימוש בפרודקשן. */
export function resetFeedQuotesFetchPendingForTests(): void {
  quoteFetchesInFlight = 0;
  queryClient.setQueryData(appQueryKeys.feedQuotesPending, false);
}
