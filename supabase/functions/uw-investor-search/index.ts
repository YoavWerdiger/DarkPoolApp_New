// uw-investor-search — חיפוש פוליטיקאים / בכירים / קרנות (DB + UW)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  fetchUwInsiderTransactions,
  resolveUwLogoUrl,
} from '../_shared/unusualWhales.ts';
import {
  formatForm4InsiderName,
  resolveForm4ApiKey,
  searchForm4Insiders,
} from '../_shared/form4api.ts';
import { congressPhotoUrl, knownPortraitUrl } from '../_shared/personPortraits.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONGRESS_PHOTO = 'https://unitedstates.github.io/images/congress/225x275';

interface SearchPerson {
  id: string;
  name: string;
  subtitle: string;
  image_url: string | null;
  kind: 'politician' | 'insider' | 'fund_manager';
  ticker?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  let q = '';
  try {
    const body = await req.json();
    q = String(body.q ?? body.query ?? '').trim();
  } catch {
    return json({ error: 'q required' }, 400);
  }

  if (q.length < 2) return json({ results: [] as SearchPerson[] }, 200);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );
  const uwKey = Deno.env.get('UNUSUAL_WHALES_API_KEY') || '';
  const form4Key = resolveForm4ApiKey();

  const pattern = `%${q.replace(/[%_]/g, '')}%`;
  const results: SearchPerson[] = [];
  const seen = new Set<string>();

  const [featuredName, featuredTicker] = await Promise.all([
    supabase
      .from('dark_pool_featured_profiles')
      .select('name, subtitle, image_url, person_id, kind, ticker')
      .eq('is_active', true)
      .ilike('name', pattern)
      .limit(12),
    supabase
      .from('dark_pool_featured_profiles')
      .select('name, subtitle, image_url, person_id, kind, ticker')
      .eq('is_active', true)
      .ilike('ticker', q.toUpperCase())
      .limit(8),
  ]);

  for (const row of [...(featuredName.data ?? []), ...(featuredTicker.data ?? [])]) {
    addFeatured(row, results, seen);
  }

  const polRes = await supabase
    .from('dark_pool_congress_trades')
    .select('politician_id, politician_name, politician_image_url')
    .ilike('politician_name', pattern)
    .order('filed_at', { ascending: false })
    .limit(80);

  for (const row of polRes.data ?? []) addPolitician(row, results, seen);

  const [insNameRes, insTickerRes] = await Promise.all([
    supabase
      .from('dark_pool_insider_buys')
      .select('insider_name, insider_logo_url, ticker, insider_role, company_name')
      .ilike('insider_name', pattern)
      .order('filed_at', { ascending: false })
      .limit(80),
    supabase
      .from('dark_pool_insider_buys')
      .select('insider_name, insider_logo_url, ticker, insider_role, company_name')
      .ilike('ticker', q.toUpperCase())
      .order('filed_at', { ascending: false })
      .limit(40),
  ]);

  for (const row of [...(insNameRes.data ?? []), ...(insTickerRes.data ?? [])]) {
    addInsider(row, results, seen);
  }

  const [fundNameRes, fundMgrRes] = await Promise.all([
    supabase
      .from('dark_pool_fund_managers')
      .select('cik, name, manager_name, image_url')
      .ilike('manager_name', pattern)
      .limit(20),
    supabase
      .from('dark_pool_fund_managers')
      .select('cik, name, manager_name, image_url')
      .ilike('name', pattern)
      .limit(20),
  ]);

  for (const row of [...(fundNameRes.data ?? []), ...(fundMgrRes.data ?? [])]) {
    addFund(row, results, seen);
  }

  if (form4Key) {
    try {
      const hits = await searchForm4Insiders(form4Key, q, 15);
      for (const h of hits) {
        const name = formatForm4InsiderName(h.name);
        const tickerGuess = q.length <= 5 && q === q.toUpperCase() ? q.toUpperCase() : undefined;
        const id = tickerGuess ? `${tickerGuess}:${h.name}` : `cik:${h.cik}`;
        const key = `insider:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const role = [
          h.officerTitle?.trim(),
          h.isDirector ? 'Director' : '',
          h.isOfficer ? 'Officer' : '',
        ]
          .filter(Boolean)
          .join(' · ');
        results.push({
          id,
          name,
          subtitle: [role, tickerGuess].filter(Boolean).join(' · ') || 'בכיר · Form 4',
          image_url: null,
          kind: 'insider',
          ticker: tickerGuess,
        });
      }
    } catch (e) {
      console.warn('uw-investor-search form4', e);
    }
  }

  if (uwKey) {
    try {
      const uwRows = await fetchUwInsiderTransactions(uwKey, {
        owner_name: q,
        limit: 40,
        maxPages: 1,
      });
      for (const t of uwRows) {
        const name = String(t.owner_name ?? '').trim();
        const ticker = String(t.ticker ?? '').toUpperCase();
        if (!name || !ticker) continue;
        const id = `${ticker}:${name}`;
        const key = `insider:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          id,
          name: formatInsiderName(name),
          subtitle: [t.officer_title, ticker].filter(Boolean).join(' · '),
          image_url: resolveUwLogoUrl(t),
          kind: 'insider',
          ticker,
        });
      }
    } catch (e) {
      console.warn('uw-investor-search uw', e);
    }
  }

  return json(
    {
      results: await enrichSearchWithPortraits(supabase, results.slice(0, 24)),
      q,
      fetched_at: new Date().toISOString(),
    },
    200
  );
});

