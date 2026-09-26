/**
 * Dual-Engine holdings — Quiver baseline vs Form 4 exact shares.
 * Guards: no STOCK Act midpoints, no PTR range deltas on CurrentHolding.
 */

import type { ActualCongressHolding } from '../../types/darkpool.types';
import {
  HOLDING_TAG_ESTIMATED,
  HOLDING_TAG_EXACT,
  CONGRESS_HOLDINGS_HELP_TITLE,
  CONGRESS_HOLDINGS_HELP_BODY,
  FORM4_HOLDINGS_HELP_BODY,
  buildForm4Holdings,
  buildForm4MarkToMarketSeries,
  buildForm4ValueSeries,
  congressHoldingsFromQuiver,
  form4QtySign,
  form4TradesFromInsiderRows,
  formatCongressDeltaUsd,
  formatCongressPortfolioHeroValue,
  formatCongressValue,
  formatCongressWeight,
  formatForm4Value,
  formatForm4Weight,
  closeOnOrBefore,
  congressHoldingReturnPct,
  filingPriorQuarterReturnPct,
  formatHoldingRowCells,
  formatHoldingRowReturn,
  formatHoldingValue,
  formatHoldingWeight,
  holdingReturnFromEntry,
  tickerMarkToMarketReturnPct,
  isForm4OptionRow,
  replayForm4Positions,
  sumCongressPortfolioValue,
  buildCongressBasketMarkToMarketSeries,
  type CongressModelHolding,
  type Form4TradeInput,
  type InsiderForm4Holding,
} from '../../screens/DarkPool/utils/investorHoldings';

describe('holding honesty tags', () => {
  it('keeps honesty copy behind help, not as a visible משוער stamp', () => {
    expect(CONGRESS_HOLDINGS_HELP_TITLE).toBe('על המספרים');
    expect(CONGRESS_HOLDINGS_HELP_TITLE).not.toBe('משוער');
    expect(CONGRESS_HOLDINGS_HELP_BODY).toMatch(/CurrentHolding/);
    expect(CONGRESS_HOLDINGS_HELP_BODY).toMatch(/PTR/);
    expect(CONGRESS_HOLDINGS_HELP_BODY).toMatch(/לא רווח/);
    expect(CONGRESS_HOLDINGS_HELP_BODY).not.toMatch(/משוער/);
    expect(FORM4_HOLDINGS_HELP_BODY).toMatch(/Form 4/);
    expect(FORM4_HOLDINGS_HELP_BODY).toMatch(/לא כל השווי הנטו/);
    expect(HOLDING_TAG_ESTIMATED).toBe('משוער');
    expect(HOLDING_TAG_EXACT).toBe('מדויק');
  });
});

describe('formatHoldingWeight / formatHoldingValue', () => {
  const congress: CongressModelHolding = {
    type: 'CONGRESS_BASELINE',
    ticker: 'NVDA',
    bioguideId: 'P000197',
    quiverBaselineHoldingUSD: 18_460_942.4,
    quiverAllocationPercent: 11.87,
    isEstimated: true,
  };

  const form4: InsiderForm4Holding = {
    type: 'INSIDER_FORM_4',
    ticker: 'NVDA',
    exactShares: 1000,
    sharePrice: 142.5,
    calculatedValueUSD: 142_500.25,
    exactPortfolioWeight: 86.984,
    avgCost: 100,
    entryReturnPct: 42.5,
    isEstimated: false,
  };

  it('rounds congress weights without a tilde or two-decimal fake precision', () => {
    expect(formatCongressWeight(11.87)).toBe('12%');
    expect(formatHoldingWeight(congress)).toBe('12%');
    expect(formatHoldingWeight(congress)).not.toMatch(/~|11\.87|86\.98|משוער/);
  });

  it('keeps Form 4 weights at two decimals without a tilde', () => {
    expect(formatForm4Weight(86.984)).toBe('86.98%');
    expect(formatHoldingWeight(form4)).toBe('86.98%');
    expect(formatHoldingWeight(form4)).not.toMatch(/^~/);
  });

  it('formats congress values as grouped whole dollars — no K/M/B', () => {
    expect(formatCongressValue(18_460_942.4)).toBe('$18,460,942');
    expect(formatHoldingValue(congress)).toBe('$18,460,942');
    expect(formatCongressValue(842.9)).toBe('$843');
    expect(formatCongressValue(12_400)).toBe('$12,400');
    expect(formatHoldingValue(congress)).not.toMatch(/[KMB](?!\w)/);
    expect(formatHoldingValue(congress)).not.toMatch(/~|משוער/);
  });

  it('formats Form 4 currency as grouped whole dollars — no K/M/B', () => {
    expect(formatForm4Value(142_500.25)).toBe('$142,500');
    expect(formatHoldingValue(form4)).toBe('$142,500');
    expect(formatForm4Value(2_500_000.5)).toBe('$2,500,001');
  });
});

