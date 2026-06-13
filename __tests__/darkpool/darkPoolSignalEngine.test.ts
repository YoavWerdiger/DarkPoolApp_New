import {
  detectSignals,
  detectHiddenAccumulation,
  detectInsiderConfluence,
  detectUnusualVolume,
  detectSweep,
  type SignalDetectionInput,
} from '../../services/darkpool/darkPoolSignalEngine';
import type {
  InsiderBuyRow,
  NormalizedDarkPoolTrade,
} from '../../types/darkpool.types';

function mkTrade(
  partial: Partial<NormalizedDarkPoolTrade> = {}
): NormalizedDarkPoolTrade {
  const price = partial.price ?? 100;
  const size = partial.size ?? 1000;
  return {
    externalId: partial.externalId ?? null,
    ticker: partial.ticker ?? 'NVDA',
    companyName: partial.companyName ?? 'NVIDIA',
    timestamp: partial.timestamp ?? Date.UTC(2025, 0, 1, 14, 30, 0),
    price,
    size,
    premium: partial.premium ?? price * size,
    volume: partial.volume ?? null,
    side: partial.side ?? 'buy',
    exchange: partial.exchange ?? null,
    marketCap: partial.marketCap ?? null,
    provider: partial.provider ?? 'mock',
  };
}

function mkInsider(
  partial: Partial<InsiderBuyRow> = {}
): InsiderBuyRow {
  const transactionDate =
    partial.transaction_date ??
    new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    id: partial.id ?? 'i1',
    external_id: partial.external_id ?? null,
    ticker: partial.ticker ?? 'NVDA',
    insider_name: partial.insider_name ?? 'Jensen Huang',
    insider_role: partial.insider_role ?? 'CEO',
    transaction_type: partial.transaction_type ?? 'P',
    shares: partial.shares ?? 10000,
    price: partial.price ?? 100,
    value: partial.value ?? 1_000_000,
    filed_at: partial.filed_at ?? new Date().toISOString(),
    transaction_date: transactionDate,
    source: partial.source ?? 'form4',
    created_at: partial.created_at ?? new Date().toISOString(),
  };
}

function baseInput(
  overrides: Partial<SignalDetectionInput> = {}
): SignalDetectionInput {
  return {
    ticker: 'NVDA',
    companyName: 'NVIDIA',
    marketCap: 3_000_000_000_000,
    newTrades: [],
    trailing3dTrades: [],
    avg30dPremium: 1_000_000,
    todayPremium: 0,
    recentInsiderBuys: [],
    recent72hSignals: 0,
    ...overrides,
  };
}

describe('detectUnusualVolume', () => {
  it('returns null when no historic average', () => {
    expect(detectUnusualVolume(50_000_000, null, baseInput())).toBeNull();
    expect(detectUnusualVolume(50_000_000, 0, baseInput())).toBeNull();
  });

  it('returns null when ratio is below the 300% threshold', () => {
    expect(detectUnusualVolume(2_500_000, 1_000_000, baseInput())).toBeNull();
  });

  it('detects when today >= 3× the 30d average', () => {
    const sig = detectUnusualVolume(
      4_000_000,
      1_000_000,
      baseInput({ recent72hSignals: 0 })
    );
    expect(sig).toBeTruthy();
    expect(sig!.signal_type).toBe('UNUSUAL_VOLUME');
    expect(sig!.metrics.relative_volume).toBeCloseTo(4, 2);
  });
});

describe('detectSweep', () => {
  it('returns null with fewer than 4 prints', () => {
    const trades = [mkTrade(), mkTrade({ timestamp: Date.UTC(2025, 0, 1, 14, 30, 30) })];
    expect(detectSweep(baseInput({ newTrades: trades }))).toBeNull();
  });

  it('detects 4+ prints within 5 minutes summing > $500k', () => {
    const base = Date.UTC(2025, 0, 1, 14, 30, 0);
    const trades = [0, 60_000, 120_000, 180_000].map((delta) =>
      mkTrade({ timestamp: base + delta, price: 200, size: 1000, premium: 200_000 })
    );
    const sig = detectSweep(baseInput({ newTrades: trades }));
    expect(sig).toBeTruthy();
    expect(sig!.signal_type).toBe('SWEEP');
    expect(sig!.metrics.prints).toBe(4);
  });

  it('ignores low-premium spam', () => {
    const base = Date.UTC(2025, 0, 1, 14, 30, 0);
    const trades = [0, 30_000, 60_000, 90_000].map((d) =>
      mkTrade({ timestamp: base + d, price: 10, size: 100, premium: 1_000 })
    );
    expect(detectSweep(baseInput({ newTrades: trades }))).toBeNull();
  });
});

