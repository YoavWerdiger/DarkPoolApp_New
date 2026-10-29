import { supabase } from '../../lib/supabase';
import type { ExplorePerson } from './uwExploreService';
import { knownPortraitForInvestor } from '../../screens/DarkPool/utils/knownInvestorPortraits';
import {
  ALL_CURATED_EXPLORE_PROFILES,
  CURATED_EXPLORE_PROFILES,
  isCuratedExploreId,
  isTrustedPortraitUrl,
} from '../../screens/DarkPool/utils/curatedExploreProfiles';
import { buildExploreProfileGrid } from '../../screens/DarkPool/utils/exploreGrid';
import { formatHebrewAgo } from '../../screens/DarkPool/utils/congressTradeDisplay';

export interface FeaturedProfile {
  id: string;
  sort_order: number;
  name: string;
  subtitle: string | null;
  image_url: string | null;
  person_id: string;
  kind: ExplorePerson['kind'];
  ticker: string | null;
}

let cache: { at: number; data: FeaturedProfile[] } | null = null;
const CACHE_MS = 30 * 60 * 1000;

export async function fetchFeaturedProfiles(force = false): Promise<FeaturedProfile[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }

  const { data, error } = await supabase
    .from('dark_pool_featured_profiles')
    .select('id, sort_order, name, subtitle, image_url, person_id, kind, ticker')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []).map((r) => ({
    id: String(r.id),
    sort_order: Number(r.sort_order),
    name: String(r.name),
    subtitle: r.subtitle ? String(r.subtitle) : null,
    image_url: r.image_url ? String(r.image_url) : null,
    person_id: String(r.person_id),
    kind: r.kind as FeaturedProfile['kind'],
    ticker: r.ticker ? String(r.ticker) : null,
  }));

  cache = { at: Date.now(), data: rows };
  return rows;
}

export function featuredToExplorePerson(row: FeaturedProfile): ExplorePerson {
  const image_url =
    row.image_url ||
    knownPortraitForInvestor({ personId: row.person_id, name: row.name });
  return {
    id: row.person_id,
    name: row.name,
    subtitle: row.subtitle ?? '',
    image_url,
    kind: row.kind,
    ticker: row.ticker ?? undefined,
    metric_label: 'מומלץ',
  };
}

/**
 * גריד גילוי — רק פרופילים מאוצרים (CURATED_EXPLORE_PROFILES + מומלצים מ-DB שברשימה).
 * פיד העסקאות נשאר גלובלי בנפרד — לא מערבבים כאן.
 */
/** סטטי מיידי — בלי רשת; ל-placeholderData / first paint */
export function getCuratedExploreSync(): ExplorePerson[] {
  return ALL_CURATED_EXPLORE_PROFILES.map((p) => ({ ...p }));
}

export async function fetchCuratedExploreGrid(): Promise<ExplorePerson[]> {
  const byId = new Map<string, ExplorePerson>();
  for (const p of ALL_CURATED_EXPLORE_PROFILES) {
    byId.set(p.id, { ...p });
  }

  try {
    const featured = await fetchFeaturedProfiles();
    for (const row of featured) {
      if (!isCuratedExploreId(row.person_id)) continue;
      const existing = byId.get(row.person_id);
      const dbImage =
        row.image_url && isTrustedPortraitUrl(row.image_url) ? row.image_url : null;
      if (existing) {
        if (dbImage) existing.image_url = dbImage;
        if (row.subtitle?.trim()) existing.subtitle = row.subtitle;
      } else {
        byId.set(row.person_id, featuredToExplorePerson(row));
      }
    }
  } catch {
    /* static list is enough */
  }

  return Array.from(byId.values()).sort(
    (a, b) => (b.activity_score ?? 0) - (a.activity_score ?? 0)
  );
}

/**
 * פס אנשים / גילוי — רק פרופילים מאוצרים עם נתונים אמיתיים (Quiver / 13F).
 * לא מושך uw-explore / Form4 אקראיים (SPVs וכו׳).
 */
export function getExplorePeopleMergedSync(opts?: {
  requirePhoto?: boolean;
}): ExplorePerson[] {
  return buildExploreProfileGrid(getCuratedExploreSync(), {
    requirePhoto: opts?.requirePhoto,
  });
}

/**
 * כל חברי הקונגרס שסחרו בשנתיים האחרונות (מקובץ בשרת — RPC dark_pool_active_congress_people).
 * מצטרפים לגריד אחרי המאוצרים (activity_score נמוך מהם), לפי כמות עסקאות.
 * אם ה-RPC עוד לא קיים / נכשל — רק המאוצרים (כמו קודם).
 */
async function fetchActiveCongressPeople(): Promise<ExplorePerson[]> {
  try {
    const { data, error } = await supabase.rpc('dark_pool_active_congress_people', {
      p_days: 730,
      p_limit: 200,
    });
    if (error || !Array.isArray(data)) {
      if (__DEV__) console.warn('[explore] dark_pool_active_congress_people failed:', error?.message ?? data);
      return [];
    }
    const maxTrades = Math.max(1, ...data.map((r: { trades_count: number }) => Number(r.trades_count) || 0));
    return data
      .filter((r: { politician_id?: string; politician_name?: string }) => r.politician_id && r.politician_name)
      .map(
        (r: {
          politician_id: string;
          politician_name: string;
          politician_image_url: string | null;
          trades_count: number;
          last_filed_at: string | null;
        }): ExplorePerson => {
          const ago = formatHebrewAgo(r.last_filed_at);
          return {
            id: r.politician_id,
            name: r.politician_name,
            subtitle: ago ? `קונגרס · דיווח ${ago}` : 'קונגרס',
            image_url: r.politician_image_url,
            kind: 'politician',
            // תמיד מתחת למאוצרים (שמתחילים ~60+), יחסית לכמות העסקאות
            activity_score: 50 * ((Number(r.trades_count) || 0) / maxTrades),
          };
        }
      );
  } catch {
    return [];
  }
}

export async function fetchExplorePeopleMerged(opts?: {
  requirePhoto?: boolean;
}): Promise<ExplorePerson[]> {
  const [curated, congress] = await Promise.all([
    fetchCuratedExploreGrid(),
    fetchActiveCongressPeople(),
  ]);
  const curatedIds = new Set(curated.map((p) => p.id));
  return buildExploreProfileGrid(
    [...curated, ...congress.filter((p) => !curatedIds.has(p.id))],
    { requirePhoto: opts?.requirePhoto }
  );
}
