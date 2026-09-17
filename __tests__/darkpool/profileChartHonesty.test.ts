/**
 * דילול + נטרול הפקדות — גרפי Dark Pool כנים יותר.
 */

import {
  isReconstructedChartReliable,
  prepareReconstructedChartSeries,
  sparsifyChartSeriesByGap,
  toFlowNeutralChartSeries,
} from '../../screens/DarkPool/utils/profileChartSeries';

describe('profileChartHonesty', () => {
  it('sparsify keeps trade-flow days and weekly samples', () => {
    const dense = [];
    for (let i = 0; i < 30; i++) {
      const d = `2024-01-${String(i + 1).padStart(2, '0')}`;
      dense.push({
        date: d,
        value: 10_000 + i * 10,
        ...(i === 10 ? { external_flow: 50_000 } : {}),
      });
    }
    const sparse = sparsifyChartSeriesByGap(dense, 7);
    expect(sparse.length).toBeLessThan(dense.length);
    expect(sparse.some((p) => (p.external_flow ?? 0) === 50_000)).toBe(true);
    expect(sparse[0].date).toBe(dense[0].date);
    expect(sparse[sparse.length - 1].date).toBe(dense[dense.length - 1].date);
  });

  it('flow-neutral removes deposit spike shape but ends at last absolute value', () => {
    const series = [
      { date: '2024-01-01', value: 8_000, external_flow: 8_000 },
      { date: '2024-01-02', value: 8_000 },
      { date: '2024-01-03', value: 108_000, external_flow: 100_000 }, // buy spike
      { date: '2024-01-04', value: 118_800 }, // +10% market
    ];
    const neutral = toFlowNeutralChartSeries(series);
    expect(neutral[neutral.length - 1].value).toBeCloseTo(118_800, 0);
    // אחרי נטרול: יום הקנייה לא קופץ פי 13
    const day2 = neutral.find((p) => p.date === '2024-01-02')!.value;
    const day3 = neutral.find((p) => p.date === '2024-01-03')!.value;
    expect(day3 / day2).toBeLessThan(1.05);
    // עליית שוק ~10% נשמרת אחרי הקנייה
    const day4 = neutral.find((p) => p.date === '2024-01-04')!.value;
    expect(day4 / day3).toBeCloseTo(1.1, 2);
  });

  it('hides chart when too few trades or short span', () => {
    const short = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-10', value: 110 },
    ];
    expect(isReconstructedChartReliable(short, { tradeCount: 2 })).toBe(false);
    expect(isReconstructedChartReliable(short, { tradeCount: 5, minSpanDays: 21 })).toBe(
      false
    );
    expect(prepareReconstructedChartSeries(short, { tradeCount: 2 })).toEqual([]);
  });

  it('prepare returns flow-neutral sparse series when reliable', () => {
    const dense = [];
    let v = 50_000;
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
      const flow = i === 20 ? 80_000 : i === 0 ? 50_000 : 0;
      if (flow > 0 && i > 0) v += flow;
      else if (i > 0) v *= 1.002;
      dense.push({
        date: d,
        value: v,
        ...(flow ? { external_flow: flow } : {}),
      });
    }
    const out = prepareReconstructedChartSeries(dense, { tradeCount: 8 });
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.length).toBeLessThan(dense.length);
    expect(out[out.length - 1].value).toBeCloseTo(dense[dense.length - 1].value, 0);
  });
});
