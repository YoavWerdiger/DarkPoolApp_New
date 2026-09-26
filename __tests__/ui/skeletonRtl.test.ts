import {
  listItemSkeletonRowStyle,
  listItemSkeletonTextStyle,
} from '../../components/ui/SkeletonLoader';
import { quoteRow } from '../../screens/Watchlist/watchlistTheme';

describe('ListItemSkeleton RTL', () => {
  it('does not double-flip rtl + row-reverse', () => {
    expect(listItemSkeletonRowStyle.direction).toBe('rtl');
    expect(listItemSkeletonRowStyle.flexDirection).toBe('row');
    expect(listItemSkeletonTextStyle.alignItems).toBe('flex-start');
  });
});

describe('Watchlist quote row topology', () => {
  it('keeps LTR Yoga + row-reverse (logo/symbol first = physical right)', () => {
    expect(quoteRow.flexDirection).toBe('row-reverse');
    expect(quoteRow.direction).toBeUndefined();
  });
});
