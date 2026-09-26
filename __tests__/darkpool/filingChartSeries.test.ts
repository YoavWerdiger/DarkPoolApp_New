import {
  build13FMarkToMarketSeries,
  latestBookRowsFromHoldings,
  scale13FChartToReportedBook,
  select13FPriceTickers,
  type Filing13FRow,
} from '../../screens/DarkPool/utils/filingChartSeries';
import {
  filterChartSeriesByPeriod,
  SNAPSHOT_CHART_PERIODS,
  snapshotChartEmptyCopy,
} from '../../screens/DarkPool/utils/profileChartSeries';
import { readFileSync } from 'fs';
import { join } from 'path';

function daily(tickerCloses: Record<string, Array<[string, number]>>) {
  const out: Record<string, Array<{ date: string; close: number }>> = {};
  for (const [ticker, pts] of Object.entries(tickerCloses)) {
    out[ticker] = pts.map(([date, close]) => ({ date, close }));
  }
  return out;
}

const WEEK = [
  '2024-01-02',
  '2024-01-03',
  '2024-01-04',
  '2024-01-05',
  '2024-01-08',
  '2024-01-09',
  '2024-01-10',
];

describe('13F mark-to-market series', () => {
  const rows: Filing13FRow[] = [
    { filing_date: '2024-01-02', ticker: 'TSLA', shares: 100, value_usd: 10_000 },
    { filing_date: '2024-01-02', ticker: 'COIN', shares: 50, value_usd: 5_000 },
    { filing_date: '2024-03-31', ticker: 'TSLA', shares: 80, value_usd: 12_000 },
    { filing_date: '2024-03-31', ticker: 'COIN', shares: 50, value_usd: 6_000 },
  ];

  it('marks the last 13F book to each trading-day close (shares × price)', () => {
    const prices = daily({
      TSLA: WEEK.map((d, i) => [d, 100 + i * 2]),
      COIN: WEEK.map((d) => [d, 100]),
    });
    const series = build13FMarkToMarketSeries(rows, prices);
    expect(series.length).toBeGreaterThanOrEqual(5);
    expect(series.every((p) => WEEK.includes(p.date))).toBe(true);
    expect(series.some((p) => p.date === '2024-01-06')).toBe(false);
    // 100*100 + 50*100 = 15_000 on first day
    expect(series[0].value).toBe(15_000);
    const lastJan = series.find((p) => p.date === '2024-01-10');
    expect(lastJan?.value).toBe(100 * 112 + 50 * 100);
  });

  it('switches the book on the next filing instead of interpolating two AUM points', () => {
    const dates = [
      ...WEEK,
      '2024-03-28',
      '2024-03-29',
      '2024-04-01',
      '2024-04-02',
    ];
    const prices = daily({
      TSLA: dates.map((d) => [d, 150]),
      COIN: dates.map((d) => [d, 120]),
    });
    const series = build13FMarkToMarketSeries(rows, prices);
    const before = series.find((p) => p.date === '2024-03-29');
    const after = series.find((p) => p.date === '2024-04-01');
    expect(before?.value).toBe(100 * 150 + 50 * 120);
    expect(after?.value).toBe(80 * 150 + 50 * 120);
    expect(after!.value).not.toBe(before!.value);
  });

  it('scales reported value when shares are missing — still per ticker, not a midpoint', () => {
    const valued: Filing13FRow[] = [
      { filing_date: '2024-01-02', ticker: 'ARKK', shares: null, value_usd: 1_000 },
      { filing_date: '2024-01-02', ticker: 'ARKG', shares: null, value_usd: 1_000 },
    ];
    const prices = daily({
      ARKK: WEEK.map((d, i) => [d, 10 + i]),
      ARKG: WEEK.map((d) => [d, 20]),
    });
    const series = build13FMarkToMarketSeries(valued, prices);
    expect(series.length).toBeGreaterThanOrEqual(5);
    const last = series[series.length - 1];
    // ARKK 16/10 * 1000 + ARKG 20/20 * 1000
    expect(last.value).toBeCloseTo(1_000 * (16 / 10) + 1_000, 5);
    expect(JSON.stringify(series)).not.toMatch(/1001|15,000|8000/);
  });

  it('returns empty when there are no holdings or no prices', () => {
    expect(build13FMarkToMarketSeries([], { TSLA: [{ date: '2024-01-02', close: 1 }] })).toEqual(
      []
    );
    expect(
      build13FMarkToMarketSeries(
        [{ filing_date: '2024-01-02', ticker: 'TSLA', shares: 10, value_usd: 100 }],
        {}
      )
    ).toEqual([]);
  });

  it('scales partial MTM book to reported 13F total', () => {
    const series = [
      { date: '2024-01-02', value: 100_000_000 },
      { date: '2024-01-10', value: 110_000_000 },
    ];
    const scaled = scale13FChartToReportedBook(series, 165_000_000);
    expect(scaled[1].value).toBeCloseTo(165_000_000, 0);
  });

  it('picks the latest book plus repeat names for Yahoo — not every tiny line', () => {
    const many: Filing13FRow[] = [];
    for (let i = 0; i < 50; i++) {
      many.push({
        filing_date: '2024-01-02',
        ticker: `T${String(i).padStart(2, '0')}`,
        shares: 1,
        value_usd: 50 - i,
      });
    }
    const tickers = select13FPriceTickers(many, 10);
    expect(tickers).toHaveLength(10);
    expect(tickers[0]).toBe('T00');
    expect(tickers).not.toContain('T40');
  });
});

