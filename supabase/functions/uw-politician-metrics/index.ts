// uw-politician-metrics — תיק מוערך מעסקאות STIR ב-DB (+ Yahoo). בלי UW snapshot (403).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  metricsFromCongressTrades,
  type CongressPortfolioMetrics,
} from '../_shared/congressPortfolio.ts';
import {
  fetchUwPoliticianTrades,
  fetchUwPoliticians,
} from '../_shared/unusualWhales.ts';
import {
  congressDbRowToUwTrade,
  createServiceSupabase,
  loadCongressTradesForPoliticianFromDb,
  loadSnapshot,
  loadSnapshotStale,
  saveSnapshot,
} from '../_shared/uwDbCache.ts';
import { isSecProductionMode } from '../_shared/darkPoolMode.ts';

const METRICS_FRESH_MS = 24 * 60 * 60 * 1000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function metricsCacheKey(politicianId: string) {
  return `politician_metrics:${politicianId}`;
}

const CONGRESS_PHOTO = 'https://unitedstates.github.io/images/congress/225x275';

interface Payload {
  politician_id: string;
  name: string;
  image_url: string | null;
  metrics: CongressPortfolioMetrics | null;
  snapshot_holdings_count: number;
  source: 'reconstructed' | 'snapshot_only' | 'none';
  warnings: string[];
  fetched_at: string;
}

const cache = new Map<string, { at: number; payload: Payload }>();
const CACHE_MS = 20 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const secMode = isSecProductionMode();
  const key = Deno.env.get('UNUSUAL_WHALES_API_KEY') || '';
  if (!secMode && !key) return json({ error: 'UNUSUAL_WHALES_API_KEY missing' }, 400);

  let politicianId = '';
  let force = false;
  try {
    const body = await req.json();
    politicianId = String(body?.politician_id ?? body?.id ?? '').trim();
    force = body?.force === true;
  } catch {
    return json({ error: 'politician_id required' }, 400);
  }
  if (!politicianId) return json({ error: 'politician_id required' }, 400);

  const supabase = createServiceSupabase();
  const dbKey = metricsCacheKey(politicianId);

  if (!force) {
    const fresh = await loadSnapshot<Payload>(supabase, dbKey, METRICS_FRESH_MS);
    if (fresh) {
      cache.set(politicianId, { at: Date.now(), payload: fresh.payload });
      return json(fresh.payload, 200);
    }
    const stale = await loadSnapshotStale<Payload>(supabase, dbKey);
    if (stale) {
      cache.set(politicianId, { at: Date.now(), payload: stale.payload });
      return json(stale.payload, 200);
    }
  }

  const hit = cache.get(politicianId);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) {
    return json(hit.payload, 200);
  }

  try {
    const payload = await buildMetrics(secMode ? '' : key, politicianId);
    cache.set(politicianId, { at: Date.now(), payload });
    await saveSnapshot(supabase, dbKey, payload);
    return json(payload, 200);
  } catch (e) {
    console.error('uw-politician-metrics', e);
    const stale = await loadSnapshotStale<Payload>(supabase, dbKey);
    if (stale) return json(stale.payload, 200);
    if (hit) return json(hit.payload, 200);
    return json({ error: (e as Error).message }, 500);
  }
});

async function buildMetrics(apiKey: string, politicianId: string): Promise<Payload> {
  const warnings: string[] = [];
  const supabase = createServiceSupabase();

  const [politicians, dbRows] = await Promise.all([
    apiKey ? fetchUwPoliticians(apiKey, 36).catch(() => []) : Promise.resolve([]),
    loadCongressTradesForPoliticianFromDb(supabase, politicianId, 500).catch((e) => {
      warnings.push(`db: ${(e as Error).message}`);
      return [];
    }),
  ]);

  let mine = dbRows.map(congressDbRowToUwTrade);
  if (mine.length < 5 && apiKey) {
    const uwTrades = await fetchUwPoliticianTrades(apiKey, politicianId, 500).catch((e) => {
      warnings.push(`uw trades: ${(e as Error).message}`);
      return [];
    });
    mine = uwTrades.filter((t) => String(t.politician_id ?? '') === politicianId);
  }

  const meta = politicians.find((p) => String(p.politician_id ?? p.id) === politicianId);
  const dbMeta = dbRows[0];
  const name =
    String(meta?.name ?? dbMeta?.politician_name ?? '').trim() || 'פוליטיקאי';
  const bg = meta?.bioguide_id?.trim();
  const image_url =
    dbMeta?.politician_image_url ??
    (bg ? `${CONGRESS_PHOTO}/${bg}.jpg` : null);

  const metrics = mine.length ? await metricsFromCongressTrades(mine, { maxTickers: 35 }) : null;

  let source: Payload['source'] = 'none';
  if (metrics && metrics.holdings.length > 0) source = 'reconstructed';

  if (!metrics?.holdings.length) {
    warnings.push('אין מספיק עסקאות + מחירים לחישוב מוערך');
  }

  return {
    politician_id: politicianId,
    name,
    image_url,
    metrics,
    snapshot_holdings_count: 0,
    source,
    warnings,
    fetched_at: new Date().toISOString(),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
