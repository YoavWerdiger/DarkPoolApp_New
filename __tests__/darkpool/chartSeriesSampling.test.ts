import {
  chartSampleGapMs,
  filterChartSeriesByPeriod,
  sampleChartSeriesForPeriod,
} from '../../screens/DarkPool/utils/profileChartSeries';
import { appendWeightedSession } from '../../screens/DarkPool/utils/sessionSnapshots';

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

  it('keeps a 2h snapshot on the latest session of a daily chart', () => {
    const daily = Array.from({ length: 40 }, (_, i) => ({
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      value: 1000 + i,
    }));
    const hours = [14, 15, 16, 17, 18, 19].map((h) => ({
      date: `2026-09-10T${String(h).padStart(2, '0')}:00:00.000Z`,
      value: 2000 + h,
    }));
    const out = sampleChartSeriesForPeriod([...daily, ...hours], '1Y');
    const session = out.filter((p) => p.date.startsWith('2026-09-10T'));
    expect(session.length).toBeGreaterThanOrEqual(3);
    const oneD = filterChartSeriesByPeriod([...daily, ...hours], '1D');
    expect(oneD.length).toBe(hours.length);
  });

  it('scales a holdings chart by real hourly closes', () => {
    const out = appendWeightedSession(
      [
        { date: '2026-09-09', value: 1000 },
        { date: '2026-09-10', value: 1100 },
      ],
      [
        {
          weight: 1000,
          bars: [
            { date: '2026-09-10T14:00:00.000Z', close: 100 },
            { date: '2026-09-10T16:00:00.000Z', close: 110 },
            { date: '2026-09-10T18:00:00.000Z', close: 120 },
          ],
        },
      ]
    );
    expect(out[0].date).toBe('2026-09-09');
    expect(out[0].value).toBe(1000);
    expect(out).toHaveLength(4);
    expect(out[1].value).toBeCloseTo(1000);
    expect(out[3].value).toBeCloseTo(1200);
    expect(out.filter((p) => p.date.slice(0, 10) === '2026-09-10')).toHaveLength(3);
  });

  it('chartSampleGapMs matches product spec', () => {
    expect(chartSampleGapMs('1D')).toBe(5 * 60_000);
    expect(chartSampleGapMs('1W')).toBe(60 * 60_000);
    expect(chartSampleGapMs('1M')).toBe(60 * 60_000);
    expect(chartSampleGapMs('3M')).toBe(24 * 60 * 60_000);
    expect(chartSampleGapMs('5Y')).toBe(7 * 24 * 60 * 60_000);
  });
});
