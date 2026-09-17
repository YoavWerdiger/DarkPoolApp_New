/**
 * מיפוי רצפות Quiver (1001.0…) לאמצע טווחי STOCK Act —
 * משקף parseCongressAmount ב־congressPortfolio (edge).
 */

const STOCK_ACT_FLOOR_MID: Record<number, number> = {
  1001: 8_000,
  15001: 32_500,
  50001: 75_000,
  100001: 175_000,
  250001: 375_000,
  500001: 750_000,
  1000001: 3_000_000,
  5000001: 12_500_000,
  25000001: 37_500_000,
  50000001: 75_000_000,
};

function parseCongressAmount(raw?: string | null): number {
  if (!raw) return 0;
  if (/share/i.test(raw) && !/\$|usd|dollar/i.test(raw)) return 0;
  const nums =
    raw
      .match(/[\d,]+(?:\.\d+)?/g)
      ?.map((s) => Math.round(parseFloat(s.replace(/,/g, ''))))
      .filter((n) => n > 0) ?? [];
  if (!nums.length) return 0;
  if (nums.length === 1) {
    const n = nums[0];
    if (STOCK_ACT_FLOOR_MID[n] != null) return STOCK_ACT_FLOOR_MID[n];
    return n;
  }
  return Math.round((nums[0] + nums[nums.length - 1]) / 2);
}

describe('parseCongressAmount STOCK Act honesty', () => {
  it('maps Quiver bare floors to range midpoints (not $1001 exact)', () => {
    expect(parseCongressAmount('1001.0')).toBe(8_000);
    expect(parseCongressAmount('15001.0')).toBe(32_500);
    expect(parseCongressAmount('50001.0')).toBe(75_000);
    expect(parseCongressAmount('100001.0')).toBe(175_000);
  });

  it('still averages explicit $ ranges', () => {
    expect(parseCongressAmount('$1,001 - $15,000')).toBe(8_001);
    expect(parseCongressAmount('$15,001 - $50,000')).toBe(32_501);
  });

  it('ignores share-only labels', () => {
    expect(parseCongressAmount('1500 shares')).toBe(0);
  });
});

describe('chart period return honesty', () => {
  const MAX = 250;

  function twr(series: { value: number; external_flow?: number }[]): number | null {
    if (series.length < 2) return null;
    const hasFlow = series.some((p) => (p.external_flow ?? 0) !== 0);
    if (hasFlow) {
      let cumulative = 1;
      for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1].value;
        const curr = series[i].value;
        const flow = series[i].external_flow ?? 0;
        const denom = prev + flow;
        if (denom > 1e-9 && curr >= 0) cumulative *= curr / denom;
      }
      const pct = (cumulative - 1) * 100;
      if (!Number.isFinite(pct) || Math.abs(pct) > MAX) return null;
      return Math.round(pct * 100) / 100;
    }
    const first = series[0].value;
    const last = series[series.length - 1].value;
    if (!(first > 0)) return null;
    const pct = ((last - first) / first) * 100;
    if (Math.abs(pct) > MAX) return null;
    return Math.round(pct * 100) / 100;
  }

  it('first→last without flow looks like 63500% (McCaul-style) — capped to null', () => {
    const naive = ((637040 - 1) / 1) * 100;
    expect(naive).toBeGreaterThan(MAX);
    expect(twr([{ value: 1 }, { value: 637040 }])).toBeNull();
  });

  it('TWR with buy flow does not count new capital as return', () => {
    // day0: $10k, day1: +$90k buy → value $100k flat prices → ~0%
    const pct = twr([
      { value: 10_000 },
      { value: 100_000, external_flow: 90_000 },
    ]);
    expect(pct).not.toBeNull();
    expect(Math.abs(pct!)).toBeLessThan(1);
  });

  it('price appreciation still shows as return', () => {
    const pct = twr([
      { value: 100_000 },
      { value: 110_000 },
    ]);
    expect(pct).toBeCloseTo(10, 0);
  });
});
