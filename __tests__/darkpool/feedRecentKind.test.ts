import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FEED_RECENT_KIND_CHIPS,
  FEED_RECENT_KIND_DEFAULT,
  matchesFeedRecentKind,
} from '../../screens/DarkPool/utils/feedRecentKind';
import { EXPLORE_KIND_CHIPS } from '../../screens/DarkPool/utils/exploreGrid';

const homeSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/DarkPoolHomeScreen.tsx'),
  'utf8'
);
const exploreSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/DarkPoolExploreScreen.tsx'),
  'utf8'
);
const exploreFilterSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/components/ExploreKindFilter.tsx'),
  'utf8'
);
const darkPoolTabsSrc = readFileSync(
  join(__dirname, '../../navigation/DarkPoolTabs.tsx'),
  'utf8'
);

describe('feed recent-kind chips', () => {
  it('defaults to הכל and lists הכל / קונגרס / בכירים', () => {
    expect(FEED_RECENT_KIND_DEFAULT).toBe('all');
    expect(FEED_RECENT_KIND_CHIPS.map((c) => c.id)).toEqual([
      'all',
      'congress',
      'insider',
    ]);
    expect(FEED_RECENT_KIND_CHIPS.map((c) => c.label)).toEqual([
      'הכל',
      'קונגרס',
      'בכירים',
    ]);
  });

  it('filters congress vs Form 4 without inventing rows', () => {
    expect(matchesFeedRecentKind('congress', 'all')).toBe(true);
    expect(matchesFeedRecentKind('insider', 'all')).toBe(true);
    expect(matchesFeedRecentKind('congress', 'congress')).toBe(true);
    expect(matchesFeedRecentKind('insider', 'congress')).toBe(false);
    expect(matchesFeedRecentKind('insider', 'insider')).toBe(true);
    expect(matchesFeedRecentKind('congress', 'insider')).toBe(false);
    expect(matchesFeedRecentKind('congress')).toBe(true);
  });

  it('wires DayDividerPill under עסקאות אחרונות on the home feed', () => {
    const header = homeSrc.slice(homeSrc.indexOf('const listHeader'));
    const titleAt = header.indexOf('עסקאות אחרונות');
    const chipsAt = header.indexOf('FEED_RECENT_KIND_CHIPS.map');
    expect(titleAt).toBeGreaterThan(-1);
    expect(chipsAt).toBeGreaterThan(titleAt);
    expect(homeSrc).toMatch(/DayDividerPill/);
    expect(homeSrc).not.toMatch(/GlassChip/);
    expect(homeSrc).toMatch(/FEED_RECENT_KIND_DEFAULT/);
    expect(homeSrc).toMatch(/matchesFeedRecentKind\(row\.kind, recentKind\)/);
  });

  it('does not put הכל / כולם back on Explore', () => {
    expect(exploreSrc).not.toMatch(/FEED_RECENT_KIND/);
    expect(exploreFilterSrc).not.toMatch(/FEED_RECENT_KIND/);
    expect(EXPLORE_KIND_CHIPS.map((c) => c.label)).not.toContain('הכל');
    expect(EXPLORE_KIND_CHIPS.map((c) => c.label)).not.toContain('כולם');
    expect(EXPLORE_KIND_CHIPS.some((c) => c.id === ('all' as string))).toBe(false);
  });

  it('does not embed investor search on Explore', () => {
    expect(exploreSrc).not.toMatch(/useInvestorSearch/);
    expect(exploreSrc).not.toMatch(/TextInput/);
  });

  it('opens Dark Pool on the Explore tab, not Feed', () => {
    expect(darkPoolTabsSrc).toMatch(/initialRouteName="DarkPoolExplore"/);
  });
});
