// sync-congress-trades — Quiver/UW + Yahoo → dark_pool_congress_trades (cron / refresh)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildCongressTradeRows,
  getCongressTradesProvider,
  resolveCongressApiKey,
} from '../_shared/congressFeedBuild.ts';
import {
  createServiceSupabase,
  upsertCongressTradesToDb,
} from '../_shared/uwDbCache.ts';

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

  let limit = 120;
  try {
    const body = await req.json();
    if (body?.limit) limit = Math.min(200, Math.max(10, Number(body.limit)));
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
    const supabase = createServiceSupabase();
    const upserted = await upsertCongressTradesToDb(supabase, rows);
    await supabase.from('dark_pool_uw_snapshots').upsert(
      {
        cache_key: 'congress_trades_meta',
        payload: {
          synced_at: new Date().toISOString(),
          count: rows.length,
          provider: usedProvider,
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
        upserted,
        synced_at: new Date().toISOString(),
      },
      200
    );
  } catch (e) {
    console.error('sync-congress-trades', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