describe('holding row cells — ticker / allocation / value / return', () => {
  it('places Quiver Allocation under the ticker and CurrentHolding opposite, no משוער', () => {
    const cells = formatHoldingRowCells({
      ticker: 'NVDA',
      engine: 'congress',
      allocationPct: 11.87,
      valueUsd: 18_460_942.4,
      returnPct: 12.44,
    });
    expect(cells).toEqual({
      ticker: 'NVDA',
      allocationLabel: '12%',
      valueLabel: '$18,460,942',
      returnLabel: '+12.4%',
    });
    expect(JSON.stringify(cells)).not.toMatch(/משוער|~|1001|1,001|8000|18,460,942\.40/);
  });

  it('uses Form 4 weight among known tickers and shares×price, not a STOCK Act range', () => {
    const cells = formatHoldingRowCells({
      ticker: 'aapl',
      engine: 'form4',
      allocationPct: 86.984,
      valueUsd: 142_500.25,
      returnPct: -3.2,
    });
    expect(cells.ticker).toBe('AAPL');
    expect(cells.allocationLabel).toBe('86.98%');
    expect(cells.valueLabel).toBe('$142,500');
    expect(cells.returnLabel).toBe('−3.2%');
    expect(JSON.stringify(cells)).not.toMatch(/משוער|1,001|15,000|8000/);
  });

  it('hides a missing return as — and never invents one from a midpoint', () => {
    expect(formatHoldingRowReturn(null)).toBe('—');
    expect(formatHoldingRowReturn(undefined)).toBe('—');
    expect(formatHoldingRowReturn(Number.NaN)).toBe('—');
    const empty = formatHoldingRowCells({
      ticker: 'MSFT',
      engine: 'congress',
      allocationPct: 8,
      valueUsd: 1_200_000,
      returnPct: null,
    });
    expect(empty.returnLabel).toBe('—');
    expect(empty.valueLabel).toBe('$1,200,000');
    expect(empty.allocationLabel).toBe('8%');
  });

  it('prints congress row value as whole dollars under $10M, no fake cents', () => {
    const cells = formatHoldingRowCells({
      ticker: 'MSFT',
      engine: 'congress',
      allocationPct: 12,
      valueUsd: 1_204_000,
      returnPct: null,
    });
    expect(cells.valueLabel).toBe('$1,204,000');
    expect(cells.valueLabel).not.toMatch(/\.\d{2}/);
  });
});

describe('tickerMarkToMarketReturnPct', () => {
  it('uses first vs last close only — not a STOCK Act midpoint', () => {
    expect(
      tickerMarkToMarketReturnPct([
        { date: '2026-01-02', close: 100 },
        { date: '2026-01-08', close: 120 },
      ])
    ).toBeCloseTo(20, 5);
    expect(
      tickerMarkToMarketReturnPct([
        { date: '2026-01-02', close: 50 },
        { date: '2026-01-08', close: 40 },
      ])
    ).toBeCloseTo(-20, 5);
    expect(tickerMarkToMarketReturnPct([])).toBeNull();
    expect(tickerMarkToMarketReturnPct([{ date: '2026-01-02', close: 100 }])).toBeNull();
    expect(JSON.stringify(tickerMarkToMarketReturnPct([{ date: '2026-01-02', close: 8000 }]))).not.toMatch(
      /1001|ParsedAmount/
    );
  });
});

