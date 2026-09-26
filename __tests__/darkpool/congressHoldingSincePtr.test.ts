import type { CongressFeedTrade } from '../../services/darkpool/uwCongressFeedService';
import {
  congressHoldingReturnSinceLastPtrBuy,
  lastCongressPurchaseByTicker,
  resolveCongressHoldingDisplayReturnPct,
} from '../../screens/DarkPool/utils/congressHoldingSincePtr';

function trade(
  partial: Partial<CongressFeedTrade> & Pick<CongressFeedTrade, 'ticker' | 'transaction_date'>
): CongressFeedTrade {
  return {
    id: partial.id ?? '1',
    politician_id: 'P000197',
    politician_name: 'Test',
    politician_image_url: null,
    company_name: null,
    transaction_type: partial.transaction_type ?? 'buy',
    shares: null,
    price: null,
    amount_label: '$1,001 - $15,000',
    filed_at: partial.transaction_date,
    txn_label: partial.txn_label ?? 'Purchase',
    source: 'quiverquant',
    excess_return_pct: null,
    price_change_pct: partial.price_change_pct ?? null,
    spy_change_pct: null,
    ...partial,
  };
}

describe('lastCongressPurchaseByTicker', () => {
  it('keeps the latest buy per ticker', () => {
    const map = lastCongressPurchaseByTicker([
      trade({ ticker: 'NVDA', transaction_date: '2024-01-10' }),
      trade({ ticker: 'NVDA', transaction_date: '2024-06-01', price_change_pct: 5 }),
      trade({ ticker: 'NVDA', transaction_date: '2024-03-01', transaction_type: 'sell' }),
      trade({ ticker: 'AAPL', transaction_date: '2024-02-01' }),
    ]);
    expect(map.get('NVDA')?.transactionDate).toBe('2024-06-01');
    expect(map.get('NVDA')?.priceChangePct).toBe(5);
    expect(map.get('AAPL')?.transactionDate).toBe('2024-02-01');
  });
});

describe('congressHoldingReturnSinceLastPtrBuy', () => {
  const bars = [
    { date: '2024-06-01', open: 100 },
    { date: '2024-06-02', open: 101, close: 110 },
  ];

  it('uses open on transaction day vs live', () => {
    expect(
      congressHoldingReturnSinceLastPtrBuy({
        lastPurchase: { transactionDate: '2024-06-01', priceChangePct: null },
        dailyBars: bars,
        livePrice: 110,
      })
    ).toBeCloseTo(10);
  });

  it('falls back to Quiver PriceChange when open missing', () => {
    expect(
      congressHoldingReturnSinceLastPtrBuy({
        lastPurchase: { transactionDate: '2024-06-01', priceChangePct: 7.5 },
        dailyBars: [],
        livePrice: 200,
      })
    ).toBe(7.5);
  });
});

describe('resolveCongressHoldingDisplayReturnPct', () => {
  it('prefers vendor avg cost over PTR open', () => {
    expect(
      resolveCongressHoldingDisplayReturnPct({
        vendorAvgCost: 100,
        livePrice: 115,
        lastPurchase: { transactionDate: '2024-01-01', priceChangePct: 50 },
        dailyBars: [{ date: '2024-01-01', open: 80 }],
      })
    ).toBeCloseTo(15);
  });

  it('does not invent return from CurrentHolding alone', () => {
    expect(
      resolveCongressHoldingDisplayReturnPct({
        currentHoldingUsd: 1_000_000,
        livePrice: 100,
        lastPurchase: null,
        dailyBars: [],
      })
    ).toBeNull();
  });
});
