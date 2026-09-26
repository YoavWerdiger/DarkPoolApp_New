import {
  chartSampleGapMs,
  sampleChartSeriesForPeriod,
} from '../../screens/DarkPool/utils/profileChartSeries';

describe('chartSeriesSampling', () => {
  it('uses 5m gap on 1D when timestamps are dense', () => {
    const t0 = Date.UTC(2026, 0, 2, 14, 0, 0);
    const series = Array.from({ length: 120 }, (_, i) => ({
      date: new Date(t0 + i * 60_000).toISOString(),
      value: 100 + i,
    }));
    const out = sampleChartSeriesForPeriod(series, '1D');
    expect(out.length).toBeGreaterThan(2);
    expect(out.length).toBeLessThan(series.length / 2);
    const gaps: number[] = [];
    for (let i = 1; i < out.length; i++) {
      gaps.push(Date.parse(out[i].date) - Date.parse(out[i - 1].date));
    }
    const median = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    expect(median).toBeGreaterThanOrEqual(4 * 60_000);
  });

  it('uses weekly gaps on 5Y daily history', () => {
    const series = [];
    const d = new Date('2020-01-02T00:00:00Z');
    for (let i = 0; i < 400; i++) {
      series.push({
        date: d.toISOString().slice(0, 10),
        value: 1_000_000 + i * 1000,
      });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    const out = sampleChartSeriesForPeriod(series, '5Y');
    expect(out.length).toBeLessThan(120);
    expect(out.length).toBeGreaterThanOrEqual(10);
    expect(out[0].date).toBe('2020-01-02');
    expect(out[out.length - 1].date).toBe(series[series.length - 1].date);
  });

  it('chartSampleGapMs matches product spec', () => {
    expect(chartSampleGapMs('1D')).toBe(5 * 60_000);
    expect(chartSampleGapMs('1W')).toBe(60 * 60_000);
    expect(chartSampleGapMs('1M')).toBe(60 * 60_000);
    expect(chartSampleGapMs('3M')).toBe(24 * 60 * 60_000);
    expect(chartSampleGapMs('5Y')).toBe(7 * 24 * 60 * 60_000);
  });
});