describe('congressHoldingReturnPct — now vs as-of / first known, not STOCK Act', () => {
  const series = [
    { date: '2026-01-02', close: 100 },
    { date: '2026-01-06', close: 110 },
    { date: '2026-01-08', close: 120 },
  ];

  it('uses live vs close on first-known date when that price exists', () => {
    expect(congressHoldingReturnPct(series, '2026-01-08', '2026-01-02')).toBeCloseTo(20, 5);
    expect(closeOnOrBefore(series, '2026-01-02')).toBe(100);
    expect(holdingReturnFromEntry(120, 100)).toBeCloseTo(20, 5);
  });

  it('falls back to holdings as-of when first-known is before the series', () => {
    expect(congressHoldingReturnPct(series, '2026-01-06', '2020-01-01')).toBeCloseTo(
      (120 - 110) / 110 * 100,
      5
    );
  });

  it('hides the return when there is no entry price — never 0 from a midpoint', () => {
    expect(congressHoldingReturnPct(series, null, null)).toBeNull();
    expect(congressHoldingReturnPct([], '2026-01-02', null)).toBeNull();
    expect(holdingReturnFromEntry(120, 0)).toBeNull();
    expect(holdingReturnFromEntry(120, null)).toBeNull();
    expect(JSON.stringify(congressHoldingReturnPct(series, '2026-01-02', null))).not.toMatch(
      /1001|8000|ParsedAmount/
    );
  });
});

describe('filingPriorQuarterReturnPct', () => {
  it('returns live vs prior-quarter price, or hides', () => {
    expect(filingPriorQuarterReturnPct(110, 100)).toBeCloseTo(10, 5);
    expect(filingPriorQuarterReturnPct(90, 100)).toBeCloseTo(-10, 5);
    expect(filingPriorQuarterReturnPct(110, null)).toBeNull();
    expect(filingPriorQuarterReturnPct(110, 0)).toBeNull();
  });

  it('formats 13F value from filing market value and hides missing QoQ return', () => {
    const cells = formatHoldingRowCells({
      ticker: 'BRK.B',
      engine: 'filing',
      allocationPct: 12.4,
      valueUsd: 1_204_000,
      returnPct: null,
    });
    expect(cells.valueLabel).toBe('$1,204,000');
    expect(cells.allocationLabel).toBe('12.4%');
    expect(cells.returnLabel).toBe('—');
  });
});

describe('congressHoldingsFromQuiver', () => {
  it('maps CurrentHolding + Allocation and never a STOCK Act midpoint', () => {
    const rows: ActualCongressHolding[] = [
      {
        bioguideId: 'P000197',
        ticker: 'NVDA',
        companyName: null,
        currentValueUSD: 18_460_942.4,
        portfolioPercent: 11.87,
      },
      {
        bioguideId: 'P000197',
        ticker: 'AAPL',
        companyName: null,
        currentValueUSD: 1_200_000,
        portfolioPercent: 8,
      },
    ];
    const holdings = congressHoldingsFromQuiver(rows);
    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({
      type: 'CONGRESS_BASELINE',
      ticker: 'NVDA',
      bioguideId: 'P000197',
      quiverBaselineHoldingUSD: 18_460_942.4,
      isEstimated: true,
    });
    expect(holdings[0].quiverAllocationPercent).toBeCloseTo(11.87, 2);
    expect(holdings[1].quiverAllocationPercent).toBe(8);
    expect(JSON.stringify(holdings)).not.toMatch(/1,001|1001|15000|15,000/);
    expect(holdings.every((h) => h.lastUpdatedFromPTR == null || h.lastUpdatedFromPTR === null)).toBe(
      true
    );
  });

  it('does not invent a pie from empty Quiver rows (Khanna/McCaul trades_only)', () => {
    expect(congressHoldingsFromQuiver([])).toEqual([]);
    expect(
      congressHoldingsFromQuiver([
        {
          bioguideId: 'K000188',
          ticker: '',
          companyName: null,
          currentValueUSD: null,
          portfolioPercent: null,
        },
      ])
    ).toEqual([]);
  });

  it('passes through vendor shares/cost when Quiver sent them — never amount_label qty', () => {
    const holdings = congressHoldingsFromQuiver([
      {
        bioguideId: 'P000197',
        ticker: 'NVDA',
        companyName: null,
        currentValueUSD: 18_460_942.4,
        portfolioPercent: 11.87,
        vendorShares: 80_000,
        vendorAvgCost: 42.5,
      },
    ]);
    expect(holdings[0].vendorShares).toBe(80_000);
    expect(holdings[0].vendorAvgCost).toBe(42.5);
    expect(JSON.stringify(holdings)).not.toMatch(/1,001|\$1,001|amount_label|15,000/);
  });

  it('does not add PTR range midpoints on top of CurrentHolding', () => {
    const baseline = 10_000_000;
    const ptrMidpoint = 8_000; // $1,001–$15,000
    const rows: ActualCongressHolding[] = [
      {
        bioguideId: 'P000197',
        ticker: 'NVDA',
        companyName: null,
        currentValueUSD: baseline,
        portfolioPercent: 40,
      },
    ];
    const holdings = congressHoldingsFromQuiver(rows);
    expect(holdings[0].quiverBaselineHoldingUSD).toBe(baseline);
    expect(holdings[0].quiverBaselineHoldingUSD).not.toBe(baseline + ptrMidpoint);
  });
});

