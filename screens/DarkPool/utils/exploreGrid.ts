import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { congressPhotoUrl, looksLikePersonPhoto } from './investorPlaceholder';
import { knownPortraitForInvestor } from './knownInvestorPortraits';
import { isTrustedPortraitUrl } from './curatedExploreProfiles';

export type ExploreKindFilter = 'politician' | 'insider' | 'fund';

export const EXPLORE_KIND_CHIPS: { id: ExploreKindFilter; label: string }[] = [
  { id: 'politician', label: 'פוליטיקאים' },
  { id: 'insider', label: 'בכירים' },
  { id: 'fund', label: 'קרנות' },
];

export const EXPLORE_KIND_TITLES: Record<ExploreKindFilter, string> = {
  politician: 'פוליטיקאים',
  insider: 'בכירים',
  fund: 'קרנות',
};

export const EXPLORE_UNFILTERED_TITLE = 'פרופילים';

export function exploreKindGridTitle(kind: ExploreKindFilter | null): string {
  return kind ? EXPLORE_KIND_TITLES[kind] : EXPLORE_UNFILTERED_TITLE;
}

export function matchesExploreKind(
  person: ExplorePerson,
  kind: ExploreKindFilter | null | undefined
): boolean {
  if (!kind) return true;
  if (kind === 'politician') return person.kind === 'politician';
  if (kind === 'insider') return person.kind === 'insider';
  if (kind === 'fund') return person.kind === 'fund_manager';
  return true;
}

/** גודל כרטיס 2-col — אחיד לרייל, 2-col וגריד. 390pt / pad 20 / gap 10 → רוחב 170; aspect = w/h. */
export const EXPLORE_GRID_COLS = 2;
export const EXPLORE_GRID_ROWS = 2;
export const EXPLORE_GRID_GAP = 10;
export const EXPLORE_RAIL_GAP = 10;
/** נמוך יותר = כרטיס גבוה יותר (רוחב קבוע). */
export const EXPLORE_GRID_ASPECT = 0.85;
export const EXPLORE_PROFILE_CARD = {
  width: 170,
  height: Math.round(170 / EXPLORE_GRID_ASPECT),
} as const;
export const EXPLORE_RAIL_CARD = EXPLORE_PROFILE_CARD;
export const EXPLORE_FEATURED_LIMIT = 16;
export const EXPLORE_RAIL_LIMIT = 24;

/** עמודות לרייל אופקי דו-שורתי — אותם כרטיסים, גלילה לעוד אנשים. */
export function chunkExploreColumns<T>(
  items: T[],
  rows: number = EXPLORE_GRID_ROWS
): T[][] {
  const n = Math.max(1, rows);
  const cols: T[][] = [];
  for (let i = 0; i < items.length; i += n) {
    cols.push(items.slice(i, i + n));
  }
  return cols;
}

/** תמיד רוחב כרטיס הפרופיל הקבוע — לא לפי מסך / קטגוריה. */
export function exploreGridCardWidth(
  _screenWidth?: number,
  _screenPad?: number,
  _cols?: number,
  _gap?: number
): number {
  return EXPLORE_PROFILE_CARD.width;
}

/** סינון מדף לפי צ'יפ קטגוריה — בלי גריד «כל הפרופילים». */
export function filterExplorePeopleByKind(
  people: ExplorePerson[],
  kind: ExploreKindFilter | null | undefined
): ExplorePerson[] {
  if (!kind) return people;
  return people.filter((p) => matchesExploreKind(p, kind));
}

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
  if (direct && looksLikePersonPhoto(direct)) {
    if (person.kind === 'politician' || isTrustedPortraitUrl(direct)) return direct;
  }

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

  const kind = opts?.kind;
  if (kind) {
    list = list.filter((p) => matchesExploreKind(p, kind));
  }

  const q = opts?.query?.trim().toLowerCase();
  if (q) {
    list = list.filter((p) => explorePersonMatchesQuery(p, q));
  }

  return list;
}

const PARTY_ALIASES: Record<string, string[]> = {
  d: ['democrat', 'democratic', 'דמוקרט', 'דמוקרטית', 'דמוקרטים'],
  r: ['republican', 'רפובליקני', 'רפובליקנית', 'רפובליקנים'],
};

function exploreHaystack(person: ExplorePerson): string {
  return [person.name, person.subtitle, person.ticker ?? '', person.kind]
    .join(' ')
    .toLowerCase();
}

/** חיפוש שם / טיקר / מפלגה / בית — מול subtitle שכבר מכיל Party/Chamber. */
export function explorePersonMatchesQuery(person: ExplorePerson, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const hay = exploreHaystack(person);
  if (hay.includes(q)) return true;
  for (const aliases of Object.values(PARTY_ALIASES)) {
    if (aliases.some((a) => a.includes(q) || q.includes(a))) {
      if (aliases.some((a) => hay.includes(a))) return true;
    }
  }
  return false;
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
