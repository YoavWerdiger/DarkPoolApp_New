import {
  formatFollowerCountHe,
  formatMedianExcessMetric,
  formatReported13fValueHe,
  formatTradeCountHe,
  isNegativeReturnMetric,
  isReturnMetric,
  partitionExploreByKind,
  sortExploreByLastFiled,
  takeUniqueExplorePeople,
} from '../../screens/DarkPool/utils/exploreDisplay';
import type { ExplorePerson } from '../../services/darkpool/uwExploreService';

const LRI = '\u2066';
const PDI = '\u2069';

describe('formatFollowerCountHe', () => {
  it('omits missing or zero counts — never invents "$ copied"', () => {
    expect(formatFollowerCountHe(null)).toBeNull();
    expect(formatFollowerCountHe(undefined)).toBeNull();
    expect(formatFollowerCountHe(0)).toBeNull();
    expect(formatFollowerCountHe(-3)).toBeNull();
  });

  it('uses Hebrew plural, not a dollar amount', () => {
    expect(formatFollowerCountHe(1)).toBe('עוקב אחד');
    expect(formatFollowerCountHe(2)).toBe('שני עוקבים');
    expect(formatFollowerCountHe(12)).toBe(`${LRI}12${PDI} עוקבים`);
    expect(formatFollowerCountHe(12)).not.toMatch(/copied|\$/i);
  });
});

describe('formatMedianExcessMetric', () => {
  it('formats Quiver ExcessReturn and refuses non-finite values', () => {
    expect(formatMedianExcessMetric(12.44)).toBe('+12.44%');
    expect(formatMedianExcessMetric(-3.2)).toBe('-3.20%');
    expect(formatMedianExcessMetric(null)).toBeNull();
    expect(formatMedianExcessMetric(Number.NaN)).toBeNull();
  });
});

describe('return metric detection', () => {
  it('colors only percent captions, not follower lines', () => {
    expect(isReturnMetric('+12.4%')).toBe(true);
    expect(isNegativeReturnMetric('-3.2%')).toBe(true);
    expect(isNegativeReturnMetric('+12.4%')).toBe(false);
    expect(isReturnMetric('12 עוקבים')).toBe(false);
  });
});

describe('formatTradeCountHe', () => {
  it('omits missing counts and never invents expectancy', () => {
    expect(formatTradeCountHe(null)).toBeNull();
    expect(formatTradeCountHe(0)).toBeNull();
    expect(formatTradeCountHe(1)).toBe('עסקה מדווחת אחת');
    expect(formatTradeCountHe(12)).toBe(`${LRI}12${PDI} עסקאות מדווחות`);
  });
});

describe('formatReported13fValueHe', () => {
  it('formats 13F book value and refuses congress-style empty ranges', () => {
    expect(formatReported13fValueHe(null)).toBeNull();
    expect(formatReported13fValueHe(0)).toBeNull();
    expect(formatReported13fValueHe(-10)).toBeNull();
    expect(formatReported13fValueHe(488_000_000_000)).toBe(`${LRI}$488.00B${PDI}`);
  });
});

describe('explore shelves', () => {
  const pelosi: ExplorePerson = {
    id: 'P000197',
    name: 'Nancy Pelosi',
    subtitle: 'בית הנציגים',
    image_url: null,
    kind: 'politician',
  };
  const cook: ExplorePerson = {
    id: 'AAPL:Cook',
    name: 'Tim Cook',
    subtitle: 'Apple',
    image_url: null,
    kind: 'insider',
    ticker: 'AAPL',
  };
  const buffett: ExplorePerson = {
    id: '1067983',
    name: 'Warren Buffett',
    subtitle: 'Berkshire',
    image_url: null,
    kind: 'fund_manager',
    portfolio_value: 488_000_000_000,
  };

  it('partitions politicians, executives, and funds without mixing', () => {
    const shelves = partitionExploreByKind([pelosi, cook, buffett]);
    expect(shelves.politicians.map((p) => p.id)).toEqual(['P000197']);
    expect(shelves.insiders.map((p) => p.id)).toEqual(['AAPL:Cook']);
    expect(shelves.funds.map((p) => p.id)).toEqual(['1067983']);
  });

  it('keeps first unique people and sorts by last filing', () => {
    expect(takeUniqueExplorePeople([pelosi, pelosi, cook], 2).map((p) => p.id)).toEqual([
      'P000197',
      'AAPL:Cook',
    ]);
    const rows = [
      { id: 'a', last_filed_at: '2026-01-01' },
      { id: 'b', last_filed_at: '2026-03-01' },
    ];
    expect([...rows].sort(sortExploreByLastFiled).map((r) => r.id)).toEqual(['b', 'a']);
  });
});