describe('congress portfolio hero value', () => {
  it('sums CurrentHolding and never prints InsiderWave cents', () => {
    const holdings = congressHoldingsFromQuiver([
      {
        bioguideId: 'D000032',
        ticker: 'AAPL',
        companyName: null,
        currentValueUSD: 500_000.4,
        portfolioPercent: 50,
      },
      {
        bioguideId: 'D000032',
        ticker: 'NVDA',
        companyName: null,
        currentValueUSD: 530_228.48,
        portfolioPercent: 50,
      },
    ]);
    const sum = sumCongressPortfolioValue(holdings);
    expect(sum).toBeCloseTo(1_030_228.88, 2);
    expect(formatCongressPortfolioHeroValue(sum)).toBe('$1,030,229');
    expect(formatCongressPortfolioHeroValue(sum)).not.toMatch(/228\.88|1,030,228\.88|~|משוער/);
    expect(formatCongressPortfolioHeroValue(18_460_942)).toBe('$18,460,942');
    expect(formatCongressPortfolioHeroValue(null)).toBe('—');
    expect(sumCongressPortfolioValue([])).toBeNull();
  });

  it('formats basket delta without cents', () => {
    expect(formatCongressDeltaUsd(255_761.26)).toBe('+$255,761');
    expect(formatCongressDeltaUsd(-1200.9)).toBe('−$1,201');
  });
});

