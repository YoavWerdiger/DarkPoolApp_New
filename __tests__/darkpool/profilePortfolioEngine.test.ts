import {
  buildProfileHoldings,
  buildProfilePortfolioMetrics,
  buildProfileValueSeries,
  computeHoldingsConcentration,
  computeProfileScore,
  enrichProfilePortfolioMetrics,
  replayProfilePositions,
  type ProfileTradeInput,
} from '../../services/darkpool/profilePortfolioEngine';

function mockPrices(
  ticker: string,
  startDate: string,
  days: number,
  startPrice: number,
  dailyReturn = 0.001
): Map<string, number> {
  const map = new Map<string, number>();
  let price = startPrice;
  const d = new Date(startDate);
  for (let i = 0; i < days; i++) {
    map.set(d.toISOString().slice(0, 10), price);
    price *= 1 + dailyReturn;
    d.setDate(d.getDate() + 1);
  }
  return map;
}

describe('profilePortfolioEngine', () => {
  const trades: ProfileTradeInput[] = [
    {
      date: '2024-01-10',
      ticker: 'AAPL',
      side: 'buy',
      amountUsd: 10_000,
      price: 100,
      qty: 100,
    },
    {
      date: '2024-02-10',
      ticker: 'MSFT',
      side: 'buy',
      amountUsd: 5_000,
      price: 200,
      qty: 25,
    },
  ];

  const pricesByTicker = new Map<string, Map<string, number>>([
    ['AAPL', mockPrices('AAPL', '2024-01-01', 120, 100, 0.002)],
    ['MSFT', mockPrices('MSFT', '2024-01-01', 120, 200, 0.001)],
  ]);

  it('replays positions with avg cost', () => {
    const pos = replayProfilePositions(trades);
    expect(pos.get('AAPL')?.qty).toBeCloseTo(100);
    expect(pos.get('AAPL')?.cost).toBeCloseTo(10_000);
    expect(pos.get('MSFT')?.qty).toBeCloseTo(25);
  });

  it('builds daily value series', () => {
    const series = buildProfileValueSeries(trades, pricesByTicker);
    expect(series.length).toBeGreaterThan(10);
    expect(series[series.length - 1].value).toBeGreaterThan(15_000);
  });

  it('computes holdings with allocation', () => {
    const pos = replayProfilePositions(trades);
    const holdings = buildProfileHoldings(pos, pricesByTicker);
    expect(holdings.length).toBe(2);
    const totalAlloc = holdings.reduce((s, h) => s + h.allocation_pct, 0);
    expect(totalAlloc).toBeCloseTo(100, 0);
  });

  it('tracks first_added_date per open position', () => {
    const withReopen: ProfileTradeInput[] = [
      ...trades,
      {
        date: '2024-03-01',
        ticker: 'AAPL',
        side: 'sell',
        amountUsd: 10_000,
        price: 110,
        qty: 100,
      },
      {
        date: '2024-04-01',
        ticker: 'AAPL',
        side: 'buy',
        amountUsd: 5_000,
        price: 120,
        qty: 40,
      },
    ];
    const pos = replayProfilePositions(withReopen);
    expect(pos.get('AAPL')?.first_added_date).toBe('2024-04-01');
    expect(pos.get('MSFT')?.first_added_date).toBe('2024-02-10');
    const holdings = buildProfileHoldings(pos, pricesByTicker);
    const aapl = holdings.find((h) => h.ticker === 'AAPL');
    expect(aapl?.first_added_date).toBe('2024-04-01');
    expect(typeof aapl?.return_pct).toBe('number');
  });

  it('computes concentration HHI', () => {
    const conc = computeHoldingsConcentration([
      {
        ticker: 'AAPL',
        qty: 1,
        cost_usd: 100,
        current_price: 100,
        market_value: 70,
        allocation_pct: 70,
        return_pct: 0,
      },
      {
        ticker: 'MSFT',
        qty: 1,
        cost_usd: 100,
        current_price: 100,
        market_value: 30,
        allocation_pct: 30,
        return_pct: 0,
      },
    ]);
    expect(conc.hhi).toBeCloseTo(0.58, 1);
    expect(conc.top3_pct).toBe(100);
  });

  it('builds full metrics with risk and score', () => {
    const metrics = buildProfilePortfolioMetrics({
      trades,
      pricesByTicker,
      winRate: 60,
    });
    expect(metrics.portfolio_value).toBeGreaterThan(15_000);
    expect(metrics.holdings.length).toBe(2);
    expect(metrics.risk?.sharpe).not.toBeNull();
    expect(metrics.score?.total).toBeGreaterThan(0);
    expect(metrics.score?.total).toBeLessThanOrEqual(100);
  });

  it('enriches legacy metrics without risk/score', () => {
    const enriched = enrichProfilePortfolioMetrics({
      portfolio_value: 20_000,
      total_cost: 15_000,
      total_return_usd: 5_000,
      total_return_pct: 33.3,
      series: [
        { date: '2024-01-01', value: 15_000 },
        { date: '2024-06-01', value: 20_000 },
      ],
      holdings: [
        {
          ticker: 'AAPL',
          qty: 100,
          cost_usd: 15_000,
          current_price: 200,
          market_value: 20_000,
          allocation_pct: 100,
          return_pct: 33.3,
        },
      ],
      period_returns: { ALL: 33.3 },
      win_rate: 55,
      avg_delay_days: 10,
      trade_count: 5,
    });
    expect(enriched.risk?.max_drawdown_pct).not.toBeUndefined();
    expect(enriched.score?.total).toBeGreaterThan(0);
  });

  it('profile score favors diversification', () => {
    const concentrated = computeProfileScore({
      totalReturnPct: 20,
      winRate: 50,
      sharpe: 1,
      hhi: 0.95,
      tradeCount: 10,
    });
    const diversified = computeProfileScore({
      totalReturnPct: 20,
      winRate: 50,
      sharpe: 1,
      hhi: 0.25,
      tradeCount: 10,
    });
    expect(diversified.total).toBeGreaterThan(concentrated.total);
  });
});
