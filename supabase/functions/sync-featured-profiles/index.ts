// sync-featured-profiles — person_id + תמונות מ-DB / UW / Wikimedia

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  fetchUwInsidersForTicker,
  fetchUwInsiderTransactions,
  resolveUwLogoUrl,
} from '../_shared/unusualWhales.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WIKI = 'https://upload.wikimedia.org/wikipedia/commons';

const KNOWN_BY_ID: Record<string, string> = {
  G000583: 'https://unitedstates.github.io/images/congress/225x275/G000583.jpg',
  P000197: 'https://unitedstates.github.io/images/congress/225x275/P000197.jpg',
  '1067983': `${WIKI}/5/51/Warren_Buffett_KU_Visit.jpg`,
  '1697748': `${WIKI}/7/7e/Cathie_Wood_%28cropped%29.jpg`,
  '1336528': `${WIKI}/4/4a/Bill_Ackman_2019.jpg`,
};

const KNOWN_BY_NAME: Record<string, string> = {
  'elon musk': `${WIKI}/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg`,
  'tim cook': `${WIKI}/2/23/Tim_Cook_2009_cropped.jpg`,
  'warren buffett': KNOWN_BY_ID['1067983'],
  'cathie wood': KNOWN_BY_ID['1697748'],
  'bill ackman': KNOWN_BY_ID['1336528'],
  'nancy pelosi': KNOWN_BY_ID.P000197,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );
  const uwKey = Deno.env.get('UNUSUAL_WHALES_API_KEY') || '';

  const { data: rows, error } = await supabase
    .from('dark_pool_featured_profiles')
    .select('id, name, person_id, kind, ticker, image_url')
    .eq('is_active', true);

  if (error) return json({ error: error.message }, 500);

  const updates: Array<{
    id: string;
    person_id?: string;
    name?: string;
    subtitle?: string;
    image_url?: string | null;
  }> = [];

  for (const row of rows ?? []) {
    const kind = String(row.kind);
    const name = String(row.name ?? '');
    const ticker = row.ticker ? String(row.ticker).toUpperCase() : null;
    const patch: {
      id: string;
      person_id?: string;
      name?: string;
      subtitle?: string;
      image_url?: string | null;
    } = {
      id: String(row.id),
    };

    if (kind === 'insider') {
      const resolved = await resolveInsider(supabase, uwKey, name, ticker);
      if (resolved?.id && resolved.id !== row.person_id) patch.person_id = resolved.id;
      const img =
        resolved?.image_url ||
        row.image_url ||
        knownPortrait(name, resolved?.id ?? String(row.person_id));
      if (img && img !== row.image_url) patch.image_url = img;
    } else if (kind === 'politician') {
      const personId = String(row.person_id);
      const tradeCount = await countPoliticianTrades(supabase, personId);
      if (tradeCount === 0) {
        const top = await topPoliticianFromDb(supabase);
        if (top) {
          patch.person_id = top.politician_id;
          patch.name = top.politician_name;
          patch.subtitle = 'House · קונגרס';
          patch.image_url =
            top.politician_image_url ||
            congressPhoto(top.politician_id) ||
            row.image_url;
        }
      } else {
        const pid = await resolvePoliticianId(supabase, name, personId);
        if (pid && pid !== personId) patch.person_id = pid;
        const img =
          row.image_url ||
          knownPortrait(name, pid ?? personId) ||
          congressPhoto(pid ?? personId);
        if (img && img !== row.image_url) patch.image_url = img;
      }
    } else if (kind === 'fund_manager') {
      const cik = String(row.person_id);
      const { data: fm } = await supabase
        .from('dark_pool_fund_managers')
        .select('image_url')
        .eq('cik', cik)
        .maybeSingle();
      const img =
        fm?.image_url ||
        row.image_url ||
        knownPortrait(name, cik);
      if (img && img !== row.image_url) patch.image_url = img;
      if (img && !fm?.image_url) {
        await supabase.from('dark_pool_fund_managers').update({ image_url: img }).eq('cik', cik);
      }
    }

    if (patch.person_id || patch.name || patch.subtitle || patch.image_url !== undefined) {
      updates.push(patch);
    }
  }

  for (const u of updates) {
    const payload: Record<string, unknown> = {};
    if (u.person_id) payload.person_id = u.person_id;
    if (u.name) payload.name = u.name;
    if (u.subtitle) payload.subtitle = u.subtitle;
    if (u.image_url !== undefined) payload.image_url = u.image_url;
    if (Object.keys(payload).length) {
      await supabase.from('dark_pool_featured_profiles').update(payload).eq('id', u.id);
    }
  }

  return json({
    ok: true,
    updated: updates.length,
    updates,
    synced_at: new Date().toISOString(),
  });
});