async function enrichSearchWithPortraits(
  supabase: ReturnType<typeof createClient>,
  results: SearchPerson[]
): Promise<SearchPerson[]> {
  const ids = results.map((r) => r.id).filter(Boolean);
  if (!ids.length) return results;

  const { data } = await supabase
    .from('dark_pool_person_portraits')
    .select('person_id, image_url')
    .in('person_id', ids.slice(0, 40))
    .not('image_url', 'is', null);

  const map = new Map(
    (data ?? []).map((r) => [String(r.person_id), String(r.image_url)])
  );

  return results.map((r) => {
    if (r.image_url) return r;
    const cached = map.get(r.id);
    if (cached) return { ...r, image_url: cached };
    const fallback =
      r.kind === 'politician'
        ? congressPhotoUrl(r.id) ?? knownPortraitUrl(r.id, r.name)
        : knownPortraitUrl(r.id, r.name);
    return fallback ? { ...r, image_url: fallback } : r;
  });
}

function addFeatured(
  row: {
    person_id?: unknown;
    name?: unknown;
    subtitle?: unknown;
    image_url?: unknown;
    kind?: unknown;
    ticker?: unknown;
  },
  results: SearchPerson[],
  seen: Set<string>
) {
  const id = String(row.person_id ?? '').trim();
  const name = String(row.name ?? '').trim();
  const kind = row.kind as SearchPerson['kind'];
  if (!id || !name || !kind) return;
  const key = `${kind}:${id}`;
  if (seen.has(key)) return;
  seen.add(key);
  results.push({
    id,
    name,
    subtitle: String(row.subtitle ?? ''),
    image_url: row.image_url ? String(row.image_url) : null,
    kind,
    ticker: row.ticker ? String(row.ticker) : undefined,
  });
}

function addPolitician(
  row: { politician_id?: unknown; politician_name?: unknown; politician_image_url?: unknown },
  results: SearchPerson[],
  seen: Set<string>
) {
  const id = String(row.politician_id ?? '').trim();
  const name = String(row.politician_name ?? '').trim();
  if (!id || !name) return;
  const key = `politician:${id}`;
  if (seen.has(key)) return;
  seen.add(key);
  let image = row.politician_image_url ? String(row.politician_image_url) : null;
  if (!image && /^[A-Z]\d{6}$/.test(id)) {
    image = `${CONGRESS_PHOTO}/${id}.jpg`;
  }
  results.push({
    id,
    name,
    subtitle: 'פוליטיקאי · STIR',
    image_url: image,
    kind: 'politician',
  });
}

function addInsider(
  row: {
    insider_name?: unknown;
    insider_logo_url?: unknown;
    ticker?: unknown;
    insider_role?: unknown;
    company_name?: unknown;
  },
  results: SearchPerson[],
  seen: Set<string>
) {
  const name = String(row.insider_name ?? '').trim();
  const ticker = String(row.ticker ?? '').toUpperCase();
  if (!name || !ticker) return;
  const id = `${ticker}:${name}`;
  const key = `insider:${id}`;
  if (seen.has(key)) return;
  seen.add(key);
  results.push({
    id,
    name: formatInsiderName(name),
    subtitle: [row.insider_role, ticker, row.company_name].filter(Boolean).join(' · '),
    image_url: row.insider_logo_url ? String(row.insider_logo_url) : null,
    kind: 'insider',
    ticker,
  });
}

function addFund(
  row: { cik?: unknown; name?: unknown; manager_name?: unknown; image_url?: unknown },
  results: SearchPerson[],
  seen: Set<string>
) {
  const id = String(row.cik ?? '').trim();
  const name = String(row.manager_name || row.name || '').trim();
  if (!id || !name) return;
  const key = `fund_manager:${id}`;
  if (seen.has(key)) return;
  seen.add(key);
  results.push({
    id,
    name,
    subtitle: `${row.name} · 13F`,
    image_url: row.image_url ? String(row.image_url) : null,
    kind: 'fund_manager',
  });
}

function formatInsiderName(raw: string): string {
  const p = raw.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return raw;
  const last = p[0];
  const rest = p.slice(1).join(' ');
  return `${rest} ${last}`.trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