describe('detectHiddenAccumulation', () => {
  it('returns null with negative net flow', () => {
    const newTrades = [mkTrade({ side: 'sell', premium: 800_000 })];
    expect(
      detectHiddenAccumulation(baseInput({ newTrades }), 0, 800_000)
    ).toBeNull();
  });

  it('returns null when total flow is too small', () => {
    const newTrades = [mkTrade({ side: 'buy', premium: 10_000 })];
    expect(
      detectHiddenAccumulation(baseInput({ newTrades }), 10_000, 0)
    ).toBeNull();
  });

  it('detects buy-heavy 3-day accumulation', () => {
    const newTrades = [
      mkTrade({ side: 'buy', premium: 800_000 }),
      mkTrade({ side: 'sell', premium: 100_000 }),
    ];
    const sig = detectHiddenAccumulation(
      baseInput({ newTrades }),
      800_000,
      100_000
    );
    expect(sig).toBeTruthy();
    expect(sig!.signal_type).toBe('HIDDEN_ACCUMULATION');
  });
});

describe('detectInsiderConfluence', () => {
  it('returns null when there are no insider buys', () => {
    const accum = {
      ticker: 'NVDA',
      signal_type: 'HIDDEN_ACCUMULATION' as const,
      score: 60,
      reason: 'x',
      metrics: { premium_total: 2_000_000, relative_volume: 5 },
    };
    expect(
      detectInsiderConfluence(baseInput(), accum, [])
    ).toBeNull();
  });

  it('returns null when there is no accumulation or whale', () => {
    expect(
      detectInsiderConfluence(
        baseInput({ recentInsiderBuys: [mkInsider()] }),
        null,
        []
      )
    ).toBeNull();
  });

  it('detects confluence when both ingredients are present', () => {
    const accum = {
      ticker: 'NVDA',
      signal_type: 'HIDDEN_ACCUMULATION' as const,
      score: 60,
      reason: 'x',
      metrics: { premium_total: 2_000_000, relative_volume: 5 },
    };
    const sig = detectInsiderConfluence(
      baseInput({ recentInsiderBuys: [mkInsider()] }),
      accum,
      []
    );
    expect(sig).toBeTruthy();
    expect(sig!.signal_type).toBe('INSIDER_DARKPOOL_CONFLUENCE');
    expect(sig!.metrics.insider_name).toBe('Jensen Huang');
  });

  it('does not produce confluence when insider is older than 30 days', () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const insider = mkInsider({ transaction_date: oldDate });
    const accum = {
      ticker: 'NVDA',
      signal_type: 'HIDDEN_ACCUMULATION' as const,
      score: 60,
      reason: 'x',
      metrics: { premium_total: 2_000_000 },
    };
    expect(
      detectInsiderConfluence(
        baseInput({ recentInsiderBuys: [insider] }),
        accum,
        []
      )
    ).toBeNull();
  });
});

describe('detectSignals – integration', () => {
  it('returns empty array when there are no new trades', () => {
    expect(detectSignals(baseInput())).toEqual([]);
  });

  it('produces WHALE for a single >$1M print', () => {
    const trades = [
      mkTrade({ price: 500, size: 5_000, premium: 2_500_000, side: 'buy' }),
    ];
    const signals = detectSignals(baseInput({ newTrades: trades }));
    const whale = signals.find((s) => s.signal_type === 'WHALE');
    expect(whale).toBeTruthy();
    expect(whale!.metrics.whale_count).toBe(1);
  });

  it('produces UNUSUAL_VOLUME + WHALE together when conditions allow', () => {
    const trades = [
      mkTrade({ price: 500, size: 10_000, premium: 5_000_000, side: 'buy' }),
    ];
    const signals = detectSignals(
      baseInput({
        newTrades: trades,
        avg30dPremium: 1_000_000,
        todayPremium: 0,
      })
    );
    const types = signals.map((s) => s.signal_type);
    expect(types).toEqual(expect.arrayContaining(['WHALE', 'UNUSUAL_VOLUME']));
  });

  it('deduplicates by signal type and keeps the highest score', () => {
    const trades = [
      mkTrade({ price: 500, size: 10_000, premium: 5_000_000, side: 'buy' }),
      mkTrade({ price: 600, size: 8_000, premium: 4_800_000, side: 'buy' }),
    ];
    const signals = detectSignals(baseInput({ newTrades: trades }));
    const whaleCount = signals.filter((s) => s.signal_type === 'WHALE').length;
    expect(whaleCount).toBeLessThanOrEqual(1);
  });

  it('emits INSIDER_DARKPOOL_CONFLUENCE when accumulation + insider exist', () => {
    const trades = [
      mkTrade({ side: 'buy', premium: 800_000 }),
      mkTrade({ side: 'sell', premium: 50_000 }),
    ];
    const signals = detectSignals(
      baseInput({
        newTrades: trades,
        recentInsiderBuys: [mkInsider()],
      })
    );
    const conflu = signals.find((s) => s.signal_type === 'INSIDER_DARKPOOL_CONFLUENCE');
    expect(conflu).toBeTruthy();
    expect(conflu!.metrics.insider_name).toBe('Jensen Huang');
  });
});
