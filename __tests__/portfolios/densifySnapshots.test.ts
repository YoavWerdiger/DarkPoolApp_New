jest.mock('../../lib/supabase', () => ({ supabase: {} }));
import { densifySnapshotRows } from '../../services/portfolios/portfolioService';

const row = (d: string, v: number, dep = 0) => ({
  snapshot_date: d,
  portfolio_value: v,
  deposits_today: dep,
  withdrawals_today: 0,
});

describe('densifySnapshotRows', () => {
  it('fills missing weekdays up to today, carrying the base value without flows', () => {
    // 2026-10-01 = Thursday
    const out = densifySnapshotRows([row('2026-10-01', 1000, 1000)], '2026-10-06');
    expect(out.map((r) => r.snapshot_date)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-05',
      '2026-10-06',
    ]);
    expect(out.slice(1).every((r) => r.portfolio_value === 1000 && r.deposits_today === 0)).toBe(true);
  });

  it('keeps real snapshots and switches the carried base after each one', () => {
    const out = densifySnapshotRows(
      [row('2026-10-01', 1000), row('2026-10-05', 1500)],
      '2026-10-06',
    );
    expect(out.find((r) => r.snapshot_date === '2026-10-02')?.portfolio_value).toBe(1000);
    expect(out.find((r) => r.snapshot_date === '2026-10-06')?.portfolio_value).toBe(1500);
  });
});
