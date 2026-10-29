import { appendWeightedIntraday } from '../../screens/DarkPool/utils/sessionSnapshots';

describe('appendWeightedIntraday', () => {
  it('replaces daily points in the window with chained intraday bars', () => {
    const series = [
      { date: '2026-10-26', value: 1000 },
      { date: '2026-10-27', value: 1100 },
      { date: '2026-10-28', value: 1210 },
    ];
    const bars = [
      { date: '2026-10-27T14:00:00Z', close: 10 },
      { date: '2026-10-27T15:00:00Z', close: 11 },
      { date: '2026-10-28T14:00:00Z', close: 11.5 },
      { date: '2026-10-28T15:00:00Z', close: 12.1 },
    ];
    const out = appendWeightedIntraday(series, [{ weight: 1, bars }]);
    expect(out.map((p) => p.date)).toEqual(['2026-10-26', ...bars.map((b) => b.date)]);
    // יום ראשון: מול הבר הראשון שלו, מעוגן לנקודה היומית הקודמת (1000)
    expect(out[1].value).toBeCloseTo(1000);
    expect(out[2].value).toBeCloseTo(1100);
    // יום שני: מול הבר האחרון של אתמול (11), מעוגן ל-1100
    expect(out[4].value).toBeCloseTo(1100 * (12.1 / 11));
  });

  it('keeps the series when there is not enough intraday data', () => {
    const series = [{ date: '2026-10-27', value: 1 }];
    expect(appendWeightedIntraday(series, [{ weight: 1, bars: [] }])).toBe(series);
  });
});
