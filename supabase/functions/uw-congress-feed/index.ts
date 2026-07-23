// uw-congress-feed — קריאה מהירה מ-DB; sync דרך sync-congress-trades

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { buildCongressTradeRows, resolveCongressApiKey, getCongressTradesProvider } from '../_shared/congressFeedBuild.ts';
import {
  createServiceSupabase,
  loadCongressTradesFromDb,
  loadSnapshotStale,
  upsertCongressTradesToDb,
  type CongressTradeRow,
} from '../_shared/uwDbCache.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DB_FRESH_MS = 25 * 60 * 1000;

interface FeedTrade {
  id: string;
  politician_id: string;
  politician_name: string;
  politician_image_url: string | null;
  ticker: string;
  company_name: string | null;
  transaction_type: 'buy' | 'sell';
  shares: number | null;
  price: number | null;
  amount_label: string | null;
  filed_at: string;
  transaction_date: string;
  txn_label: string;
  source: 'quiverquant' | 'unusualwhales';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  let limit = 40;
  let force = false;
  try {
    const body = await req.json();
    if (body?.limit) limit = Math.min(60, Math.max(5, Number(body.limit)));
    force = body?.force === true;
  } catch {
    /* empty */
  }

  const supabase = createServiceSupabase();

  try {
    let rows = await loadCongressTradesFromDb(supabase, limit);
    const meta = await loadSnapshotStale<{ synced_at?: string }>(
      supabase,
      'congress_trades_meta'
    );
    const metaAge = meta?.payload?.synced_at
      ? Date.now() - Date.parse(meta.payload.synced_at)
      : Infinity;
    const stale = !rows.length || metaAge > DB_FRESH_MS;

    if (force || stale) {
      const provider = getCongressTradesProvider();
      const key = resolveCongressApiKey(provider);
      if (key) {
        try {
          const built = await buildCongressTradeRows(key, Math.max(limit, 50));
          if (built.length) {
            await upsertCongressTradesToDb(supabase, built);
            await supabase.from('dark_pool_uw_snapshots').upsert(
              {
                cache_key: 'congress_trades_meta',
                payload: {
                  synced_at: new Date().toISOString(),
                  count: built.length,
                  provider,
                },
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'cache_key' }
            );
            rows = await loadCongressTradesFromDb(supabase, limit);
          }
        } catch (e) {
          console.warn('uw-congress-feed sync', e);
        }
      }
    }

    const provider = getCongressTradesProvider();
    const trades = rows.slice(0, limit).map(toFeedTrade);
    return json(
      {
        trades,
        fetched_at: meta?.payload?.synced_at ?? new Date().toISOString(),
        source: provider,
        from_db: true,
      },
      200
    );
  } catch (e) {
    console.error('uw-congress-feed', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function toFeedTrade(r: CongressTradeRow): FeedTrade {
  return {
    id: r.external_id,
    politician_id: r.politician_id,
    politician_name: r.politician_name,
    politician_image_url: r.politician_image_url,
    ticker: r.ticker,
    company_name: r.company_name,
    transaction_type: r.transaction_type,
    shares: r.shares,
    price: r.price,
    amount_label: r.amount_label,
    filed_at: r.filed_at,
    transaction_date: r.transaction_date,
    txn_label: r.txn_label ?? (r.transaction_type === 'sell' ? 'מכירה' : 'רכישה'),
    source: r.source === 'quiverquant' ? 'quiverquant' : 'unusualwhales',
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
