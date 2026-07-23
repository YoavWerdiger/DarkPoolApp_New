/**
 * בניית מסך גילוי ישירות מ-DB (SEC) — בלי UW ובלי snapshot ישן.
 */

import { supabase } from '../../lib/supabase';
import type { ExplorePerson, UwExplorePayload } from './uwExploreService';
import { fetchPersonPortraitsByIds } from './personPortraitService';
import { knownPortraitForInvestor } from '../../screens/DarkPool/utils/knownInvestorPortraits';

const CONGRESS_PHOTO = 'https://unitedstates.github.io/images/congress/225x275';

function formatInsiderName(raw: string): string {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return raw;
  const last = parts[0];
  const rest = parts.slice(1).join(' ');
  return `${rest} ${last}`.trim();
}

function congressPhoto(id: string, image: string | null): string | null {
  if (image?.trim()) return image.trim();
  if (/^[A-Z]\d{6}$/.test(id)) return `${CONGRESS_PHOTO}/${id}.jpg`;
  return knownPortraitForInvestor({ personId: id, name: '' });
}

export function isExplorePayloadEmpty(p: UwExplorePayload | null | undefined): boolean {
  if (!p) return true;
  const total =
    (p.most_followed?.length ?? 0) +
    (p.top_active?.length ?? 0) +
    (p.recently_active?.length ?? 0) +
    (p.executives?.length ?? 0) +
    (p.insiders_with_photo?.length ?? 0);
  return total === 0;
}

