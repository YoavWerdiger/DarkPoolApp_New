import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { congressPhotoUrl, looksLikePersonPhoto } from './investorPlaceholder';
import { knownPortraitForInvestor } from './knownInvestorPortraits';

export type ExploreKindFilter = 'all' | 'politician' | 'insider';

/** URL תמונה אמיתית של אדם — לא placeholder / לא לוגו חברה */
export function resolveExplorePhotoUrl(person: ExplorePerson): string | null {
  const known = knownPortraitForInvestor({
    personId: person.id,
    name: person.name,
  });
  if (known) return known;

  if (person.kind === 'politician') {
    const congress = congressPhotoUrl(person.id);
    if (congress) return congress;
  }

  const direct = person.image_url?.trim();
  if (direct && looksLikePersonPhoto(direct)) return direct;

  return null;
}

export function explorePersonHasPhoto(person: ExplorePerson): boolean {
  return !!resolveExplorePhotoUrl(person);
}

export function withResolvedPhoto(person: ExplorePerson): ExplorePerson {
  const url = resolveExplorePhotoUrl(person);
  return url ? { ...person, image_url: url } : person;
}

/** מאחד כל המקורות לרשימת פרופילים ייחודית */
export function buildExploreProfileGrid(
  sources: ExplorePerson[],
  opts?: { kind?: ExploreKindFilter; query?: string; requirePhoto?: boolean }
): ExplorePerson[] {
  const map = new Map<string, ExplorePerson>();
  const requirePhoto = opts?.requirePhoto !== false;

  for (const raw of sources) {
    const person = withResolvedPhoto(raw);
    // בלי תמונה — רק אם יש טיקר (InvestorPortrait נופל ללוגו מניה)
    if (requirePhoto) {
      if (!explorePersonHasPhoto(person)) continue;
    } else if (!explorePersonHasPhoto(person) && !person.ticker) {
      continue;
    }

    const prev = map.get(person.id);
    if (!prev || (person.activity_score ?? 0) > (prev.activity_score ?? 0)) {
      map.set(person.id, person);
    }
  }

  let list = Array.from(map.values()).sort(
    (a, b) => (b.activity_score ?? 0) - (a.activity_score ?? 0)
  );

  const kind = opts?.kind ?? 'all';
  if (kind === 'politician') {
    list = list.filter((p) => p.kind === 'politician');
  } else if (kind === 'insider') {
    list = list.filter((p) => p.kind === 'insider' || p.kind === 'fund_manager');
  }

  const q = opts?.query?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        (p.ticker || '').toLowerCase().includes(q)
    );
  }

  return list;
}

export function collectExploreSources(
  data: {
    most_followed?: ExplorePerson[];
    top_active?: ExplorePerson[];
    recently_active?: ExplorePerson[];
    executives?: ExplorePerson[];
    insiders_with_photo?: ExplorePerson[];
  } | null,
  featured: ExplorePerson[]
): ExplorePerson[] {
  if (!data) return featured;
  return [
    ...featured,
    ...(data.most_followed ?? []),
    ...(data.top_active ?? []),
    ...(data.recently_active ?? []),
    ...(data.executives ?? []),
    ...(data.insiders_with_photo ?? []),
  ];
}
