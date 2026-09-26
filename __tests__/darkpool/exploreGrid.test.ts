import {
  EXPLORE_FEATURED_LIMIT,
  EXPLORE_GRID_ASPECT,
  EXPLORE_GRID_COLS,
  EXPLORE_GRID_GAP,
  EXPLORE_GRID_ROWS,
  EXPLORE_KIND_CHIPS,
  EXPLORE_PROFILE_CARD,
  EXPLORE_RAIL_CARD,
  EXPLORE_RAIL_GAP,
  EXPLORE_RAIL_LIMIT,
  EXPLORE_UNFILTERED_TITLE,
  buildExploreProfileGrid,
  chunkExploreColumns,
  exploreGridCardWidth,
  exploreKindGridTitle,
  filterExplorePeopleByKind,
  matchesExploreKind,
} from '../../screens/DarkPool/utils/exploreGrid';
import type { ExplorePerson } from '../../services/darkpool/uwExploreService';

describe('explore grid size and scroll', () => {
  it('locks one 170×200 profile card in every explore shelf', () => {
    expect(EXPLORE_GRID_COLS).toBe(2);
    expect(EXPLORE_GRID_ROWS).toBe(2);
    expect(EXPLORE_GRID_GAP).toBe(10);
    expect(EXPLORE_RAIL_GAP).toBe(10);
    expect(EXPLORE_PROFILE_CARD).toEqual({ width: 170, height: 200 });
    expect(EXPLORE_RAIL_CARD).toEqual({ width: 170, height: 200 });
    expect(EXPLORE_RAIL_CARD).toBe(EXPLORE_PROFILE_CARD);
    expect(EXPLORE_GRID_ASPECT).toBeCloseTo(0.85, 5);
    expect(EXPLORE_PROFILE_CARD.width / EXPLORE_PROFILE_CARD.height).toBeCloseTo(
      0.85,
      2
    );
    expect(EXPLORE_PROFILE_CARD).not.toHaveProperty('compact');
    expect(EXPLORE_PROFILE_CARD).not.toHaveProperty('large');
    expect(EXPLORE_FEATURED_LIMIT).toBeGreaterThan(4);
    expect(EXPLORE_RAIL_LIMIT).toBeGreaterThan(10);
  });

  it('returns the unified 2-col card width — not a 118 rail and not 3-col', () => {
    expect(exploreGridCardWidth(390, 20)).toBe(170);
    expect(exploreGridCardWidth(430, 16)).toBe(170);
    expect(exploreGridCardWidth()).toBe(EXPLORE_PROFILE_CARD.width);
    expect(EXPLORE_GRID_COLS).not.toBe(3);
  });

  it('chunks people into 2-row columns for a horizontal rail', () => {
    expect(chunkExploreColumns(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e'],
    ]);
  });
});

describe('explore kind shelves', () => {
  const fund: ExplorePerson = {
    id: '1067983',
    name: 'Warren Buffett',
    subtitle: 'Berkshire',
    image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Warren_Buffett_KU_Visit.jpg',
    kind: 'fund_manager',
  };
  const insider: ExplorePerson = {
    id: 'AAPL:Cook',
    name: 'Tim Cook',
    subtitle: 'Apple',
    image_url: 'https://example.com/cook.jpg',
    kind: 'insider',
    ticker: 'AAPL',
  };

  it('does not lump 13F funds into the insider chip', () => {
    expect(matchesExploreKind(fund, 'insider')).toBe(false);
    expect(matchesExploreKind(fund, 'fund')).toBe(true);
    expect(matchesExploreKind(insider, 'insider')).toBe(true);
    expect(matchesExploreKind(insider, 'fund')).toBe(false);
  });

  it('has no «כולם» / all-kind chip — unfiltered stack when none selected', () => {
    expect(EXPLORE_KIND_CHIPS.map((c) => c.id)).toEqual([
      'politician',
      'insider',
      'fund',
    ]);
    expect(EXPLORE_KIND_CHIPS.map((c) => c.label)).not.toContain('כולם');
    expect(EXPLORE_KIND_CHIPS.some((c) => c.id === ('all' as string))).toBe(false);
    expect(exploreKindGridTitle(null)).toBe(EXPLORE_UNFILTERED_TITLE);
    expect(exploreKindGridTitle(null)).not.toBe('כולם');
    expect(matchesExploreKind(fund, null)).toBe(true);
    expect(matchesExploreKind(insider, undefined)).toBe(true);
  });

  it('keeps the unfiltered catalog when no kind chip is selected', () => {
    const grid = buildExploreProfileGrid([fund, insider], {
      requirePhoto: false,
    });
    expect(grid.map((p) => p.id).sort()).toEqual(['1067983', 'AAPL:Cook']);
    expect(filterExplorePeopleByKind(grid, null).map((p) => p.id).sort()).toEqual([
      '1067983',
      'AAPL:Cook',
    ]);
  });

  it('filters shelves by kind instead of dumping every profile', () => {
    const people = [fund, insider];
    expect(filterExplorePeopleByKind(people, 'fund').map((p) => p.id)).toEqual([
      '1067983',
    ]);
    expect(filterExplorePeopleByKind(people, 'insider').map((p) => p.id)).toEqual([
      'AAPL:Cook',
    ]);
    expect(filterExplorePeopleByKind(people, 'politician')).toEqual([]);
  });

  it('filters the full grid by fund without inventing congress AUM', () => {
    const grid = buildExploreProfileGrid([fund, insider], {
      kind: 'fund',
      requirePhoto: false,
    });
    expect(grid.map((p) => p.id)).toEqual(['1067983']);
    expect(grid[0]?.portfolio_value).toBeUndefined();
  });
});