export async function fetchExploreFromDbDirect(): Promise<UwExplorePayload> {
  const warnings: string[] = [];

  const [congressRes, insiderRes, featuredRes, portraitsRes] = await Promise.all([
    supabase
      .from('dark_pool_congress_trades')
      .select('politician_id, politician_name, politician_image_url, filed_at')
      .order('filed_at', { ascending: false })
      .limit(500),
    supabase
      .from('dark_pool_insider_buys')
      .select('insider_name, insider_logo_url, ticker, filed_at, company_name, insider_role')
      .order('filed_at', { ascending: false })
      .limit(500),
    supabase
      .from('dark_pool_featured_profiles')
      .select('name, subtitle, image_url, person_id, kind, ticker')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('dark_pool_person_portraits')
      .select('person_id, kind, display_name, ticker, image_url')
      .not('image_url', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(80),
  ]);

  const portraitPeople: ExplorePerson[] = (portraitsRes.data ?? []).map((row) => ({
    id: String(row.person_id),
    name: String(row.display_name ?? row.person_id),
    subtitle:
      row.kind === 'politician'
        ? 'קונגרס · STIR'
        : [row.ticker].filter(Boolean).join(' · ') || 'Form 4',
    image_url: String(row.image_url),
    kind: row.kind as 'politician' | 'insider',
    ticker: row.ticker ? String(row.ticker) : undefined,
    activity_score: 50,
  }));

  if (portraitsRes.error) warnings.push(portraitsRes.error.message);
  if (congressRes.error) warnings.push(congressRes.error.message);
  if (insiderRes.error) warnings.push(insiderRes.error.message);

  const polMap = new Map<
    string,
    { id: string; name: string; image: string | null; count: number; last: string }
  >();
  for (const row of congressRes.data ?? []) {
    const id = String(row.politician_id ?? '');
    const name = String(row.politician_name ?? '').trim();
    if (!id || !name) continue;
    const filed = String(row.filed_at ?? '');
    const cur = polMap.get(id);
    if (cur) {
      cur.count += 1;
      if (filed > cur.last) cur.last = filed;
    } else {
      polMap.set(id, {
        id,
        name,
        image: row.politician_image_url ? String(row.politician_image_url) : null,
        count: 1,
        last: filed,
      });
    }
  }

  const politicians: ExplorePerson[] = Array.from(polMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 32)
    .map((p) => ({
      id: p.id,
      name: p.name,
      subtitle: 'קונגרס · STIR',
      image_url: congressPhoto(p.id, p.image),
      metric: String(p.count),
      metric_label: 'עסקאות',
      activity_score: p.count,
      kind: 'politician' as const,
    }));

  const insMap = new Map<
    string,
    {
      id: string;
      name: string;
      ticker: string;
      image: string | null;
      count: number;
      company: string | null;
      role: string | null;
    }
  >();
  for (const row of insiderRes.data ?? []) {
    const ticker = String(row.ticker ?? '').toUpperCase();
    const rawName = String(row.insider_name ?? '').trim();
    if (!ticker || !rawName) continue;
    const id = `${ticker}:${rawName}`;
    const cur = insMap.get(id);
    if (cur) cur.count += 1;
    else {
      insMap.set(id, {
        id,
        name: formatInsiderName(rawName),
        ticker,
        image: row.insider_logo_url ? String(row.insider_logo_url) : null,
        count: 1,
        company: row.company_name ? String(row.company_name) : null,
        role: row.insider_role ? String(row.insider_role) : null,
      });
    }
  }

  const insiders: ExplorePerson[] = Array.from(insMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 32)
    .map((p) => ({
      id: p.id,
      name: p.name,
      subtitle: [p.role, p.company, p.ticker].filter(Boolean).join(' · '),
      image_url: p.image,
      metric: String(p.count),
      metric_label: 'Form 4',
      activity_score: p.count,
      kind: 'insider' as const,
      ticker: p.ticker,
    }));

  const featured: ExplorePerson[] = (featuredRes.data ?? [])
    .filter((f) => f.kind === 'politician' || f.kind === 'insider')
    .map((f) => {
      const id = String(f.person_id);
      const name = String(f.name);
      return {
        id,
        name,
        subtitle: String(f.subtitle ?? ''),
        image_url:
          (f.image_url ? String(f.image_url) : null) ||
          knownPortraitForInvestor({ personId: id, name }),
        kind: f.kind as 'politician' | 'insider',
        ticker: f.ticker ? String(f.ticker) : undefined,
        metric_label: 'מומלץ',
      };
    });

  if (!politicians.length && !insiders.length) {
    warnings.push('אין עדיין עסקאות — משוך למטה לרענון אחרי סנכרון');
  }

  const topActive = politicians.slice(0, 12);
  const recentlyActive = [...politicians]
    .sort((a, b) => (b.activity_score ?? 0) - (a.activity_score ?? 0))
    .slice(0, 12);

  const payload: UwExplorePayload = {
    most_followed: featured.length ? featured : portraitPeople.slice(0, 8).length
      ? portraitPeople.slice(0, 8)
      : topActive.slice(0, 8),
    executives: [...portraitPeople.filter((p) => p.kind === 'insider'), ...insiders],
    top_active: [...portraitPeople.filter((p) => p.kind === 'politician'), ...topActive],
    recently_active: recentlyActive,
    insiders_with_photo: [...portraitPeople.filter((p) => p.kind === 'insider'), ...insiders],
    warnings,
    fetched_at: new Date().toISOString(),
    source: 'public_filings',
  };

  return enrichExploreWithPortraits(payload);
}

async function enrichExploreWithPortraits(payload: UwExplorePayload): Promise<UwExplorePayload> {
  const allPeople = [
    ...(payload.most_followed ?? []),
    ...(payload.top_active ?? []),
    ...(payload.recently_active ?? []),
    ...(payload.executives ?? []),
    ...(payload.insiders_with_photo ?? []),
  ];
  const ids = allPeople.map((p) => p.id);
  let portraits: Map<string, string>;
  try {
    portraits = await fetchPersonPortraitsByIds(ids);
  } catch {
    return payload;
  }

  const merge = (list: ExplorePerson[] | undefined) =>
    (list ?? []).map((p) => {
      const fromDb = portraits.get(p.id);
      if (fromDb) return { ...p, image_url: fromDb };
      if (p.image_url) return p;
      const fallback = knownPortraitForInvestor({ personId: p.id, name: p.name });
      return fallback ? { ...p, image_url: fallback } : p;
    });

  return {
    ...payload,
    most_followed: merge(payload.most_followed),
    top_active: merge(payload.top_active),
    recently_active: merge(payload.recently_active),
    executives: merge(payload.executives),
    insiders_with_photo: merge(payload.insiders_with_photo),
  };
}
