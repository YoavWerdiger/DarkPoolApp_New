import {
  ALL_CURATED_EXPLORE_PROFILES,
  CURATED_INSIDER_PROFILES,
  filterCuratedExplorePeople,
  isCuratedExploreId,
} from '../../screens/DarkPool/utils/curatedExploreProfiles';
import type { ExplorePerson } from '../../services/darkpool/uwExploreService';

describe('curated explore roster', () => {
  it('includes Jensen Huang and other named CEOs', () => {
    const ids = new Set(ALL_CURATED_EXPLORE_PROFILES.map((p) => p.id));
    expect(ids.has('NVDA:Jensen Huang')).toBe(true);
    expect(ids.has('AAPL:Tim Cook')).toBe(true);
    expect(CURATED_INSIDER_PROFILES.length).toBeGreaterThanOrEqual(8);
  });

  it('drops politicians without Quiver holdings from the curated grid', () => {
    const ids = new Set(ALL_CURATED_EXPLORE_PROFILES.map((p) => p.id));
    expect(ids.has('K000389')).toBe(false);
    expect(ids.has('M001157')).toBe(false);
  });

  it('filters discovery rails to curated ids only', () => {
    const junk: ExplorePerson[] = [
      {
        id: 'UNKNOWN:SPV',
        name: 'Random SPV',
        subtitle: 'x',
        image_url: 'https://example.com/logo.png',
        kind: 'insider',
      },
      {
        id: 'P000197',
        name: 'Nancy Pelosi',
        subtitle: 'קונגרס',
        image_url: null,
        kind: 'politician',
      },
    ];
    const out = filterCuratedExplorePeople(junk);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('P000197');
    expect(isCuratedExploreId('NVDA:Jensen Huang')).toBe(true);
  });
});
