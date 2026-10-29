import { build13FPositionDetail } from '../../screens/DarkPool/utils/filingPositionDetail';

const row = (filing_date: string, ticker: string, shares: number, value_usd: number) => ({
  filing_date,
  ticker,
  shares,
  value_usd,
});

describe('build13FPositionDetail', () => {
  it('derives new / buy / sell / exit from quarter-to-quarter share changes', () => {
    const rows = [
      row('2025-03-31', 'AAA', 100, 1_000), // new @10
      row('2025-03-31', 'BBB', 5, 50),
      row('2025-06-30', 'AAA', 150, 1_800), // buy 50 @12
      row('2025-06-30', 'BBB', 5, 50),
      row('2025-09-30', 'AAA', 120, 1_200), // sell 30 @10
      row('2025-09-30', 'BBB', 5, 50),
      row('2025-12-31', 'BBB', 5, 50), // AAA exit 120 @ prev 10
    ];
    const d = build13FPositionDetail(rows, 'aaa')!;
    expect(d.transactions.map((t) => [t.side, t.shares, t.price])).toEqual([
      ['new', 100, 10],
      ['buy', 50, 12],
      ['sell', 30, 10],
      ['exit', 120, 10],
    ]);
    expect(d.shares).toBe(0);
    expect(d.asOf).toBe('2025-12-31');
  });

  it('merges duplicate lines of the same ticker in one filing', () => {
    const rows = [row('2025-03-31', 'AAA', 100, 1_000), row('2025-03-31', 'AAA', 50, 500)];
    const d = build13FPositionDetail(rows, 'AAA')!;
    expect(d.shares).toBe(150);
    expect(d.reportedValueUsd).toBe(1_500);
    expect(d.transactions).toHaveLength(1);
  });
});
