import {
  TRUMP_PERSON_ID,
  buildTrumpHoldings,
  buildTrumpMarkToMarketSeries,
  formatExactUsdLabel,
  isTrumpPerson,
  parseExactUsdAmount,
  replayTrumpLots,
  sumTrumpPortfolioValue,
  trumpTradesFromRows,
} from '../../screens/DarkPool/utils/trumpHoldings';
import { formatHoldingRowCells } from '../../screens/DarkPool/utils/investorHoldings';

describe('isTrumpPerson', () => {
  it('matches the executive roster id and Donald Trump names', () => {
    expect(isTrumpPerson(TRUMP_PERSON_ID)).toBe(true);
    expect(isTrumpPerson('888dc73f-f1eb-485a-a241-80657aaaaff9', 'Nancy Pelosi')).toBe(
      true
    );
    expect(isTrumpPerson(undefined, 'Donald Trump')).toBe(true);
    expect(isTrumpPerson('', 'Donald J. Trump')).toBe(true);
    expect(isTrumpPerson('P000197', 'Donald Trump')).toBe(false);
    expect(isTrumpPerson('P000197', 'Nancy Pelosi')).toBe(false);
  });
});

describe('parseExactUsdAmount', () => {
  it('parses a real trumpstocktrades dollar amount', () => {
    expect(parseExactUsdAmount('$2,500,000')).toBe(2_500_000);
    expect(parseExactUsdAmount('2500000')).toBe(2_500_000);
    expect(formatExactUsdLabel('$2,500,000')).toMatch(/\$2[,.]?5.*M|\$2,500,000/);
  });

  it('detects STOCK Act range labels for equal-weight fallback', () => {
    const { isTrumpStockActRangeLabel, trumpTradesFromRows } = require('../../screens/DarkPool/utils/trumpHoldings');
    expect(isTrumpStockActRangeLabel('$15,001 - $50,000')).toBe(true);
    const trades = trumpTradesFromRows([
      {
        ticker: 'NVDA',
        transaction_type: 'buy',
        amount_label: '$15,001 - $50,000',
        transaction_date: '2025-01-02',
      },
      {
        ticker: 'NVDA',
        transaction_type: 'buy',
        amount_label: '$50,001 - $100,000',
        transaction_date: '2025-02-01',
      },
    ]);
    expect(trades).toHaveLength(2);
    expect(trades.every((t: { unitWeighted?: boolean }) => t.unitWeighted)).toBe(true);
  });

  it('rejects STOCK Act ranges and bracket floors — no midpoint', () => {
    expect(parseExactUsdAmount('$1,001 - $15,000')).toBeNull();
    expect(parseExactUsdAmount('$1,001–$15,000')).toBeNull();
    expect(parseExactUsdAmount('1001.0')).toBeNull();
    expect(parseExactUsdAmount('$1,001')).toBeNull();
    expect(JSON.stringify(parseExactUsdAmount('$1,001 - $15,000'))).not.toMatch(
      /8000|8,000/
    );
  });
});

describe('trump notional running book', () => {
  const trades = trumpTradesFromRows([
    {
      ticker: 'DJT',
      transaction_type: 'buy',
      amount_label: '$100,000',
      transaction_date: '2025-01-02',
    },
    {
      ticker: 'NVDA',
      transaction_type: 'buy',
      amount_label: '$50,000',
      transaction_date: '2025-01-03',
    },
    {
      ticker: 'DJT',
      transaction_type: 'sell',
      amount_label: '$40,000',
      transaction_date: '2025-02-01',
    },
  ]);

  it('maps exact amounts and STOCK Act ranges as equal-weight (no midpoint)', () => {
    expect(trades).toHaveLength(3);
    expect(trades[0]).toMatchObject({
      ticker: 'DJT',
      side: 'buy',
      amountUsd: 100_000,
    });
    expect(
      trumpTradesFromRows([
        {
          ticker: 'TEAM',
          transaction_type: 'buy',
          amount_label: '$1,001 - $15,000',
          transaction_date: '2025-01-02',
        },
      ])
    ).toEqual([
      {
        ticker: 'TEAM',
        side: 'buy',
        amountUsd: 1,
        price: null,
        transaction_date: '2025-01-02',
        unitWeighted: true,
      },
    ]);
  });

  it('replays FIFO notional and never invents shares from a range', () => {
    const pos = replayTrumpLots(trades);
    const djt = pos.get('DJT') ?? [];
    expect(djt.reduce((s, l) => s + l.notional, 0)).toBe(60_000);
    expect(JSON.stringify(pos)).not.toMatch(/1001|15,000|8000/);
  });

  it('marks remaining notional to Yahoo closes via price ratio', () => {
    const holdings = buildTrumpHoldings(trades, {
      DJT: [
        { date: '2025-01-02', close: 10 },
        { date: '2025-06-02', close: 20 },
      ],
      NVDA: [
        { date: '2025-01-03', close: 100 },
        { date: '2025-06-02', close: 80 },
      ],
    });
    expect(holdings).toHaveLength(2);
    const djt = holdings.find((h) => h.ticker === 'DJT');
    const nvda = holdings.find((h) => h.ticker === 'NVDA');
    expect(djt?.remainingNotionalUsd).toBe(60_000);
    expect(djt?.marketValueUsd).toBeCloseTo(120_000, 5);
    expect(djt?.returnPct).toBeCloseTo(100, 5);
    expect(nvda?.marketValueUsd).toBeCloseTo(40_000, 5);
    expect(nvda?.returnPct).toBeCloseTo(-20, 5);
    const total = sumTrumpPortfolioValue(holdings);
    expect(total).toBeCloseTo(160_000, 5);
    expect(djt?.weightPct).toBeCloseTo(75, 5);
    expect(JSON.stringify(holdings)).not.toMatch(/1,001|15,000|משוער|8000/);
  });

  it('builds a chart from notional × inherited closes', () => {
    const series = buildTrumpMarkToMarketSeries(trades, {
      DJT: [
        { date: '2025-01-02', close: 10 },
        { date: '2025-01-03', close: 10 },
        { date: '2025-02-01', close: 10 },
        { date: '2025-02-02', close: 12 },
      ],
      NVDA: [
        { date: '2025-01-03', close: 100 },
        { date: '2025-02-01', close: 100 },
        { date: '2025-02-02', close: 100 },
      ],
    });
    expect(series.length).toBeGreaterThanOrEqual(2);
    const last = series[series.length - 1];
    expect(last.value).toBeCloseTo(60_000 * (12 / 10) + 50_000, 5);
  });

  it('shows holdings rows with weight / USD / return — not a STOCK Act range', () => {
    const holdings = buildTrumpHoldings(trades, {
      DJT: [
        { date: '2025-01-02', close: 10 },
        { date: '2025-06-02', close: 12 },
      ],
      NVDA: [
        { date: '2025-01-03', close: 100 },
        { date: '2025-06-02', close: 100 },
      ],
    });
    const djt = holdings.find((h) => h.ticker === 'DJT');
    const cells = formatHoldingRowCells({
      ticker: djt!.ticker,
      engine: 'trump',
      allocationPct: djt!.weightPct,
      valueUsd: djt!.marketValueUsd,
      returnPct: djt!.returnPct,
    });
    expect(cells.ticker).toBe('DJT');
    expect(cells.allocationLabel).toMatch(/%/);
    expect(cells.valueLabel).toMatch(/\$/);
    expect(cells.returnLabel).toMatch(/\+/);
    expect(JSON.stringify(cells)).not.toMatch(/1,001|15,000|בטווח|משוער/);
  });
});