describe('congress basket mark-to-market', () => {
  const holdings = congressHoldingsFromQuiver([
    {
      bioguideId: 'D000032',
      ticker: 'AAPL',
      companyName: null,
      currentValueUSD: 1_000,
      portfolioPercent: 50,
    },
    {
      bioguideId: 'D000032',
      ticker: 'NVDA',
      companyName: null,
      currentValueUSD: 1_000,
      portfolioPercent: 50,
    },
  ]);

  it('scales CurrentHolding by ticker price ratios, not STOCK Act midpoints', () => {
    const series = buildCongressBasketMarkToMarketSeries(holdings, {
      AAPL: [
        { date: '2026-01-02', close: 100 },
        { date: '2026-01-03', close: 110 },
        { date: '2026-01-06', close: 110 },
        { date: '2026-01-07', close: 110 },
        { date: '2026-01-08', close: 120 },
      ],
      NVDA: [
        { date: '2026-01-02', close: 50 },
        { date: '2026-01-03', close: 50 },
        { date: '2026-01-06', close: 50 },
        { date: '2026-01-07', close: 50 },
        { date: '2026-01-08', close: 50 },
      ],
    });
    expect(series.length).toBeGreaterThanOrEqual(5);
    expect(series[series.length - 1].value).toBe(sumCongressPortfolioValue(holdings));
    const first = series[0].value;
    // AAPL 100/120 * 1000 + NVDA 50/50 * 1000 = 1833.33
    expect(first).toBeCloseTo(1_000 * (100 / 120) + 1_000, 4);
    expect(JSON.stringify(series)).not.toMatch(/1001|1,001|15000|15,000|8000/);
  });

  it('hides the chart when Quiver holdings are empty (Khanna/McCaul)', () => {
    expect(buildCongressBasketMarkToMarketSeries([], { AAPL: [{ date: '2026-01-02', close: 100 }] })).toEqual(
      []
    );
  });

  it('hides the chart when market prices cover too little of the basket', () => {
    const series = buildCongressBasketMarkToMarketSeries(holdings, {
      AAPL: [
        { date: '2026-01-02', close: 100 },
        { date: '2026-01-03', close: 110 },
        { date: '2026-01-06', close: 120 },
        { date: '2026-01-07', close: 120 },
        { date: '2026-01-08', close: 120 },
      ],
    });
    expect(series).toEqual([]);
  });

  it('keeps a multi-ticker basket when most of the priced book is covered', () => {
    const three = congressHoldingsFromQuiver([
      { bioguideId: 'P000197', ticker: 'NVDA', companyName: null, currentValueUSD: 1_000, portfolioPercent: 40 },
      { bioguideId: 'P000197', ticker: 'AAPL', companyName: null, currentValueUSD: 1_000, portfolioPercent: 40 },
      { bioguideId: 'P000197', ticker: 'MSFT', companyName: null, currentValueUSD: 400, portfolioPercent: 20 },
    ]);
    const series = buildCongressBasketMarkToMarketSeries(three, {
      NVDA: [
        { date: '2026-01-02', close: 100 },
        { date: '2026-01-03', close: 110 },
        { date: '2026-01-06', close: 110 },
        { date: '2026-01-07', close: 110 },
        { date: '2026-01-08', close: 120 },
      ],
      AAPL: [
        { date: '2026-01-02', close: 50 },
        { date: '2026-01-03', close: 50 },
        { date: '2026-01-06', close: 50 },
        { date: '2026-01-07', close: 50 },
        { date: '2026-01-08', close: 50 },
      ],
    });
    expect(series.length).toBeGreaterThanOrEqual(5);
    expect(series[series.length - 1].value).toBe(2_000);
  });

  it('never uses a STOCK Act range midpoint ($8,000 / $1,001–$15,000) as V_t', () => {
    const ptrMidpoint = 8_000;
    const series = buildCongressBasketMarkToMarketSeries(holdings, {
      AAPL: [
        { date: '2026-01-02', close: 100 },
        { date: '2026-01-03', close: 110 },
        { date: '2026-01-06', close: 110 },
        { date: '2026-01-07', close: 110 },
        { date: '2026-01-08', close: 120 },
      ],
      NVDA: [
        { date: '2026-01-02', close: 50 },
        { date: '2026-01-03', close: 50 },
        { date: '2026-01-06', close: 50 },
        { date: '2026-01-07', close: 50 },
        { date: '2026-01-08', close: 50 },
      ],
    });
    expect(series.length).toBeGreaterThanOrEqual(5);
    expect(series.some((p) => p.value === ptrMidpoint)).toBe(false);
    expect(series[series.length - 1].value).toBe(2_000);
    expect(JSON.stringify(series)).not.toMatch(/8000|8,000|1001|ParsedAmount/);
  });
});


