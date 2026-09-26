import {
  buildTickerChartSeries,
  formatTickerAbsChange,
  formatTickerLivePrice,
  formatTickerPctChange,
  pickDefaultTickerRange,
  tickerDisplayedChange,
  tickerHistoryRangeForChip,
  tickerRangeChange,
  visibleTickerChartRanges,
  yahooRequestForTickerRange,
  type TickerChartRange,
  type TickerClosePoint,
} from '../../screens/DarkPool/utils/tickerChart';

function dailyFrom(start: string, days: number, startClose = 100): TickerClosePoint[] {
  const out: TickerClosePoint[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    out.push({
      date: d.toISOString().slice(0, 10),
      close: startClose + i * 0.1,
    });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

describe('tickerRangeChange', () => {
  const now = new Date('2026-09-19T16:00:00Z');
  const daily = dailyFrom('2021-09-19', 365 * 5, 80);

  it('uses previous_close for 1D — not a reconstructed entry', () => {
    const change = tickerRangeChange({
      range: '1D',
      livePrice: 146.39,
      previousClose: 145.16,
      daily,
      now,
    });
    expect(change.abs).toBeCloseTo(1.23, 2);
    expect(change.pct).toBeCloseTo((1.23 / 145.16) * 100, 2);
    expect(change.pct).toBeLessThan(5);
    expect(change.abs).not.toBeCloseTo(100.91);
  });

  it('does not invent InsiderWave +$100.91 / 221% from an old first close', () => {
    const change = tickerRangeChange({
      range: '1D',
      livePrice: 146.39,
      previousClose: 145.16,
      daily: [{ date: '2020-01-02', close: 45.5 }, ...daily],
      now,
    });
    expect(change.pct).not.toBeCloseTo(221.88, 0);
    expect(formatTickerAbsChange(change.abs ?? 0)).toBe('+$1.23');
  });

  it('uses the first close of the selected range for 1Y', () => {
    const change = tickerRangeChange({
      range: '1Y',
      livePrice: 146.39,
      previousClose: 145.16,
      daily,
      now,
    });
    expect(change.abs).not.toBeNull();
    expect(change.pct).not.toBeNull();
    expect(Math.abs(change.pct ?? 0)).toBeLessThan(100);
  });
});

describe('tickerDisplayedChange', () => {
  const now = new Date('2026-09-19T16:00:00Z');
  const daily = dailyFrom('2021-09-19', 365 * 5, 80);

  it('uses a scrubbed 1D close vs previous_close — not a reconstructed entry', () => {
    const change = tickerDisplayedChange({
      range: '1D',
      endPrice: 144,
      previousClose: 145.16,
      daily,
      now,
    });
    expect(change.abs).toBeCloseTo(-1.16, 2);
    expect(change.pct).toBeLessThan(0);
  });
});

function weekdaySessionsEnding(endIso: string, sessions: number, startClose = 100): TickerClosePoint[] {
  const out: TickerClosePoint[] = [];
  const d = new Date(`${endIso}T00:00:00Z`);
  while (out.length < sessions) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      out.push({ date: d.toISOString().slice(0, 10), close: startClose + out.length });
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

describe('yahooRequestForTickerRange', () => {
  it('maps 1M to daily 1mo — never max / 1wk / 1mo buckets', () => {
    expect(yahooRequestForTickerRange('1D')).toEqual({ yahooRange: '1d', interval: '5m' });
    expect(yahooRequestForTickerRange('1W')).toEqual({ yahooRange: '5d', interval: '1h' });
    expect(yahooRequestForTickerRange('1M')).toEqual({ yahooRange: '1mo', interval: '1h' });
    expect(yahooRequestForTickerRange('3M')).toEqual({ yahooRange: '3mo', interval: '1d' });
    expect(yahooRequestForTickerRange('YTD')).toEqual({ yahooRange: 'ytd', interval: '1d' });
    expect(yahooRequestForTickerRange('1Y')).toEqual({ yahooRange: '1y', interval: '1d' });
    expect(yahooRequestForTickerRange('5Y')).toEqual({ yahooRange: '5y', interval: '1d' });
    expect(yahooRequestForTickerRange('ALL')).toEqual({ yahooRange: '10y', interval: '1d' });
    expect(tickerHistoryRangeForChip('1D')).toBe('1Y');
    expect(tickerHistoryRangeForChip('1M')).toBe('1M');
    expect(yahooRequestForTickerRange(tickerHistoryRangeForChip('1M'))).toEqual({
      yahooRange: '1mo',
      interval: '1h',
    });
    const ranges: TickerChartRange[] = ['1D', '1W', '1M', '3M', 'YTD', '1Y', '5Y', 'ALL'];
    for (const range of ranges) {
      const spec = yahooRequestForTickerRange(range);
      expect(spec.yahooRange).not.toBe('max');
      if (range === '1D') expect(spec.interval).toBe('5m');
      else if (range === '1W' || range === '1M') expect(spec.interval).toBe('1h');
      else expect(spec.interval).toBe('1d');
    }
  });
});

describe('buildTickerChartSeries', () => {
  it('builds a two-point 1D series from previous_close → live', () => {
    const series = buildTickerChartSeries({
      daily: dailyFrom('2026-01-01', 20),
      range: '1D',
      livePrice: 146.39,
      previousClose: 145.16,
      now: new Date('2026-09-19T16:00:00Z'),
    });
    expect(series).toHaveLength(2);
    expect(series[0].value).toBe(145.16);
    expect(series[1].value).toBe(146.39);
  });

  it('uses dense 5m bars on 1D when Yahoo intraday is present', () => {
    const now = new Date('2026-09-21T19:55:00Z');
    const intraday = Array.from({ length: 40 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 8, 21, 13, 30 + i * 5)).toISOString(),
      close: 145 + i * 0.02,
    }));
    const series = buildTickerChartSeries({
      daily: dailyFrom('2026-01-01', 20),
      range: '1D',
      livePrice: 146.2,
      previousClose: 145.16,
      now,
      intraday,
    });
    expect(series.length).toBeGreaterThanOrEqual(40);
    expect(series[0].value).toBeCloseTo(145, 5);
  });

  it('keeps ~a month of session closes on 1M, not two monthly snapshots', () => {
    const now = new Date('2026-09-21T16:00:00Z');
    const daily = weekdaySessionsEnding('2026-09-21', 22, 100);
    const series = buildTickerChartSeries({
      daily,
      range: '1M',
      livePrice: 122,
      previousClose: 121,
      now,
    });
    expect(series.length).toBeGreaterThanOrEqual(18);
    expect(series.length).not.toBe(2);
    const spanDays =
      (Date.parse(`${series[series.length - 1].date}T00:00:00Z`) -
        Date.parse(`${series[0].date}T00:00:00Z`)) /
      86_400_000;
    expect(spanDays).toBeGreaterThanOrEqual(20);
    expect(spanDays).toBeLessThanOrEqual(35);
  });
});

describe('visibleTickerChartRanges', () => {
  it('shows ALL only when history is longer than ~5y', () => {
    const short = dailyFrom('2024-01-01', 200);
    const long = dailyFrom('2018-01-01', 365 * 7);
    expect(
      visibleTickerChartRanges({
        daily: short,
        livePrice: 10,
        previousClose: 9,
      })
    ).not.toContain('ALL');
    expect(
      visibleTickerChartRanges({
        daily: long,
        livePrice: 10,
        previousClose: 9,
      })
    ).toContain('ALL');
  });

  it('defaults to 1Y when that chip exists', () => {
    expect(pickDefaultTickerRange(['1D', '1W', '1M', '3M', 'YTD', '1Y', '5Y'])).toBe('1Y');
  });
});

describe('formatTickerLivePrice', () => {
  it('formats a live quote with cents, not a reconstructed entry', () => {
    expect(formatTickerLivePrice(146.39)).toBe('$146.39');
    expect(formatTickerPctChange(0.847)).toBe('+0.85%');
    expect(formatTickerLivePrice(null)).toBeNull();
  });
});
