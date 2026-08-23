// sync-congress-trades — Quiver/UW + Yahoo → dark_pool_congress_trades (cron / refresh)
// תומך גם ב־deep sync להיסטוריה של פוליטיקאים מאוצרים (Pelosi וכו׳).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildCongressTradeRows,
  buildCuratedCongressHistoryRows,
  getCongressTradesProvider,
  resolveCongressApiKey,
} from '../_shared/congressFeedBuild.ts';
import {
  createServiceSupabase,
  upsertCongressTradesToDb,
} from '../_shared/uwDbCache.ts';
import {
  CURATED_CONGRESS_BIOGUIDES,
  resolveQuiverApiKey,
} from '../_shared/quiverQuant.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const provider = getCongressTradesProvider();
  const key = resolveCongressApiKey(provider);
  if (!key) {
    return json(
      {
        error:
          provider === 'quiverquant'
            ? 'QUIVER_API_KEY missing'
            : 'UNUSUAL_WHALES_API_KEY missing',
      },
      400
    );
  }

  let limit = 200;
  let deep = true;
  let bioguides = CURATED_CONGRESS_BIOGUIDES;
  try {
    const body = await req.json();
    if (body?.limit) limit = Math.min(400, Math.max(10, Number(body.limit)));
    if (body?.deep === false) deep = false;
    if (Array.isArray(body?.bioguides) && body.bioguides.length) {
      bioguides = body.bioguides.map((b: unknown) => String(b).trim().toUpperCase()).filter(Boolean);
    }
  } catch {
    /* empty */
  }

  try {
    let rows: Awaited<ReturnType<typeof buildCongressTradeRows>> = [];
    let usedProvider = provider;
    try {
      rows = await buildCongressTradeRows(key, limit);
    } catch (primaryErr) {
      console.warn('sync-congress-trades primary', primaryErr);
      const uwKey = Deno.env.get('UNUSUAL_WHALES_API_KEY')?.trim() || '';
      if (provider === 'quiverquant' && uwKey) {
        rows = await buildCongressTradeRows(uwKey, limit, 'unusualwhales');
        usedProvider = 'unusualwhales';
      } else {
        throw primaryErr;
      }
    }
    if (!rows.length && provider === 'quiverquant') {
      const uwKey = Deno.env.get('UNUSUAL_WHALES_API_KEY')?.trim() || '';
      if (uwKey) {
        rows = await buildCongressTradeRows(uwKey, limit, 'unusualwhales');
        usedProvider = 'unusualwhales';
      }
    }

    let curatedFetched = 0;
    let curatedUpserted = 0;
    if (deep) {
      try {
        // Quiver אם יש; אחרת UW בתוך buildCuratedCongressHistoryRows
        const curatedKey =
          resolveQuiverApiKey() ||
          (provider === 'quiverquant' ? key : '') ||
          Deno.env.get('UNUSUAL_WHALES_API_KEY')?.trim() ||
          '';
        const curated = await buildCuratedCongressHistoryRows(curatedKey || undefined, bioguides);
        curatedFetched = curated.length;
        if (curated.length) {
          rows = dedupeByExternalId([...rows, ...curated]);
        }
      } catch (e) {
        console.warn('sync-congress-trades curated deep', e);
      }
    }

    const supabase = createServiceSupabase();
    const upserted = await upsertCongressTradesToDb(supabase, rows);
    curatedUpserted = curatedFetched ? upserted : 0;
    await supabase.from('dark_pool_uw_snapshots').upsert(
      {
        cache_key: 'congress_trades_meta',
        payload: {
          synced_at: new Date().toISOString(),
          count: rows.length,
          curated_fetched: curatedFetched,
          provider: usedProvider,
          deep,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cache_key' }
    );
    return json(
      {
        ok: true,
        provider: usedProvider,
        fetched: rows.length,
        curated_fetched: curatedFetched,
        upserted,
        curated_upserted: curatedUpserted,
        deep,
        synced_at: new Date().toISOString(),
      },
      200
    );
  } catch (e) {
    console.error('sync-congress-trades', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function dedupeByExternalId<T extends { external_id: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(row.external_id, row);
  }
  return Array.from(map.values());
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