describe('snapshot intervals', () => {
  it('exposes 1D / 1W / 1M / YTD / 1Y / 5Y like a live portfolio chart', () => {
    expect(SNAPSHOT_CHART_PERIODS).toEqual([
      '1D',
      '1W',
      '1M',
      '3M',
      'YTD',
      '1Y',
      '5Y',
      'All',
    ]);
  });

  it('keeps a month of trading-day MTM on 1M, not two 13F filing endpoints', () => {
    const iso = (offsetDays: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().slice(0, 10);
    };
    const days: string[] = [];
    for (let i = -80; i <= 0; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      days.push(d.toISOString().slice(0, 10));
    }
    const rows: Filing13FRow[] = [
      { filing_date: iso(-90), ticker: 'TSLA', shares: 100, value_usd: 10_000 },
      { filing_date: iso(-10), ticker: 'TSLA', shares: 80, value_usd: 12_000 },
    ];
    const prices = daily({
      TSLA: days.map((d, i) => [d, 100 + i]),
    });
    const series = build13FMarkToMarketSeries(rows, prices);
    const sliced = filterChartSeriesByPeriod(
      series.map((p) => ({ date: p.date, value: p.value })),
      '1M'
    );
    expect(series.length).toBeGreaterThanOrEqual(20);
    expect(sliced.length).toBeGreaterThanOrEqual(15);
    expect(sliced.length).not.toBe(2);
  });

  it('anchors a short window to the last point before the cutoff instead of the full series', () => {
    const iso = (offsetDays: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().slice(0, 10);
    };
    const series = [
      { date: iso(-200), value: 100 },
      { date: iso(-80), value: 110 },
      { date: iso(-1), value: 120 },
      { date: iso(0), value: 122 },
    ];
    const sliced = filterChartSeriesByPeriod(series, '1D');
    expect(sliced.length).toBeGreaterThanOrEqual(2);
    expect(sliced[sliced.length - 1].date).toBe(iso(0));
    expect(sliced[0].date >= iso(-80)).toBe(true);
    expect(sliced.length).toBeLessThan(series.length);
  });

  it('keeps ~20 session days on 1M and does not fall back to the full daily book', () => {
    const days: string[] = [];
    for (let i = -400; i <= 0; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      days.push(d.toISOString().slice(0, 10));
    }
    const series = days.map((date, i) => ({ date, value: 100 + i }));
    const oneD = filterChartSeriesByPeriod(series, '1D');
    const oneW = filterChartSeriesByPeriod(series, '1W');
    const oneM = filterChartSeriesByPeriod(series, '1M');
    const oneY = filterChartSeriesByPeriod(series, '1Y');
    expect(oneD).toHaveLength(2);
    expect(oneW.length).toBeGreaterThanOrEqual(4);
    expect(oneW.length).toBeLessThan(oneM.length);
    expect(oneM.length).toBeGreaterThanOrEqual(18);
    expect(oneM.length).toBeLessThanOrEqual(24);
    expect(oneY.length).toBeGreaterThan(oneM.length);
    expect(oneD.length).not.toBe(series.length);
    expect(oneM.length).not.toBe(series.length);
  });

  it('marks the latest 13F book across daily closes when history is missing', () => {
    const prices = daily({
      TSLA: WEEK.map((d, i) => [d, 100 + i * 2]),
    });
    const rows = latestBookRowsFromHoldings(
      [{ ticker: 'TSLA', shares: 10, value_usd: 1_000 }],
      '2024-01-02'
    );
    expect(rows[0]?.filing_date).toBe('2024-01-02');
    const series = build13FMarkToMarketSeries(rows, prices);
    expect(series.length).toBeGreaterThanOrEqual(5);
    expect(series[0].value).toBe(10 * 100);
    expect(series[series.length - 1].value).toBe(10 * 112);
  });

  it('fetches congress / 13F closes as 5y daily — never Yahoo max', () => {
    const src = readFileSync(
      join(__dirname, '../../screens/DarkPool/utils/congressBasketPrices.ts'),
      'utf8'
    );
    expect(src).toMatch(/interval: '1d'/);
    expect(src).toMatch(/fetchDailyClosesForTickers\(tickers, '5y'\)/);
    expect(src).not.toMatch(/getHistoricalPrices\([^)]*'max'/);
  });

  it('wires person-profile chips to setPeriod on a daily series', () => {
    const profileSrc = readFileSync(
      join(__dirname, '../../screens/DarkPool/PersonPortfolioProfileScreen.tsx'),
      'utf8'
    );
    expect(profileSrc).toMatch(/onPeriodChange=\{setPeriod\}/);
    expect(profileSrc).toMatch(/selectedPeriod=\{period\}/);
    expect(profileSrc).toMatch(/periods=\{SNAPSHOT_CHART_PERIODS\}/);
    expect(profileSrc).toMatch(/latestBookRowsFromHoldings/);
    expect(profileSrc).toMatch(/filterChartSeriesByPeriod\(chartSeries, period\)/);
  });

  it('keeps honest empty copy — no invented AUM', () => {
    expect(
      snapshotChartEmptyCopy({
        kind: 'politician',
        holdingsEngine: 'congress',
        hasHoldings: false,
      })
    ).toMatch(/אין אחזקות/);
    expect(
      snapshotChartEmptyCopy({
        kind: 'fund_manager',
        holdingsEngine: 'filing',
        hasHoldings: false,
      })
    ).toMatch(/13F/);
    expect(
      snapshotChartEmptyCopy({
        kind: 'insider',
        holdingsEngine: 'form4',
        hasHoldings: true,
      })
    ).toMatch(/Form 4/);
  });
});
