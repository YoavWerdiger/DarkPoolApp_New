import {
  avgEntryPriceFromCost,
  formatAvgEntryUsd,
} from '../../screens/DarkPool/utils/darkPoolFormat';

describe('avgEntryPriceFromCost', () => {
  it('returns cost/qty when both positive', () => {
    expect(avgEntryPriceFromCost(1000, 10)).toBe(100);
  });

  it('returns null when cost or qty missing/invalid', () => {
    expect(avgEntryPriceFromCost(null, 10)).toBeNull();
    expect(avgEntryPriceFromCost(100, 0)).toBeNull();
    expect(avgEntryPriceFromCost(0, 10)).toBeNull();
    expect(avgEntryPriceFromCost(undefined, undefined)).toBeNull();
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
