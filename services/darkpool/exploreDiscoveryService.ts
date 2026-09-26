/**
 * מדפי גילוי ממקורות אמת — COUNT עסקאות, 13F last_value_usd, featured.created_at.
 * בלי שווי תיק מטווחי STOCK Act ובלי תשואת ALL משוחזרת.
 */

import { supabase } from '../../lib/supabase';
import { knownPortraitForInvestor } from '../../screens/DarkPool/utils/knownInvestorPortraits';
import {
  formatReported13fValueHe,
  formatTradeCountHe,
} from '../../screens/DarkPool/utils/exploreDisplay';
import type { ExplorePerson } from './uwExploreService';
import {
  filterCuratedExplorePeople,
  isCuratedExploreId,
  isTrustedPortraitUrl,
  listCuratedInsiderExplorePeople,
} from '../../screens/DarkPool/utils/curatedExploreProfiles';

const CONGRESS_PHOTO = 'https://unitedstates.github.io/images/congress/225x275';

export type DatedExplorePerson = ExplorePerson & {
  last_filed_at?: string;
};

export interface ExploreDiscoveryExtras {
  most_active: ExplorePerson[];
  recently_active_insiders: DatedExplorePerson[];
  fund_books: ExplorePerson[];
  new_profiles: ExplorePerson[];
  executives: ExplorePerson[];
}

export const EMPTY_EXPLORE_DISCOVERY: ExploreDiscoveryExtras = {
  most_active: [],
  recently_active_insiders: [],
  fund_books: [],
  new_profiles: [],
  executives: [],
};

function congressPhoto(id: string, image: string | null | undefined): string | null {
  if (image?.trim()) return image.trim();
  if (/^[A-Z]\d{6}$/.test(id)) return `${CONGRESS_PHOTO}/${id}.jpg`;
  return knownPortraitForInvestor({ personId: id, name: '' });
}

function formatInsiderName(raw: string): string {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return raw;
  const last = parts[0];
  const rest = parts.slice(1).join(' ');
  return `${rest} ${last}`.trim();
}

async function listMostActivePoliticians(limit: number): Promise<ExplorePerson[]> {
  const { data, error } = await supabase
    .from('dark_pool_congress_trades')
    .select('politician_id, politician_name, politician_image_url')
    .limit(2500);

  if (error) throw error;

  const byId = new Map<
    string,
    { id: string; name: string; image: string | null; count: number }
  >();
  for (const row of data ?? []) {
    const id = String(row.politician_id ?? '').trim();
    const name = String(row.politician_name ?? '').trim();
    if (!id || !name) continue;
    const prev = byId.get(id);
    if (prev) {
      prev.count += 1;
      continue;
    }
    byId.set(id, {
      id,
      name,
      image: row.politician_image_url ? String(row.politician_image_url) : null,
      count: 1,
    });
  }

  return filterCuratedExplorePeople(
    Array.from(byId.values())
      .sort((a, b) => b.count - a.count)
      .map((p) => {
      const metric = formatTradeCountHe(p.count);
      return {
        id: p.id,
        name: p.name,
        subtitle: metric ?? 'קונגרס',
        image_url: congressPhoto(p.id, p.image),
        kind: 'politician' as const,
        activity_score: p.count,
        metric: metric ?? undefined,
      };
      })
  ).slice(0, limit);
}

async function listRecentlyActiveInsiders(
  limit: number
): Promise<DatedExplorePerson[]> {
  const { data, error } = await supabase
    .from('dark_pool_insider_buys')
    .select('insider_name, insider_logo_url, ticker, filed_at, company_name, insider_role')
    .order('filed_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  const seen = new Set<string>();
  const out: DatedExplorePerson[] = [];
  for (const row of data ?? []) {
    const ticker = String(row.ticker ?? '').toUpperCase();
    const rawName = String(row.insider_name ?? '').trim();
    if (!ticker || !rawName) continue;
    const id = `${ticker}:${rawName}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const name = formatInsiderName(rawName);
    const image =
      (row.insider_logo_url ? String(row.insider_logo_url) : null) ||
      knownPortraitForInvestor({ personId: id, name });
    out.push({
      id,
      name,
      subtitle: [row.insider_role, row.company_name, ticker].filter(Boolean).join(' · '),
      image_url: image,
      kind: 'insider',
      ticker,
      last_filed_at: String(row.filed_at ?? ''),
    });
    if (out.length >= limit) break;
  }
  return filterCuratedExplorePeople(out);
}

async function listReportedFundBooks(limit: number): Promise<ExplorePerson[]> {
  const { data, error } = await supabase
    .from('dark_pool_fund_managers')
    .select('cik, name, manager_name, image_url, last_value_usd')
    .not('last_value_usd', 'is', null)
    .gt('last_value_usd', 0)
    .order('last_value_usd', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const cik = String(row.cik ?? '').trim();
      const fundName = String(row.name ?? '').trim();
      const manager = row.manager_name ? String(row.manager_name).trim() : '';
      const value = Number(row.last_value_usd);
      const metric = formatReported13fValueHe(value);
      if (!cik || !metric) return null;
      const name = manager || fundName || cik;
      return {
        id: cik,
        name,
        subtitle: manager && fundName && manager !== fundName ? fundName : 'פוזיציות 13F מדווחות',
        image_url:
          (row.image_url ? String(row.image_url) : null) ||
          knownPortraitForInvestor({ personId: cik, name }),
        kind: 'fund_manager' as const,
        metric,
        portfolio_value: value,
      };
    })
    .filter((p): p is ExplorePerson => p != null);
}

async function listRecentlyAddedFeatured(limit: number): Promise<ExplorePerson[]> {
  const { data, error } = await supabase
    .from('dark_pool_featured_profiles')
    .select('name, subtitle, image_url, person_id, kind, ticker, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const id = String(row.person_id ?? '').trim();
      const name = String(row.name ?? '').trim();
      const kind = row.kind as ExplorePerson['kind'];
      if (!id || !name) return null;
      if (kind !== 'politician' && kind !== 'insider' && kind !== 'fund_manager') {
        return null;
      }
      if (!isCuratedExploreId(id)) return null;
      const image =
        (row.image_url && isTrustedPortraitUrl(String(row.image_url))
          ? String(row.image_url)
          : null) || knownPortraitForInvestor({ personId: id, name });
      return {
        id,
        name,
        subtitle: String(row.subtitle ?? '').trim(),
        image_url: image,
        kind,
        ticker: row.ticker ? String(row.ticker) : undefined,
      };
    })
    .filter((p): p is ExplorePerson => p != null);
}

async function listExploreExecutives(limit: number): Promise<ExplorePerson[]> {
  return listCuratedInsiderExplorePeople().slice(0, limit);
}

export async function fetchExploreDiscoveryExtras(
  limit = 24
): Promise<ExploreDiscoveryExtras> {
  const [most_active, recently_active_insiders, fund_books, new_profiles, executives] =
    await Promise.all([
      listMostActivePoliticians(limit).catch(() => []),
      listRecentlyActiveInsiders(limit).catch(() => []),
      listReportedFundBooks(limit).catch(() => []),
      listRecentlyAddedFeatured(limit).catch(() => []),
      listExploreExecutives(limit).catch(() => []),
    ]);

  return {
    most_active,
    recently_active_insiders,
    fund_books,
    new_profiles,
    executives,
  };
}
