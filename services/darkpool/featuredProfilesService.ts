import { supabase } from '../../lib/supabase';
import type { ExplorePerson } from './uwExploreService';
import { knownPortraitForInvestor } from '../../screens/DarkPool/utils/knownInvestorPortraits';
import {
  CURATED_EXPLORE_PROFILES,
  isCuratedExploreId,
  isTrustedPortraitUrl,
} from '../../screens/DarkPool/utils/curatedExploreProfiles';

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
 * גריד גילוי — רק פרופילים מאוצרים (רשימה סטטית + מומלצים מ-DB שברשימה).
 * לא מושך את כל dark_pool_person_portraits (מניעת תמונות Wikipedia שגויות).
 */
export async function fetchCuratedExploreGrid(): Promise<ExplorePerson[]> {
  const byId = new Map<string, ExplorePerson>();
  for (const p of CURATED_EXPLORE_PROFILES) {
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
