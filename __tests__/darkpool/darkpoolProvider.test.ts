import {
  getDarkPoolProvider,
  inferSide,
  MockDarkPoolProvider,
  resolveProviderName,
  sanitizeTrade,
} from '../../services/darkpool/darkpoolProvider';
import type { NormalizedDarkPoolTrade } from '../../types/darkpool.types';

describe('darkpoolProvider – primitives', () => {
  describe('inferSide', () => {
    it('returns unknown without bid/ask', () => {
      expect(inferSide(100)).toBe('unknown');
      expect(inferSide(100, null, null)).toBe('unknown');
    });

    it('returns buy when price is near the ask', () => {
      expect(inferSide(101, 99, 101)).toBe('buy');
    });

    it('returns sell when price is near the bid', () => {
      expect(inferSide(99, 99, 101)).toBe('sell');
    });

    it('returns unknown near the mid', () => {
      expect(inferSide(100, 99, 101)).toBe('unknown');
    });
  });

  describe('sanitizeTrade', () => {
    it('rejects missing ticker', () => {
      expect(
        sanitizeTrade(
          { ticker: '', price: 1, size: 1, timestamp: Date.now() },
          'polygon'
        )
      ).toBeNull();
    });

    it('rejects bad price/size/timestamp', () => {
      const t = Date.now();
      expect(sanitizeTrade({ ticker: 'A', price: 0, size: 1, timestamp: t }, 'polygon')).toBeNull();
      expect(sanitizeTrade({ ticker: 'A', price: 1, size: 0, timestamp: t }, 'polygon')).toBeNull();
      expect(sanitizeTrade({ ticker: 'A', price: 1, size: 1, timestamp: 0 }, 'polygon')).toBeNull();
    });

    it('upper-cases the ticker and computes premium', () => {
      const t = sanitizeTrade(
        {
          ticker: 'nvda',
          price: 100,
          size: 1000,
          timestamp: Date.now(),
        },
        'polygon'
      );
      expect(t!.ticker).toBe('NVDA');
      expect(t!.premium).toBe(100_000);
      expect(t!.provider).toBe('polygon');
    });
  });
});

describe('resolveProviderName', () => {
  const originalEnv = process.env.DARK_POOL_PROVIDER;

  afterEach(() => {
    if (originalEnv == null) delete process.env.DARK_POOL_PROVIDER;
    else process.env.DARK_POOL_PROVIDER = originalEnv;
  });

  it('falls back to polygon when env is missing', () => {
    delete process.env.DARK_POOL_PROVIDER;
    expect(resolveProviderName()).toBe('polygon');
  });

  it('accepts unusualwhales', () => {
    process.env.DARK_POOL_PROVIDER = 'unusualwhales';
    expect(resolveProviderName()).toBe('unusualwhales');
  });

  it('falls back to polygon for unknown values', () => {
    process.env.DARK_POOL_PROVIDER = 'someothervendor';
    expect(resolveProviderName()).toBe('polygon');
  });
});

describe('MockDarkPoolProvider', () => {
  const trade = (ts: number, ticker = 'NVDA'): NormalizedDarkPoolTrade => ({
    externalId: `mock:${ts}`,
    ticker,
    companyName: 'NVIDIA',
    timestamp: ts,
    price: 100,
    size: 1000,
    premium: 100_000,
    volume: null,
    side: 'buy',
    exchange: null,
    marketCap: null,
    provider: 'mock',
  });

  it('returns only trades after `since`', async () => {
    const now = Date.now();
    const p = new MockDarkPoolProvider([
      trade(now - 60_000),
      trade(now - 30_000),
      trade(now - 1_000),
    ]);
    const res = await p.fetchTrades({
      since: new Date(now - 45_000).toISOString(),
    });
    expect(res.trades).toHaveLength(2);
    expect(res.lastTimestamp).toBeGreaterThan(0);
  });

  it('filters by ticker when provided', async () => {
    const now = Date.now();
    const p = new MockDarkPoolProvider([
      trade(now - 10_000, 'NVDA'),
      trade(now - 5_000, 'AAPL'),
    ]);
    const res = await p.fetchTrades({
      since: new Date(now - 60_000).toISOString(),
      ticker: 'AAPL',
    });
    expect(res.trades).toHaveLength(1);
    expect(res.trades[0].ticker).toBe('AAPL');
  });

  it('respects the limit', async () => {
    const now = Date.now();
    const p = new MockDarkPoolProvider(
      Array.from({ length: 10 }, (_, i) => trade(now - i * 1_000))
    );
    const res = await p.fetchTrades({
      since: new Date(now - 60_000).toISOString(),
      limit: 3,
    });
    expect(res.trades).toHaveLength(3);
  });
});

describe('getDarkPoolProvider – factory', () => {
  it('returns a mock provider when forced', () => {
    const p = getDarkPoolProvider({ provider: 'mock' });
    expect(p.name).toBe('mock');
  });

  it('returns a polygon provider when requested', () => {
    const p = getDarkPoolProvider({
      provider: 'polygon',
      keys: { polygon: 'test-key' },
    });
    expect(p.name).toBe('polygon');
  });

  it('returns an unusualwhales provider when requested', () => {
    const p = getDarkPoolProvider({
      provider: 'unusualwhales',
      keys: { unusualwhales: 'test-key' },
    });
    expect(p.name).toBe('unusualwhales');
  });
});
