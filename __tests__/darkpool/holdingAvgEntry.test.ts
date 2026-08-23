import {
  avgEntryPriceFromCost,
  formatAvgEntryUsd,
  impliedFilingPriceFrom13f,
} from '../../screens/DarkPool/utils/darkPoolFormat';

describe('avgEntryPriceFromCost', () => {
  it('returns cost/qty when both positive and basis reliable', () => {
    expect(avgEntryPriceFromCost(1000, 10)).toBe(100);
    expect(avgEntryPriceFromCost(1000, 10, true)).toBe(100);
  });

  it('hides avg when basis is not reliable (congress range estimate)', () => {
    expect(avgEntryPriceFromCost(750_000, 423, false)).toBeNull();
  });

  it('returns null when cost or qty missing/invalid', () => {
    expect(avgEntryPriceFromCost(null, 10)).toBeNull();
    expect(avgEntryPriceFromCost(100, 0)).toBeNull();
    expect(avgEntryPriceFromCost(0, 10)).toBeNull();
    expect(avgEntryPriceFromCost(undefined, undefined)).toBeNull();
  });
});

describe('impliedFilingPriceFrom13f', () => {
  it('returns value/shares from 13F filing fields', () => {
    expect(impliedFilingPriceFrom13f(1_000_000, 10_000)).toBe(100);
    expect(impliedFilingPriceFrom13f(45_250, 1000)).toBe(45.25);
  });

  it('returns null when value or shares missing/invalid', () => {
    expect(impliedFilingPriceFrom13f(null, 1000)).toBeNull();
    expect(impliedFilingPriceFrom13f(1_000_000, 0)).toBeNull();
    expect(impliedFilingPriceFrom13f(0, 1000)).toBeNull();
    expect(impliedFilingPriceFrom13f(undefined, undefined)).toBeNull();
  });
});

describe('formatAvgEntryUsd', () => {
  it('formats typical share prices with 2 decimals', () => {
    expect(formatAvgEntryUsd(45.2)).toBe('$45.20');
  });

  it('omits invalid values', () => {
    expect(formatAvgEntryUsd(null)).toBeNull();
    expect(formatAvgEntryUsd(0)).toBeNull();
  });
});