async function resolveInsider(
  supabase: ReturnType<typeof createClient>,
  uwKey: string,
  displayName: string,
  ticker: string | null
): Promise<{ id: string; image_url: string | null } | null> {
  const needle = displayName.split(/\s+/).pop()?.toLowerCase() ?? displayName.toLowerCase();

  let q = supabase
    .from('dark_pool_insider_buys')
    .select('insider_name, insider_logo_url, ticker')
    .ilike('insider_name', `%${needle}%`)
    .order('filed_at', { ascending: false })
    .limit(20);

  if (ticker) q = q.eq('ticker', ticker);

  const { data } = await q;
  const hit = (data ?? []).find((r) => r.insider_name && r.ticker);
  if (hit?.insider_name && hit?.ticker) {
    return {
      id: `${String(hit.ticker).toUpperCase()}:${String(hit.insider_name).trim()}`,
      image_url: hit.insider_logo_url ? String(hit.insider_logo_url) : null,
    };
  }

  if (uwKey && ticker) {
    try {
      const roster = await fetchUwInsidersForTicker(uwKey, ticker);
      const last = displayName.split(/\s+/).pop()?.toUpperCase() ?? '';
      const match = roster.find((r) => {
        const n = `${r.display_name || r.name || ''}`.toUpperCase();
        return n.includes(last) || last.includes(n.split(' ')[0] ?? '');
      });
      if (match) {
        const n = String(match.display_name || match.name || '').trim();
        if (n) {
          return { id: `${ticker}:${n}`, image_url: resolveUwLogoUrl(match) };
        }
      }
    } catch {
      /* noop */
    }
  }

  if (uwKey) {
    try {
      const uw = await fetchUwInsiderTransactions(uwKey, {
        owner_name: displayName.split(' ').pop() ?? displayName,
        ticker_symbol: ticker ?? undefined,
        limit: 5,
        maxPages: 1,
      });
      const t = uw[0];
      const n = String(t?.owner_name ?? '').trim();
      const sym = String(t?.ticker ?? ticker ?? '').toUpperCase();
      if (n && sym) return { id: `${sym}:${n}`, image_url: resolveUwLogoUrl(t) };
    } catch {
      /* noop */
    }
  }

  return null;
}

async function countPoliticianTrades(
  supabase: ReturnType<typeof createClient>,
  politicianId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('dark_pool_congress_trades')
    .select('external_id', { count: 'exact', head: true })
    .eq('politician_id', politicianId);
  if (error) return 0;
  return count ?? 0;
}

async function topPoliticianFromDb(
  supabase: ReturnType<typeof createClient>
): Promise<{
  politician_id: string;
  politician_name: string;
  politician_image_url: string | null;
} | null> {
  const { data, error } = await supabase
    .from('dark_pool_congress_trades')
    .select('politician_id, politician_name, politician_image_url')
    .order('filed_at', { ascending: false })
    .limit(500);
  if (error || !data?.length) return null;

  const counts = new Map<
    string,
    { politician_id: string; politician_name: string; politician_image_url: string | null; c: number }
  >();
  for (const row of data) {
    const id = String(row.politician_id ?? '');
    if (!id) continue;
    const cur = counts.get(id);
    if (cur) cur.c += 1;
    else {
      counts.set(id, {
        politician_id: id,
        politician_name: String(row.politician_name ?? ''),
        politician_image_url: row.politician_image_url
          ? String(row.politician_image_url)
          : null,
        c: 1,
      });
    }
  }

  const sorted = Array.from(counts.values()).sort((a, b) => {
    const aBio = /^[A-Z]\d{6}$/.test(a.politician_id) ? 1 : 0;
    const bBio = /^[A-Z]\d{6}$/.test(b.politician_id) ? 1 : 0;
    if (bBio !== aBio) return bBio - aBio;
    return b.c - a.c;
  });
  const top = sorted[0];
  return top
    ? {
        politician_id: top.politician_id,
        politician_name: top.politician_name,
        politician_image_url: top.politician_image_url,
      }
    : null;
}

async function resolvePoliticianId(
  supabase: ReturnType<typeof createClient>,
  displayName: string,
  currentId?: string
): Promise<string | null> {
  if (currentId && /^[A-Z]\d{6}$/.test(currentId)) {
    const n = await countPoliticianTrades(supabase, currentId);
    if (n > 0) return currentId;
  }

  const needle = displayName.split(/\s+/).pop() ?? displayName;
  const { data } = await supabase
    .from('dark_pool_congress_trades')
    .select('politician_id, politician_name')
    .ilike('politician_name', `%${needle}%`)
    .order('filed_at', { ascending: false })
    .limit(40);

  if (!data?.length) return null;

  const byId = new Map<string, number>();
  for (const row of data) {
    const id = String(row.politician_id ?? '');
    if (!id) continue;
    byId.set(id, (byId.get(id) ?? 0) + 1);
  }

  const ranked = Array.from(byId.entries()).sort((a, b) => {
    const aBio = /^[A-Z]\d{6}$/.test(a[0]) ? 1 : 0;
    const bBio = /^[A-Z]\d{6}$/.test(b[0]) ? 1 : 0;
    if (bBio !== aBio) return bBio - aBio;
    return b[1] - a[1];
  });
  return ranked[0]?.[0] ?? null;
}

function knownPortrait(name: string, personId?: string): string | null {
  const id = personId?.trim();
  if (id && KNOWN_BY_ID[id]) return KNOWN_BY_ID[id];
  const key = name.trim().toLowerCase();
  if (KNOWN_BY_NAME[key]) return KNOWN_BY_NAME[key];
  if (id?.toUpperCase().includes('MUSK')) return KNOWN_BY_NAME['elon musk'];
  if (id?.toUpperCase().includes('COOK') || key.includes('cook')) {
    return KNOWN_BY_NAME['tim cook'];
  }
  return null;
}

function congressPhoto(bioguide: string): string | null {
  if (/^[A-Z]\d{6}$/.test(bioguide)) {
    return `https://unitedstates.github.io/images/congress/225x275/${bioguide}.jpg`;
  }
  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
