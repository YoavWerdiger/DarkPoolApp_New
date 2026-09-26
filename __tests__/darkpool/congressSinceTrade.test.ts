/**
 * תשואת טיקר מאז עסקת קונגרס — פתיחת יום הביצוע מול מחיר חי.
 * לא midpoint של STOCK Act ולא P&L של פוזיציה.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  calcSharePriceDeltaFromOpen,
  calcTickerReturnPctFromOpen,
  congressFeedDailyBarRequest,
  congressTickersNeedingOpen,
  pickDailyOpenOnDate,
  resolveCongressSinceTradePct,
  yahooRangeForOldestTransactionDate,
  yahooRangeForTransactionDate,
} from '../../screens/DarkPool/utils/congressSinceTrade';
import {
  buildCongressFeedItem,
  resolveCongressSinceTradePct as resolveFromFeed,
} from '../../screens/DarkPool/utils/congressFeedCalc';
import { formatReturnPct } from '../../screens/DarkPool/utils/congressTradeDisplay';
import type { CongressFeedTrade } from '../../services/darkpool/uwCongressFeedService';
import type { PriceQuote } from '../../screens/Portfolios/portfolioTypes';

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function makeCongressTrade(
  overrides: Partial<CongressFeedTrade> = {}
): CongressFeedTrade {
  return {
    id: 'c1',
    politician_id: 'P000197',
    politician_name: 'Nancy Pelosi',
    politician_image_url: null,
    ticker: 'NVDA',
    company_name: 'NVIDIA',
    transaction_type: 'buy',
    shares: null,
    price: null,
    amount_label: '$1,001 - $15,000',
    filed_at: '2026-08-22T12:00:00Z',
    transaction_date: '2026-07-28',
    txn_label: 'רכישה',
    source: 'quiverquant',
    excess_return_pct: null,
    price_change_pct: null,
    spy_change_pct: null,
    ...overrides,
  };
}

function makeQuote(price: number): PriceQuote {
  return {
    symbol: 'NVDA',
    price,
    previous_close: price - 1,
    currency: 'USD',
    as_of: '2026-09-21T12:00:00Z',
    source: 'finnhub',
  };
}

const BARS = [
  { date: '2026-07-24', open: 98.5 },
  { date: '2026-07-27', open: 100 },
  { date: '2026-07-28', open: 101.25 },
  { date: '2026-07-29', open: 102 },
];

describe('calcTickerReturnPctFromOpen', () => {
  it('returns percent, not a 0–1 ratio — 100 → 102.21 = +2.21%', () => {
    const pct = calcTickerReturnPctFromOpen(100, 102.21);
    expect(pct).toBeCloseTo(2.21, 2);
    expect(formatReturnPct(pct)).toBe('+2.21%');
  });

  it('returns a negative percent when the last is below the open', () => {
    expect(calcTickerReturnPctFromOpen(200, 150)).toBeCloseTo(-25, 5);
  });

  it('keeps a legitimate 0% when last equals open', () => {
    expect(calcTickerReturnPctFromOpen(145.5, 145.5)).toBe(0);
    expect(formatReturnPct(0)).toBe('0.00%');
  });

  it('returns null instead of inventing a move', () => {
    expect(calcTickerReturnPctFromOpen(null, 100)).toBeNull();
    expect(calcTickerReturnPctFromOpen(100, null)).toBeNull();
    expect(calcTickerReturnPctFromOpen(0, 100)).toBeNull();
    expect(calcTickerReturnPctFromOpen(-5, 100)).toBeNull();
    expect(calcTickerReturnPctFromOpen(Number.NaN, 100)).toBeNull();
    expect(calcTickerReturnPctFromOpen(100, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('calcSharePriceDeltaFromOpen', () => {
  it('is the share-price dollar move, not a position value', () => {
    expect(calcSharePriceDeltaFromOpen(100, 102.21)).toBeCloseTo(2.21, 5);
    expect(calcSharePriceDeltaFromOpen(200, 150)).toBeCloseTo(-50, 5);
    expect(calcSharePriceDeltaFromOpen(null, 100)).toBeNull();
  });
});

describe('resolveCongressSinceTradePct', () => {
  it('prefers session open vs live when both exist — not STOCK Act range', () => {
    expect(
      resolveCongressSinceTradePct({
        vendorPriceChangePct: 12.5,
        openOnTransactionDate: 100,
        currentPrice: 110,
      })
    ).toBeCloseTo(10, 5);
    expect(
      resolveCongressSinceTradePct({
        vendorPriceChangePct: 0,
        openOnTransactionDate: 100,
        currentPrice: 100,
      })
    ).toBe(0);
  });

  it('falls back to Quiver PriceChange when open or live is missing', () => {
    expect(
      resolveCongressSinceTradePct({
        vendorPriceChangePct: 12.5,
        openOnTransactionDate: null,
        currentPrice: 110,
      })
    ).toBe(12.5);
  });

  it('computes (current − open) / open when PriceChange is missing', () => {
    expect(
      resolveCongressSinceTradePct({
        vendorPriceChangePct: null,
        openOnTransactionDate: 100,
        currentPrice: 102.21,
      })
    ).toBeCloseTo(2.21, 2);
    expect(
      resolveCongressSinceTradePct({
        vendorPriceChangePct: Number.NaN,
        openOnTransactionDate: 80,
        currentPrice: 100,
      })
    ).toBeCloseTo(25, 5);
  });

  it('does not read a STOCK Act range or invent shares', () => {
    const src = readFileSync(
      join(__dirname, '../../screens/DarkPool/utils/congressSinceTrade.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/midpoint/);
    expect(src).not.toMatch(/amount_label/);
    expect(src).not.toMatch(/shares/);
    expect(resolveFromFeed).toBe(resolveCongressSinceTradePct);
  });
});

describe('pickDailyOpenOnDate', () => {
  it('uses the open on the transaction date when that session exists', () => {
    expect(pickDailyOpenOnDate(BARS, '2026-07-28')).toBe(101.25);
    expect(pickDailyOpenOnDate(BARS, '2026-07-28T12:00:00Z')).toBe(101.25);
  });

  it('uses the next session when the filing day is a weekend/holiday', () => {
    expect(pickDailyOpenOnDate(BARS, '2026-07-25')).toBe(100);
  });

  it('falls back to the prior session when nothing later exists', () => {
    expect(pickDailyOpenOnDate(BARS, '2026-08-01')).toBe(102);
  });

  it('returns null when bars or the date are unusable', () => {
    expect(pickDailyOpenOnDate([], '2026-07-28')).toBeNull();
    expect(pickDailyOpenOnDate(BARS, null)).toBeNull();
    expect(pickDailyOpenOnDate([{ date: '2026-07-28', open: 0 }], '2026-07-28')).toBeNull();
    expect(pickDailyOpenOnDate(null, '2026-07-28')).toBeNull();
  });
});

describe('yahooRangeForTransactionDate', () => {
  it('asks 1y for a recent trade and 5y for an older one — never max', () => {
    expect(yahooRangeForTransactionDate(daysAgoIso(30))).toBe('1y');
    expect(yahooRangeForTransactionDate(daysAgoIso(400))).toBe('5y');
    expect(yahooRangeForTransactionDate(null)).toBe('5y');
    expect(
      yahooRangeForOldestTransactionDate([daysAgoIso(20), daysAgoIso(400)])
    ).toBe('5y');
  });
});

describe('buildCongressFeedItem', () => {
  it('uses Quiver PriceChange only before open and live quote exist', () => {
    const item = buildCongressFeedItem(
      makeCongressTrade({ price_change_pct: 4.2 }),
      new Map()
    );
    expect(item.sinceTradePct).toBe(4.2);
    expect(item.quote).toBeNull();
    const withOpen = buildCongressFeedItem(
      makeCongressTrade({ price_change_pct: 4.2 }),
      new Map([['NVDA', makeQuote(110)]]),
      new Map([['NVDA', [{ date: '2026-07-28', close: 105, open: 100 }]]])
    );
    expect(withOpen.sinceTradePct).toBeCloseTo(10, 5);
  });

  it('computes ticker % from the session open when PriceChange is missing', () => {
    const quotes = new Map([['NVDA', makeQuote(110)]]);
    const bars = new Map([
      ['NVDA', [{ date: '2026-07-28', close: 102, open: 100 }]],
    ]);
    const item = buildCongressFeedItem(
      makeCongressTrade({ price: null, shares: null }),
      quotes,
      bars
    );
    expect(item.sinceTradePct).toBeCloseTo(10, 5);
  });

  it('does not invent a % from the STOCK Act range when open/quote are missing', () => {
    const item = buildCongressFeedItem(makeCongressTrade(), new Map());
    expect(item.sinceTradePct).toBeNull();
    expect(item.trade.amount_label).toBe('$1,001 - $15,000');
  });
});

describe('congressFeedDailyBarRequest', () => {
  it('requests daily bars for every congress ticker in the feed', () => {
    const need = congressFeedDailyBarRequest([
      { ticker: 'NVDA', transaction_date: daysAgoIso(10) },
      { ticker: 'PG', transaction_date: daysAgoIso(20) },
      { ticker: 'nvda', transaction_date: daysAgoIso(5) },
    ]);
    expect(need.tickers.sort()).toEqual(['NVDA', 'PG']);
    expect(need.range).toBe('1y');
  });
});

describe('congressTickersNeedingOpen (legacy)', () => {
  it('still skips tickers that already have PriceChange', () => {
    const need = congressTickersNeedingOpen([
      { ticker: 'NVDA', price_change_pct: 12.5, transaction_date: daysAgoIso(10) },
      { ticker: 'PG', price_change_pct: null, transaction_date: daysAgoIso(20) },
    ]);
    expect(need.tickers).toEqual(['PG']);
    expect(need.range).toBe('1y');
  });
});

describe('CongressTradeCard wiring', () => {
  it('passes item.sinceTradePct into the nest — not trade.price alone', () => {
    const cardSrc = readFileSync(
      join(__dirname, '../../screens/DarkPool/components/CongressTradeCard.tsx'),
      'utf8'
    );
    expect(cardSrc).toMatch(/changeSinceTradePct=\{sinceTradePct\}/);
    expect(cardSrc).not.toMatch(/changeSinceTradePct=\{trade\.price_change_pct\}/);
    expect(cardSrc).not.toMatch(/midpoint/);
  });

  it('resolves congress detail nest from PriceChange or the session open', () => {
    const detailSrc = readFileSync(
      join(__dirname, '../../screens/DarkPool/DarkPoolTradeDetailScreen.tsx'),
      'utf8'
    );
    expect(detailSrc).toMatch(/resolveCongressSinceTradePct/);
    expect(detailSrc).toMatch(/fetchOpenOnTransactionDate/);
    expect(detailSrc).toMatch(/openOnTransactionDate/);
  });
});
