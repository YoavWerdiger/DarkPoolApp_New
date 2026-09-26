import { appQueryKeys } from '../../lib/appQueryKeys';
import { queryClient } from '../../lib/queryClient';
import {
  collectItemQuotes,
  feedQuotesToPrices,
  isUsableFeedQuote,
  mergeFeedQuotePrices,
  readCachedFeedQuotes,
  resetFeedQuotesFetchPendingForTests,
  seedFeedQuoteMap,
  writeCachedFeedQuotes,
} from '../../screens/DarkPool/utils/feedQuoteCache';
import {
  FEED_QUOTE_PLACEHOLDER,
  formatFeedLivePriceText,
  resolveFeedQuoteSlots,
} from '../../screens/DarkPool/utils/feedQuoteSlots';
import {
  FEED_QUOTE_SYMBOL_CAP,
  uniqueFeedTickers,
} from '../../screens/DarkPool/utils/feedQuoteTickers';
import type { PriceQuote } from '../../screens/Portfolios/portfolioTypes';

const quote = (symbol: string, price: number): PriceQuote => ({
  symbol,
  price,
  previous_close: price - 1,
  currency: 'USD',
  as_of: '2026-09-19T12:00:00Z',
  source: 'finnhub',
});

describe('uniqueFeedTickers', () => {
  it('uppercases, strips $, and de-dupes', () => {
    expect(uniqueFeedTickers(['pg', '$PG', ' NVDA ', 'nvda', null, ''])).toEqual([
      'PG',
      'NVDA',
    ]);
  });

  it('caps unique symbols so the feed does not stampede Finnhub', () => {
    const many = Array.from({ length: FEED_QUOTE_SYMBOL_CAP + 10 }, (_, i) => `T${i}`);
    expect(uniqueFeedTickers(many)).toHaveLength(FEED_QUOTE_SYMBOL_CAP);
  });
});

describe('formatFeedLivePriceText', () => {
  it('formats a real live price', () => {
    expect(formatFeedLivePriceText(146.5)).toBe('$146.50');
  });

  it('does not invent $0', () => {
    expect(formatFeedLivePriceText(0)).toBeNull();
    expect(formatFeedLivePriceText(-1)).toBeNull();
    expect(formatFeedLivePriceText(null)).toBeNull();
    expect(formatFeedLivePriceText(Number.NaN)).toBeNull();
  });
});

describe('resolveFeedQuoteSlots', () => {
  it('always reserves price and since-trade text — never empty strings', () => {
    const empty = resolveFeedQuoteSlots({
      currentPrice: null,
      changeSinceTradePct: null,
    });
    expect(empty.priceText).toBe(FEED_QUOTE_PLACEHOLDER);
    expect(empty.changeText).toBe(FEED_QUOTE_PLACEHOLDER);
    expect(empty.priceKnown).toBe(false);
    expect(empty.changeKnown).toBe(false);
  });

  it('shows congress price_change_pct before a live quote arrives', () => {
    const slots = resolveFeedQuoteSlots({
      currentPrice: null,
      changeSinceTradePct: 12.5,
    });
    expect(slots.priceText).toBe(FEED_QUOTE_PLACEHOLDER);
    expect(slots.changeText).toBe('+12.50%');
    expect(slots.changeKnown).toBe(true);
  });

  it('keeps a legitimate 0.00% from Quiver — not a fake hide', () => {
    const slots = resolveFeedQuoteSlots({
      currentPrice: 100,
      changeSinceTradePct: 0,
    });
    expect(slots.priceText).toBe('$100.00');
    expect(slots.changeText).toBe('0.00%');
    expect(slots.changeKnown).toBe(true);
  });

  it('replaces placeholders in place when a quote arrives', () => {
    const before = resolveFeedQuoteSlots({
      currentPrice: null,
      changeSinceTradePct: 4.2,
    });
    const after = resolveFeedQuoteSlots({
      currentPrice: 210.25,
      changeSinceTradePct: 4.2,
    });
    expect(before.changeText).toBe(after.changeText);
    expect(before.priceText).toBe(FEED_QUOTE_PLACEHOLDER);
    expect(after.priceText).toBe('$210.25');
  });
});

describe('feed quote cache', () => {
  beforeEach(() => {
    queryClient.clear();
    resetFeedQuotesFetchPendingForTests();
  });

  it('rejects $0 quotes', () => {
    expect(isUsableFeedQuote(quote('NVDA', 0))).toBe(false);
    expect(isUsableFeedQuote(quote('NVDA', 146.5))).toBe(true);
  });

  it('seeds first paint from React Query cache and previous feed rows', () => {
    writeCachedFeedQuotes(new Map([['NVDA', quote('NVDA', 146.5)]]));
    const seeded = seedFeedQuoteMap({
      previousItems: [
        { trade: { ticker: 'PG' }, quote: quote('PG', 88.1) },
        { trade: { ticker: 'FAKE' }, quote: quote('FAKE', 0) },
      ],
    });
    expect(seeded.get('NVDA')?.price).toBe(146.5);
    expect(seeded.get('PG')?.price).toBe(88.1);
    expect(seeded.has('FAKE')).toBe(false);
  });

  it('collectItemQuotes ignores missing and non-positive prices', () => {
    const map = collectItemQuotes([
      { trade: { ticker: 'nvda' }, quote: quote('NVDA', 200) },
      { trade: { ticker: 'MSFT' }, quote: null },
      { trade: { ticker: 'ZERO' }, quote: quote('ZERO', 0) },
    ]);
    expect([...map.keys()]).toEqual(['NVDA']);
  });

  it('merges following prices without inventing zeros', () => {
    writeCachedFeedQuotes(new Map([['AAPL', quote('AAPL', 190)]]));
    const merged = mergeFeedQuotePrices(
      { aapl: 0, MSFT: 420 },
      feedQuotesToPrices(readCachedFeedQuotes())
    );
    expect(merged.AAPL).toBe(190);
    expect(merged.MSFT).toBe(420);
    expect(merged.aapl).toBeUndefined();
  });

  it('uses the dedicated feedQuotes query key', () => {
    writeCachedFeedQuotes(new Map([['TSLA', quote('TSLA', 250)]]));
    expect(appQueryKeys.feedQuotes).toEqual(['darkpool', 'feed', 'quotes']);
    expect(
      queryClient.getQueryData(appQueryKeys.feedQuotes)
    ).toMatchObject({ TSLA: { price: 250 } });
  });
});
