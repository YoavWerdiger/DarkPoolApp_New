/**
 * תמונות פרופיל מ-cache ב-DB — Client לא פונה ל-Wikipedia ב-runtime.
 */

import { supabase } from '../../lib/supabase';

export type PersonPortraitKind = 'politician' | 'insider' | 'fund_manager';

export interface PersonPortrait {
  person_id: string;
  kind: PersonPortraitKind;
  display_name: string | null;
  ticker: string | null;
  image_url: string | null;
  source: string | null;
}

const memCache = new Map<string, { at: number; url: string | null }>();
const MEM_MS = 10 * 60 * 1000;

function fromMem(personId: string): string | null | undefined {
  const hit = memCache.get(personId);
  if (!hit) return undefined;
  if (Date.now() - hit.at > MEM_MS) {
    memCache.delete(personId);
    return undefined;
  }
  return hit.url;
}

export async function fetchPersonPortrait(personId: string): Promise<string | null> {
  const id = personId.trim();
  if (!id) return null;

  const cached = fromMem(id);
  if (cached !== undefined) return cached;

  const { data, error } = await supabase
    .from('dark_pool_person_portraits')
    .select('image_url')
    .eq('person_id', id)
    .maybeSingle();

  if (error) throw error;
  const url =
    typeof data?.image_url === 'string' && data.image_url.trim()
      ? data.image_url.trim()
      : null;
  memCache.set(id, { at: Date.now(), url });
  return url;
}

/** batch — למסך גילוי / רשימות */
export async function fetchPersonPortraitsByIds(
  personIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(personIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, string>();
  if (!unique.length) return out;

  const missing: string[] = [];
  for (const id of unique) {
    const mem = fromMem(id);
    if (mem !== undefined) {
      if (mem) out.set(id, mem);
      continue;
    }
    missing.push(id);
  }

  const CHUNK = 80;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const chunk = missing.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('dark_pool_person_portraits')
      .select('person_id, image_url')
      .in('person_id', chunk)
      .not('image_url', 'is', null);

    if (error) throw error;

    for (const id of chunk) {
      memCache.set(id, { at: Date.now(), url: null });
    }

    for (const row of data ?? []) {
      const pid = String(row.person_id);
      const url = String(row.image_url).trim();
      if (url) {
        out.set(pid, url);
        memCache.set(pid, { at: Date.now(), url });
      }
    }
  }

  return out;
}

export async function triggerPersonPortraitSync(force = false): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-person-portraits', {
    body: { force, limit: 100 },
  });
  if (error) throw error;
}

export function clearPersonPortraitMemCache() {
  memCache.clear();
}

/** @deprecated לגריד גילוי — השתמש ב-fetchCuratedExploreGrid */
export async function fetchExploreProfilesGrid(): Promise<
  import('./uwExploreService').ExplorePerson[]
> {
  const { data, error } = await supabase
    .from('dark_pool_person_portraits')
    .select('person_id, kind, display_name, ticker, image_url, source')
    .not('image_url', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(120);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const kind = row.kind as 'politician' | 'insider' | 'fund_manager';
    return {
      id: String(row.person_id),
      name: String(row.display_name ?? row.person_id),
      subtitle:
        kind === 'politician'
          ? 'קונגרס'
          : row.ticker
            ? String(row.ticker)
            : 'Form 4',
      image_url: String(row.image_url),
      kind: kind === 'fund_manager' ? 'insider' : kind,
      ticker: row.ticker ? String(row.ticker) : undefined,
      activity_score: row.source === 'wikipedia' ? 80 : 60,
    };
  });
}