describe('Form 4 running shares', () => {
  const trades: Form4TradeInput[] = [
    { ticker: 'NVDA', transaction_date: '2024-01-10', transaction_code: 'P', shares: 100, price: 50 },
    { ticker: 'NVDA', transaction_date: '2024-02-10', transaction_code: 'A', shares: 20, price: null },
    { ticker: 'NVDA', transaction_date: '2024-03-10', transaction_code: 'M', shares: 10, price: 40 },
    { ticker: 'NVDA', transaction_date: '2024-04-10', transaction_code: 'S', shares: 30, price: 80 },
    { ticker: 'NVDA', transaction_date: '2024-05-10', transaction_code: 'F', shares: 5, price: 82 },
    { ticker: 'NVDA', transaction_date: '2024-06-10', transaction_code: 'G', shares: 5, price: null },
  ];

  it('maps shares_owned_after from Form 4 rows without inventing STOCK Act qty', () => {
    const mapped = form4TradesFromInsiderRows([
      {
        id: '1',
        external_id: null,
        ticker: 'AAPL',
        insider_name: 'Cook',
        insider_role: 'CEO',
        transaction_type: 'P',
        shares: 10,
        price: 100,
        value: 1000,
        filed_at: '2024-01-06',
        transaction_date: '2024-01-05',
        source: 'form4api',
        created_at: '2024-01-06',
        shares_owned_after: 500,
        is_option: false,
      },
    ]);
    expect(mapped[0].shares_owned_after).toBe(500);
    expect(mapped[0].shares).toBe(10);
    expect(JSON.stringify(mapped)).not.toMatch(/8000|1001/);
  });

  it('treats P/A/M as add and S/F/G as subtract', () => {
    expect(form4QtySign('P')).toBe(1);
    expect(form4QtySign('A')).toBe(1);
    expect(form4QtySign('M')).toBe(1);
    expect(form4QtySign('S')).toBe(-1);
    expect(form4QtySign('F')).toBe(-1);
    expect(form4QtySign('G')).toBe(-1);
    expect(form4QtySign('J')).toBe(0);
  });

  it('replays running shares without using STOCK Act ranges', () => {
    const pos = replayForm4Positions(trades);
    // 100 + 20 + 10 - 30 - 5 - 5 = 90
    expect(pos.get('NVDA')?.shares).toBe(90);
    expect(pos.get('NVDA')?.lastPrice).toBe(82);
  });

  it('marks a single known ticker as 100% of the reported position, not net worth', () => {
    const holdings = buildForm4Holdings(trades);
    expect(holdings).toHaveLength(1);
    expect(holdings[0].exactShares).toBe(90);
    expect(holdings[0].sharePrice).toBe(82);
    expect(holdings[0].calculatedValueUSD).toBe(90 * 82);
    expect(holdings[0].exactPortfolioWeight).toBe(100);
    expect(holdings[0].isEstimated).toBe(false);
    expect(holdings[0].type).toBe('INSIDER_FORM_4');
    expect(holdings[0].entryReturnPct).toBeNull();
  });

  it('weights multiple Form 4 tickers by calculated value', () => {
    const mixed: Form4TradeInput[] = [
      { ticker: 'AAPL', transaction_date: '2024-01-01', transaction_code: 'P', shares: 10, price: 100 },
      { ticker: 'MSFT', transaction_date: '2024-01-02', transaction_code: 'P', shares: 5, price: 200 },
    ];
    const holdings = buildForm4Holdings(mixed);
    expect(holdings).toHaveLength(2);
    const aapl = holdings.find((h) => h.ticker === 'AAPL');
    const msft = holdings.find((h) => h.ticker === 'MSFT');
    expect(aapl?.exactPortfolioWeight).toBeCloseTo(50, 5);
    expect(msft?.exactPortfolioWeight).toBeCloseTo(50, 5);
  });

  it('prefers a quote over last-trade price when provided', () => {
    const holdings = buildForm4Holdings(trades, new Map([['NVDA', 100]]));
    expect(holdings[0].sharePrice).toBe(100);
    expect(holdings[0].calculatedValueUSD).toBe(9000);
  });

  it('computes entry return from running Form 4 cost basis, not a 1y tape move', () => {
    const bought = buildForm4Holdings([
      { ticker: 'AAPL', transaction_date: '2024-01-05', transaction_code: 'P', shares: 100, price: 50 },
    ], new Map([['AAPL', 80]]));
    expect(bought[0].avgCost).toBe(50);
    expect(bought[0].entryReturnPct).toBeCloseTo(60, 5);
  });

  it('hides return when remaining basis is $0 (grant) so ROI is not infinite', () => {
    const grant = buildForm4Holdings([
      { ticker: 'AAPL', transaction_date: '2024-01-05', transaction_code: 'A', shares: 100, price: null },
    ], new Map([['AAPL', 80]]));
    expect(grant[0].exactShares).toBe(100);
    expect(grant[0].avgCost).toBeNull();
    expect(grant[0].entryReturnPct).toBeNull();
    expect(holdingReturnFromEntry(80, 0)).toBeNull();
  });

  it('hides return when shares_owned_after seeds unknown prior lots', () => {
    const seeded = buildForm4Holdings([
      {
        ticker: 'AAPL',
        transaction_date: '2024-01-05',
        transaction_code: 'P',
        shares: 10,
        price: 100,
        shares_owned_after: 500,
      },
    ], new Map([['AAPL', 120]]));
    expect(seeded[0].exactShares).toBe(500);
    expect(seeded[0].entryReturnPct).toBeNull();
  });

  it('builds a running history series from qty × last trade price', () => {
    const series = buildForm4ValueSeries(trades);
    expect(series.length).toBeGreaterThanOrEqual(2);
    expect(series[series.length - 1].value).toBe(90 * 82);
    expect(series[0].date).toBe('2024-01-10');
  });

  it('updates shares after a Form 4 buy then sell', () => {
    const pos = replayForm4Positions([
      { ticker: 'AAPL', transaction_date: '2024-01-05', transaction_code: 'P', shares: 100, price: 10 },
      { ticker: 'AAPL', transaction_date: '2024-01-08', transaction_code: 'S', shares: 40, price: 12 },
    ]);
    expect(pos.get('AAPL')?.shares).toBe(60);
  });

  it('seeds running shares from the first shares_owned_after, then applies later P/S', () => {
    const pos = replayForm4Positions([
      {
        ticker: 'AAPL',
        transaction_date: '2024-01-05',
        transaction_code: 'P',
        shares: 10,
        price: 10,
        shares_owned_after: 500,
      },
      { ticker: 'AAPL', transaction_date: '2024-01-08', transaction_code: 'S', shares: 50, price: 12 },
    ]);
    expect(pos.get('AAPL')?.shares).toBe(450);
  });

  it('excludes option contracts from equity V_t', () => {
    expect(isForm4OptionRow({ is_option: true })).toBe(true);
    expect(isForm4OptionRow({ security: 'Call Option' })).toBe(true);
    expect(isForm4OptionRow({ security: 'Common Stock' })).toBe(false);
    const pos = replayForm4Positions([
      { ticker: 'AAPL', transaction_date: '2024-01-05', transaction_code: 'P', shares: 100, price: 10 },
      {
        ticker: 'AAPL',
        transaction_date: '2024-01-06',
        transaction_code: 'P',
        shares: 50,
        price: 2,
        is_option: true,
        security: 'Employee Stock Option',
      },
    ]);
    expect(pos.get('AAPL')?.shares).toBe(100);
  });
});

