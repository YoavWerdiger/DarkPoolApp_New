/**
 * darkPoolInsiderFeed.test.ts
 * -----------------------------------------------------------------------------
 * בדיקות לעוזרי החישוב של פיד הבכירים — חישוב % שינוי מאז הרכישה
 * ושילוב trade + quote ל-feed item.
 */

import {
  buildFeedItem,
  calcSinceTradePct,
  type InsiderTradeFeedItem,
} from '../../screens/DarkPool/utils/insiderFeedCalc';
import type { InsiderBuyRow } from '../../types/darkpool.types';
import type { PriceQuote } from '../../screens/Portfolios/portfolioTypes';

const makeTrade = (overrides: Partial<InsiderBuyRow> = {}): InsiderBuyRow => ({
  id: 'trade-1',
  external_id: 'ext-1',
  ticker: 'NVDA',
  insider_name: 'Nancy Pelosi',
  insider_role: 'Senator',
  transaction_type: 'P',
  shares: 50,
  price: 198.87,
  value: 50 * 198.87,
  filed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  transaction_date: '2026-05-01',
  source: 'form4api',
  created_at: new Date().toISOString(),
  ...overrides,
});

const makeQuote = (overrides: Partial<PriceQuote> = {}): PriceQuote => ({
  symbol: 'NVDA',
  price: 235.73,
  previous_close: 230.0,
  currency: 'USD',
  as_of: new Date().toISOString(),
  source: 'finnhub',
  ...overrides,
});

describe('calcSinceTradePct', () => {
  it('returns positive ratio when current > trade price', () => {
    const pct = calcSinceTradePct(100, 120);
    expect(pct).toBeCloseTo(0.2, 5);
  });

  it('returns negative ratio when current < trade price', () => {
    const pct = calcSinceTradePct(200, 150);
    expect(pct).toBeCloseTo(-0.25, 5);
  });

  it('returns 0 when prices are equal', () => {
    expect(calcSinceTradePct(150, 150)).toBe(0);
  });

  it('returns null when either price is null/undefined', () => {
    expect(calcSinceTradePct(null, 100)).toBeNull();
    expect(calcSinceTradePct(100, null)).toBeNull();
    expect(calcSinceTradePct(undefined, undefined)).toBeNull();
  });

  it('returns null when trade price is non-positive', () => {
    expect(calcSinceTradePct(0, 100)).toBeNull();
    expect(calcSinceTradePct(-5, 100)).toBeNull();
  });

  it('returns null for non-finite values', () => {
    expect(calcSinceTradePct(Number.NaN, 100)).toBeNull();
    expect(calcSinceTradePct(100, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('matches the screenshot example (NVDA bought at $198.87, current $235.73 → +18.53%)', () => {
    const pct = calcSinceTradePct(198.87, 235.73);
    expect(pct).not.toBeNull();
    expect(Math.round((pct as number) * 10000) / 100).toBeCloseTo(18.53, 2);
  });
});

describe('buildFeedItem', () => {
  it('attaches quote and since-trade % for matching ticker', () => {
    const quotes = new Map<string, PriceQuote>([['NVDA', makeQuote()]]);
    const item = buildFeedItem(makeTrade(), quotes);
    expect(item.quote?.symbol).toBe('NVDA');
    expect(item.sinceTradePct).not.toBeNull();
    expect(item.sinceTradePct).toBeGreaterThan(0); // 198.87 → 235.73
  });

  it('returns null quote and null sinceTradePct when ticker is missing from map', () => {
    const item = buildFeedItem(makeTrade(), new Map());
    expect(item.quote).toBeNull();
    expect(item.sinceTradePct).toBeNull();
  });

  it('normalizes ticker to uppercase when reading the quote map', () => {
    const quotes = new Map<string, PriceQuote>([
      ['NVDA', makeQuote({ price: 250 })],
    ]);
    const item = buildFeedItem(
      makeTrade({ ticker: 'nvda' }),
      quotes
    );
    expect(item.quote?.price).toBe(250);
  });

  it('preserves trade row reference unchanged', () => {
    const trade = makeTrade();
    const item: InsiderTradeFeedItem = buildFeedItem(trade, new Map());
    expect(item.trade).toBe(trade);
  });
});
