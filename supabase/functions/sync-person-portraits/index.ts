// sync-person-portraits — congress + Wikipedia + known → dark_pool_person_portraits

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  congressPhotoUrl,
  delay,
  formatInsiderDisplayName,
  insiderPersonId,
  isEntityInsiderName,
  propagatePortraitsToTrades,
  resolvePortrait,
  shouldRetryPortrait,
  upsertPortrait,
  type PortraitRow,
} from '../_shared/personPortraits.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncBody {
  force?: boolean;
  limit?: number;
  kind?: 'politician' | 'insider' | 'all';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  let body: SyncBody = {};
  try {
    body = req.method === 'POST' ? await req.json() : {};
  } catch {
    body = {};
  }

  const force = body.force === true;
  const limit = Math.min(200, Math.max(10, Number(body.limit) || 80));
  const kindFilter = body.kind ?? 'all';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  const stats = {
    politicians_scanned: 0,
    politicians_resolved: 0,
    insiders_scanned: 0,
    insiders_resolved: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    if (kindFilter === 'all' || kindFilter === 'politician') {
      const polResult = await syncPoliticians(supabase, force, Math.ceil(limit / 2));
      Object.assign(stats, polResult);
    }

    if (kindFilter === 'all' || kindFilter === 'insider') {
      const insResult = await syncInsiders(supabase, force, Math.ceil(limit / 2));
      stats.insiders_scanned += insResult.insiders_scanned;
      stats.insiders_resolved += insResult.insiders_resolved;
      stats.skipped += insResult.skipped;
      stats.errors.push(...insResult.errors);
    }

    const propagated = await propagatePortraitsToTrades(supabase);

    return json(
      {
        ok: true,
        ...stats,
        propagated,
        fetched_at: new Date().toISOString(),
      },
      200
    );
  } catch (e) {
    console.error('sync-person-portraits', e);
    return json({ error: (e as Error).message, ...stats }, 500);
  }
});

async function syncPoliticians(
  supabase: ReturnType<typeof createClient>,
  force: boolean,
  limit: number
) {
  const stats = {
    politicians_scanned: 0,
    politicians_resolved: 0,
    skipped: 0,
    errors: [] as string[],
  };

  const { data: rows, error } = await supabase
    .from('dark_pool_congress_trades')
    .select('politician_id, politician_name')
    .order('filed_at', { ascending: false })
    .limit(800);

  if (error) throw error;

  const seen = new Map<string, string>();
  for (const row of rows ?? []) {
    const id = String(row.politician_id ?? '').trim();
    const name = String(row.politician_name ?? '').trim();
    if (!id || !name || seen.has(id)) continue;
    seen.set(id, name);
  }

  const ids = Array.from(seen.keys()).slice(0, limit);

  const { data: existing } = await supabase
    .from('dark_pool_person_portraits')
    .select('*')
    .in('person_id', ids);

  const existingMap = new Map(
    (existing ?? []).map((r) => [String(r.person_id), r as PortraitRow])
  );

  for (const personId of ids) {
    stats.politicians_scanned += 1;
    const displayName = seen.get(personId)!;
    const cached = existingMap.get(personId) ?? null;

    if (!shouldRetryPortrait(cached, force)) {
      stats.skipped += 1;
      continue;
    }

    if (cached?.image_url && !force) {
      stats.skipped += 1;
      continue;
    }

    try {
      const resolved = await resolvePortrait({
        personId,
        kind: 'politician',
        displayName,
      });

      await upsertPortrait(supabase, {
        person_id: personId,
        kind: 'politician',
        display_name: displayName,
        image_url: resolved.image_url,
        source: resolved.source,
        lookup_name: resolved.lookup_name,
        last_error: resolved.last_error,
        fail_count: cached?.fail_count ?? 0,
      });

      if (resolved.image_url) stats.politicians_resolved += 1;

      if (resolved.source === 'wikipedia') await delay(320);
    } catch (e) {
      stats.errors.push(`${personId}: ${(e as Error).message}`);
    }
  }

  return stats;
}

async function syncInsiders(
  supabase: ReturnType<typeof createClient>,
  force: boolean,
  limit: number
) {
  const stats = {
    insiders_scanned: 0,
    insiders_resolved: 0,
    skipped: 0,
    errors: [] as string[],
  };

  const { data: rows, error } = await supabase
    .from('dark_pool_insider_buys')
    .select('ticker, insider_name')
    .order('filed_at', { ascending: false })
    .limit(1200);

  if (error) throw error;

  const seen = new Map<string, { ticker: string; name: string }>();
  for (const row of rows ?? []) {
    const ticker = String(row.ticker ?? '').toUpperCase();
    const name = String(row.insider_name ?? '').trim();
    if (!ticker || !name || isEntityInsiderName(name)) continue;
    const id = insiderPersonId(ticker, name);
    if (!seen.has(id)) seen.set(id, { ticker, name });
  }

  const entries = Array.from(seen.entries()).slice(0, limit);
  const ids = entries.map(([id]) => id);

  const { data: existing } = await supabase
    .from('dark_pool_person_portraits')
    .select('*')
    .in('person_id', ids);

  const existingMap = new Map(
    (existing ?? []).map((r) => [String(r.person_id), r as PortraitRow])
  );

  for (const [personId, meta] of entries) {
    stats.insiders_scanned += 1;
    const cached = existingMap.get(personId) ?? null;

    if (!shouldRetryPortrait(cached, force)) {
      stats.skipped += 1;
      continue;
    }

    if (cached?.image_url && !force) {
      stats.skipped += 1;
      continue;
    }

    try {
      const resolved = await resolvePortrait({
        personId,
        kind: 'insider',
        displayName: meta.name,
        ticker: meta.ticker,
      });

      await upsertPortrait(supabase, {
        person_id: personId,
        kind: 'insider',
        display_name: formatInsiderDisplayName(meta.name),
        ticker: meta.ticker,
        image_url: resolved.image_url,
        source: resolved.source,
        lookup_name: resolved.lookup_name,
        last_error: resolved.last_error,
        fail_count: cached?.fail_count ?? 0,
      });

      if (resolved.image_url) stats.insiders_resolved += 1;

      if (resolved.source === 'wikipedia') await delay(320);
    } catch (e) {
      stats.errors.push(`${personId}: ${(e as Error).message}`);
    }
  }

  return stats;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