describe('Form 4 mark-to-market on trading days', () => {
  it('plots Friday and Monday only — weekend is not a fake flat session', () => {
    const trades: Form4TradeInput[] = [
      { ticker: 'AAPL', transaction_date: '2024-01-05', transaction_code: 'P', shares: 100, price: 10 },
    ];
    const series = buildForm4MarkToMarketSeries(trades, {
      AAPL: [
        { date: '2024-01-05', close: 10 },
        { date: '2024-01-08', close: 12 },
      ],
    });
    const byDate = Object.fromEntries(series.map((p) => [p.date, p.value]));
    expect(byDate['2024-01-05']).toBe(1000);
    expect(byDate['2024-01-06']).toBeUndefined();
    expect(byDate['2024-01-07']).toBeUndefined();
    expect(byDate['2024-01-08']).toBe(1200);
  });

  it('marks to market after buy then sell on session days, not a STOCK Act midpoint', () => {
    const trades: Form4TradeInput[] = [
      { ticker: 'AAPL', transaction_date: '2024-01-05', transaction_code: 'P', shares: 100, price: 10 },
      { ticker: 'AAPL', transaction_date: '2024-01-08', transaction_code: 'S', shares: 40, price: 12 },
    ];
    const series = buildForm4MarkToMarketSeries(trades, {
      AAPL: [
        { date: '2024-01-05', close: 10 },
        { date: '2024-01-08', close: 12 },
      ],
    });
    const fri = series.find((p) => p.date === '2024-01-05');
    const sat = series.find((p) => p.date === '2024-01-06');
    const mon = series.find((p) => p.date === '2024-01-08');
    expect(fri?.value).toBe(100 * 10);
    expect(sat).toBeUndefined();
    expect(mon?.value).toBe(60 * 12);
    expect(JSON.stringify(series)).not.toMatch(/8000|1001|ParsedAmount/);
  });

  it('does not invent a split factor when the price series has none', () => {
    const trades: Form4TradeInput[] = [
      { ticker: 'AAPL', transaction_date: '2024-01-05', transaction_code: 'P', shares: 100, price: 10 },
    ];
    const series = buildForm4MarkToMarketSeries(trades, {
      AAPL: [
        { date: '2024-01-05', close: 10 },
        { date: '2024-01-08', close: 20 },
      ],
    });
    // 2× close without a split event stays 100 shares × 20, not 200 × 20
    expect(series.find((p) => p.date === '2024-01-08')?.value).toBe(2000);
    expect(replayForm4Positions(trades).get('AAPL')?.shares).toBe(100);
  });
});

