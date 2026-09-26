import {
  beatSpyRate,
  formatAvgDelayDays,
  formatBeatSpyLabel,
  medianNumber,
  parseQuiverUsd,
  quiverAllocationToPct,
} from '../../screens/DarkPool/utils/congressHonesty';
import { explorePersonMatchesQuery } from '../../screens/DarkPool/utils/exploreGrid';

describe('congressHonesty', () => {
  it('median ignores non-finite and averages even length', () => {
    expect(medianNumber([])).toBeNull();
    expect(medianNumber([3, 1, 2])).toBe(2);
    expect(medianNumber([1, 3])).toBe(2);
  });

  it('beat-S&P requires a sample and does not invent 0%', () => {
    expect(beatSpyRate([1, -1], 3)).toBeNull();
    expect(beatSpyRate([2, 1, -1], 3)).toEqual({ pct: (2 / 3) * 100, n: 3 });
    expect(beatSpyRate([null, undefined, Number.NaN], 3)).toBeNull();
  });

  it('names Beat-S&P honestly in Hebrew — not Win Rate', () => {
    expect(formatBeatSpyLabel({ pct: 62.2, n: 41 })).toBe(
      'היכה את S&P ב-62% מהעסקאות (41)'
    );
    expect(formatBeatSpyLabel(null)).toBeNull();
  });

  it('formats avg delay without a fake 0 when missing', () => {
    expect(formatAvgDelayDays(null)).toBeNull();
    expect(formatAvgDelayDays(-1)).toBeNull();
    expect(formatAvgDelayDays(0)).toBe('אותו יום');
    expect(formatAvgDelayDays(29.4)).toBe('29 ימים');
  });

  it('treats Quiver Allocation as a 0–1 fraction', () => {
    expect(quiverAllocationToPct(0.1187)).toBeCloseTo(11.87, 2);
    expect(quiverAllocationToPct(18)).toBe(18);
    expect(parseQuiverUsd(18460942.4)).toBeCloseTo(18460942.4);
    expect(parseQuiverUsd(0)).toBeNull();
  });
});

describe('explorePersonMatchesQuery', () => {
  const pelosi = {
    id: 'P000197',
    name: 'Nancy Pelosi',
    subtitle: 'בית הנציגים · דמוקרטית',
    image_url: null,
    kind: 'politician' as const,
    ticker: 'NVDA',
  };

  it('matches name, ticker, party alias, and chamber', () => {
    expect(explorePersonMatchesQuery(pelosi, 'pelosi')).toBe(true);
    expect(explorePersonMatchesQuery(pelosi, 'nvda')).toBe(true);
    expect(explorePersonMatchesQuery(pelosi, 'דמוקרט')).toBe(true);
    expect(explorePersonMatchesQuery(pelosi, 'democrat')).toBe(true);
    expect(explorePersonMatchesQuery(pelosi, 'בית הנציגים')).toBe(true);
    expect(explorePersonMatchesQuery(pelosi, 'Tuberville')).toBe(false);
  });
});
