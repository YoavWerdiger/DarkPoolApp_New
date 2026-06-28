/**
 * גילוי מ-DB בלבד — SEC / דיווחים ציבוריים (בלי UW/Quiver live).
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';

const CONGRESS_PHOTO = 'https://unitedstates.github.io/images/congress/225x275';

export interface DbExplorePerson {
  id: string;
  name: string;
  subtitle: string;
  image_url: string | null;
  metric?: string;
  metric_label?: string;
  activity_score?: number;
  kind: 'politician' | 'insider';
  ticker?: string;
}

export interface DbExplorePayload {
  most_followed: DbExplorePerson[];
  executives: DbExplorePerson[];
  top_active: DbExplorePerson[];
  recently_active: DbExplorePerson[];
  insiders_with_photo: DbExplorePerson[];
  warnings: string[];
  fetched_at: string;
  source: 'public_filings';
}

export async function buildExploreFromDb(
  supabase: SupabaseClient
): Promise<DbExplorePayload> {
  const warnings: string[] = [];

  const [congressRes, insiderRes, featuredRes] = await Promise.all([
    supabase
      .from('dark_pool_congress_trades')
      .select('politician_id, politician_name, politician_image_url, filed_at')
      .order('filed_at', { ascending: false })
      .limit(400),
    supabase
      .from('dark_pool_insider_buys')
      .select('insider_name, insider_logo_url, ticker, filed_at, company_name')
      .order('filed_at', { ascending: false })
      .limit(400),
    supabase
      .from('dark_pool_featured_profiles')
      .select('name, subtitle, image_url, person_id, kind, ticker')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ]);

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
    const cur = polMap.get(id);
    const filed = String(row.filed_at ?? '');
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

  const polRanked = Array.from(polMap.values()).sort((a, b) => b.count - a.count);
  const politicians: DbExplorePerson[] = polRanked.slice(0, 24).map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: 'קונגרס · STIR',
    image_url:
      p.image ||
      (/^[A-Z]\d{6}$/.test(p.id) ? `${CONGRESS_PHOTO}/${p.id}.jpg` : null),
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
    }
  >();
  for (const row of insiderRes.data ?? []) {
    const ticker = String(row.ticker ?? '').toUpperCase();
    const name = String(row.insider_name ?? '').trim();
    if (!ticker || !name) continue;
    const id = `${ticker}:${name}`;
    const cur = insMap.get(id);
    if (cur) cur.count += 1;
    else {
      insMap.set(id, {
        id,
        name,
        ticker,
        image: row.insider_logo_url ? String(row.insider_logo_url) : null,
        count: 1,
        company: row.company_name ? String(row.company_name) : null,
      });
    }
  }

  const insiders: DbExplorePerson[] = Array.from(insMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)
    .map((p) => ({
      id: p.id,
      name: p.name,
      subtitle: p.company ? `${p.company} · ${p.ticker}` : p.ticker,
      image_url: p.image,
      metric: String(p.count),
      metric_label: 'Form 4',
      activity_score: p.count,
      kind: 'insider' as const,
      ticker: p.ticker,
    }));

  const featured: DbExplorePerson[] = (featuredRes.data ?? [])
    .filter((f) => f.kind === 'politician' || f.kind === 'insider')
    .map((f) => ({
      id: String(f.person_id),
      name: String(f.name),
      subtitle: String(f.subtitle ?? ''),
      image_url: f.image_url ? String(f.image_url) : null,
      kind: f.kind as 'politician' | 'insider',
      ticker: f.ticker ? String(f.ticker) : undefined,
      metric_label: 'מומלץ',
    }));

  if (!politicians.length && !insiders.length) {
    warnings.push('אין עדיין עסקאות ב-DB — הרץ sync-insider-buys ו-sync-congress-trades');
  }

  const topActive = [...politicians].slice(0, 10);
  const recentlyActive = [...politicians]
    .sort((a, b) => (b.activity_score ?? 0) - (a.activity_score ?? 0))
    .slice(0, 10);

  const payload: DbExplorePayload = {
    most_followed: featured.length ? featured : topActive.slice(0, 8),
    executives: insiders.slice(0, 12),
    top_active: topActive,
    recently_active: recentlyActive,
    insiders_with_photo: insiders,
    warnings,
    fetched_at: new Date().toISOString(),
    source: 'public_filings',
  };

  return enrichExplorePayloadWithPortraits(supabase, payload);
}

async function enrichExplorePayloadWithPortraits(
  supabase: SupabaseClient,
  payload: DbExplorePayload
): Promise<DbExplorePayload> {
  const people = [
    ...payload.most_followed,
    ...payload.top_active,
    ...payload.recently_active,
    ...payload.executives,
    ...payload.insiders_with_photo,
  ];
  const ids = [...new Set(people.map((p) => p.id))].slice(0, 80);
  if (!ids.length) return payload;

  const { data } = await supabase
    .from('dark_pool_person_portraits')
    .select('person_id, image_url')
    .in('person_id', ids)
    .not('image_url', 'is', null);

  const map = new Map(
    (data ?? []).map((r) => [String(r.person_id), String(r.image_url)])
  );
  if (!map.size) return payload;

  const merge = (list: DbExplorePerson[]) =>
    list.map((p) => (map.has(p.id) ? { ...p, image_url: map.get(p.id)! } : p));

  return {
    ...payload,
    most_followed: merge(payload.most_followed),
    top_active: merge(payload.top_active),
    recently_active: merge(payload.recently_active),
    executives: merge(payload.executives),
    insiders_with_photo: merge(payload.insiders_with_photo),
  };
}
