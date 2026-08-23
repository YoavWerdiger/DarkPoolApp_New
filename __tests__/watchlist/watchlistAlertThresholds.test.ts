import {
  addThreshold,
  legacyFirst,
  parseThresholdList,
  toggleThreshold,
  uniqSortedThresholds,
} from '../../services/watchlist/watchlistAlertThresholds';

describe('watchlistAlertThresholds', () => {
  it('uniques and sorts thresholds', () => {
    expect(uniqSortedThresholds([10, 5, 5, 3, -1, NaN])).toEqual([3, 5, 10]);
  });

  it('parses array or legacy single', () => {
    expect(parseThresholdList([5, 10], null)).toEqual([5, 10]);
    expect(parseThresholdList([], 7)).toEqual([7]);
    expect(parseThresholdList(null, null)).toEqual([]);
  });

  it('toggles thresholds', () => {
    expect(toggleThreshold([3, 5], 5)).toEqual([3]);
    expect(toggleThreshold([3], 5)).toEqual([3, 5]);
  });

  it('adds without removing', () => {
    expect(addThreshold([3], 5)).toEqual([3, 5]);
    expect(addThreshold([3, 5], 5)).toEqual([3, 5]);
  });

  it('legacyFirst returns first or null', () => {
    expect(legacyFirst([8, 12])).toBe(8);
    expect(legacyFirst([])).toBeNull();
  });
});
