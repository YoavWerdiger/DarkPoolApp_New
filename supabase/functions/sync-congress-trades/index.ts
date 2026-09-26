// sync-congress-trades — Quiver/UW → dark_pool_congress_trades (cron / refresh)
//
// שכבות:
//   1) פיד גלובלי — buildCongressTradeRows (כל העסקאות האחרונות; לא מסונן ל-curated)
//   2) Executive — Trump via /beta/bulk/trumpstocktrades (לפני curated, כדי לא לאבד ל־rate-limit)
//   3) Deep history — רק CURATED_CONGRESS_BIOGUIDES (+ top_active אופציונלי ב-body)
//
// אל תבלבלו: פיד = גלובלי; פרופילים/Explore/materialize = curated בלבד.
// טראמפ ≠ STOCK Act live — אין BioGuide.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  applyQuiverPoliticianImages,
  buildCongressTradeRows,
  buildCuratedCongressHistoryRows,
  buildCuratedExecutiveTradeRows,
  getCongressTradesProvider,
  resolveCongressApiKey,
} from '../_shared/congressFeedBuild.ts';
import {
  createServiceSupabase,
  loadSnapshot,
  upsertCongressTradesToDb,
} from '../_shared/uwDbCache.ts';
import {
  CURATED_CONGRESS_BIOGUIDES,
  CURATED_EXECUTIVE_UW_IDS,
  DEFAULT_HISTORY_TICKERS,
  QUIVER_POLITICIANS_CACHE_KEY,
  mergeBioguidesWithTopActive,
  resolveQuiverApiKey,
  type QuiverPoliticiansCachePayload,
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

  // ברירת מחדל 200; cron מעביר limit=200. max 500 — Quiver live = קריאה אחת.
  let limit = Number(Deno.env.get('CONGRESS_SYNC_LIMIT') || '200');
  limit = Math.min(500, Math.max(10, Number.isFinite(limit) ? limit : 200));
  let deep = true;
  let bioguides = CURATED_CONGRESS_BIOGUIDES;
  // ברירת מחדל 0 — deep history רק למאוצרים; top_active ב-body להרחבה ידנית
  let topActive = 0;
  let tickers = DEFAULT_HISTORY_TICKERS;
  // historical/*trading — אופציונלי; מקור ראשי לפרופיל = bulk לפי BioGuide
  let enrichTickers = false;
  let includeChambers = false;
  try {
    const body = await req.json();
    if (body?.limit) limit = Math.min(500, Math.max(10, Number(body.limit)));
    if (body?.deep === false) deep = false;
    if (Array.isArray(body?.bioguides) && body.bioguides.length) {
      bioguides = body.bioguides
        .map((b: unknown) => String(b).trim().toUpperCase())
        .filter(Boolean);
    }
    if (body?.top_active != null) {
      topActive = Math.min(80, Math.max(0, Number(body.top_active) || 0));
    }
    if (Array.isArray(body?.tickers) && body.tickers.length) {
      tickers = body.tickers.map((t: unknown) => String(t).trim().toUpperCase()).filter(Boolean);
    }
    if (body?.enrich_tickers === true) enrichTickers = true;
    if (body?.enrich_tickers === false) enrichTickers = false;
    if (body?.include_chambers === true) includeChambers = true;
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
    let executiveFetched = 0;
    let deepBioguides = bioguides.length;
    if (deep) {
      // Trump קודם — לפני deep curated (rate-limit / timeout על bioguides)
      // Quiver /beta/bulk/trumpstocktrades; UW כגיבוי רק עם UNUSUAL_WHALES_API_KEY
      try {
        const executives = await buildCuratedExecutiveTradeRows(
          undefined,
          CURATED_EXECUTIVE_UW_IDS
        );
        executiveFetched = executives.length;
        if (executives.length) {
          rows = dedupeByExternalId([...rows, ...executives]);
        } else {
          console.warn(
            'sync-congress-trades: executive_fetched=0 (check QUIVER_API_KEY / trumpstocktrades)'
          );
        }
      } catch (e) {
        console.warn('sync-congress-trades curated executives', e);
      }

      try {
        const supabaseForCache = createServiceSupabase();
        const polSnap = await loadSnapshot<QuiverPoliticiansCachePayload>(
          supabaseForCache,
          QUIVER_POLITICIANS_CACHE_KEY,
          48 * 60 * 60 * 1000
        );
        if (polSnap?.payload?.politicians?.length && topActive > 0) {
          bioguides = mergeBioguidesWithTopActive(
            bioguides,
            polSnap.payload.politicians,
            topActive
          );
        }
        deepBioguides = bioguides.length;

        const curatedKey =
          resolveQuiverApiKey() ||
          (provider === 'quiverquant' ? key : '') ||
          Deno.env.get('UNUSUAL_WHALES_API_KEY')?.trim() ||
          '';
        const curated = await buildCuratedCongressHistoryRows(curatedKey || undefined, bioguides, {
          tickers,
          enrichTickers,
          includeChambers,
          bulkMaxPages: 20,
          maxTickers: Math.min(12, tickers.length || 12),
          rowLimit: 8000,
        });
        curatedFetched = curated.length;
        if (curated.length) {
          rows = dedupeByExternalId([...rows, ...curated]);
        }
      } catch (e) {
        console.warn('sync-congress-trades curated deep', e);
      }
    }

    const supabase = createServiceSupabase();
    let politicians: QuiverPoliticiansCachePayload['politicians'] = [];
    try {
      const polSnap = await loadSnapshot<QuiverPoliticiansCachePayload>(
        supabase,
        QUIVER_POLITICIANS_CACHE_KEY,
        48 * 60 * 60 * 1000
      );
      politicians = polSnap?.payload?.politicians ?? [];
    } catch (e) {
      console.warn('sync-congress-trades politician images', e);
    }
    rows = applyQuiverPoliticianImages(rows, politicians);
    const upserted = await upsertCongressTradesToDb(supabase, rows);
    curatedUpserted = curatedFetched ? upserted : 0;
    await supabase.from('dark_pool_uw_snapshots').upsert(
      {
        cache_key: 'congress_trades_meta',
        payload: {
          synced_at: new Date().toISOString(),
          count: rows.length,
          curated_fetched: curatedFetched,
          executive_fetched: executiveFetched,
          deep_bioguides: deepBioguides,
          enrich_tickers: enrichTickers,
          include_chambers: includeChambers,
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
        executive_fetched: executiveFetched,
        deep_bioguides: deepBioguides,
        upserted,
        curated_upserted: curatedUpserted,
        deep,
        enrich_tickers: enrichTickers,
        include_chambers: includeChambers,
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
