// sync-quiver-congress-cache — cache יומי: politicians (גלובלי) + holdings (מאוצרים)
// James: /beta/bulk/congress/politicians — לא בכל hit; פעם ביום ל-DB.
// holdings: ברירת מחדל רק CURATED_CONGRESS_BIOGUIDES (top_active=0).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  CURATED_CONGRESS_BIOGUIDES,
  QUIVER_HOLDINGS_CACHE_KEY,
  QUIVER_POLITICIANS_CACHE_KEY,
  fetchQuiverCongressPoliticians,
  fetchQuiverCongressStockHoldings,
  mergeBioguidesWithTopActive,
  rankPoliticiansByTradeCount,
  resolveQuiverApiKey,
  type QuiverCongressStockHolding,
  type QuiverHoldingsCachePayload,
  type QuiverPoliticiansCachePayload,
} from '../_shared/quiverQuant.ts';
import { createServiceSupabase, saveSnapshot } from '../_shared/uwDbCache.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const key = resolveQuiverApiKey();
  if (!key) {
    return json({ error: 'QUIVER_API_KEY missing' }, 400);
  }

  let bioguides = CURATED_CONGRESS_BIOGUIDES;
  let syncHoldings = true;
  let syncPoliticians = true;
  // ברירת מחדל 0 — holdings רק למאוצרים; top_active ב-body להרחבה ידנית
  let topActive = 0;
  try {
    const body = await req.json();
    if (Array.isArray(body?.bioguides) && body.bioguides.length) {
      bioguides = body.bioguides
        .map((b: unknown) => String(b).trim().toUpperCase())
        .filter((b: string) => /^[A-Z]\d{6}$/.test(b));
    }
    if (body?.holdings === false) syncHoldings = false;
    if (body?.politicians === false) syncPoliticians = false;
    if (body?.top_active != null) {
      topActive = Math.min(60, Math.max(0, Number(body.top_active) || 0));
    }
  } catch {
    /* empty */
  }

  try {
    const supabase = createServiceSupabase();
    let politicians: Awaited<ReturnType<typeof fetchQuiverCongressPoliticians>> = [];
    let polSyncedAt = new Date().toISOString();

    if (syncPoliticians) {
      politicians = await fetchQuiverCongressPoliticians(key, {
        pageSize: 100,
        maxPages: 20,
        includeCandidates: false,
        isActive: true,
      });
    } else {
      // שימוש ב-cache קיים (למשל אחרי throttle על politicians)
      const { data: prior } = await supabase
        .from('dark_pool_uw_snapshots')
        .select('payload')
        .eq('cache_key', QUIVER_POLITICIANS_CACHE_KEY)
        .maybeSingle();
      const prev = prior?.payload as QuiverPoliticiansCachePayload | null;
      politicians = prev?.politicians ?? [];
      polSyncedAt = prev?.synced_at ?? polSyncedAt;
    }

    const topByTrade = rankPoliticiansByTradeCount(politicians, 25).map((p) => ({
      BioGuideID: p.BioGuideID,
      Name: p.Name,
      TradeCount: Number(p.TradeCount ?? 0) || 0,
      Party: p.Party,
      Chamber: p.Chamber || p.House,
      LastTraded: p.LastTraded,
    }));

    const polPayload: QuiverPoliticiansCachePayload = {
      politicians,
      synced_at: polSyncedAt,
      count: politicians.length,
      top_by_trade_count: topByTrade,
      curated_bioguides: CURATED_CONGRESS_BIOGUIDES,
    };
    if (politicians.length) {
      await saveSnapshot(supabase, QUIVER_POLITICIANS_CACHE_KEY, polPayload);
    }

    if (topActive > 0 && politicians.length) {
      bioguides = mergeBioguidesWithTopActive(bioguides, politicians, topActive);
    }

    // מיזוג עם cache קיים — לא מוחקים BioGuides שלא רועננו בריצה זו
    let priorByBioguide: Record<string, QuiverCongressStockHolding[]> = {};
    try {
      const { data: prior } = await supabase
        .from('dark_pool_uw_snapshots')
        .select('payload')
        .eq('cache_key', QUIVER_HOLDINGS_CACHE_KEY)
        .maybeSingle();
      const prev = (prior?.payload as QuiverHoldingsCachePayload | null)?.by_bioguide;
      if (prev && typeof prev === 'object') priorByBioguide = prev;
    } catch {
      /* empty */
    }

    let holdingsCount = 0;
    const byBioguide: Record<string, QuiverCongressStockHolding[]> = {
      ...priorByBioguide,
    };
    if (syncHoldings) {
      for (const bg of bioguides) {
        try {
          const rows = await fetchQuiverCongressStockHoldings(key, { bioguideId: bg });
          byBioguide[bg] = rows;
          holdingsCount += rows.length;
          await delay(150);
        } catch (e) {
          console.warn(`quiver holdings ${bg}:`, (e as Error).message);
          if (!byBioguide[bg]) byBioguide[bg] = [];
        }
      }
      const holdPayload: QuiverHoldingsCachePayload = {
        by_bioguide: byBioguide,
        synced_at: new Date().toISOString(),
      };
      await saveSnapshot(supabase, QUIVER_HOLDINGS_CACHE_KEY, holdPayload);
    }

    return json(
      {
        ok: true,
        politicians: politicians.length,
        politicians_refreshed: syncPoliticians,
        top_by_trade_count: topByTrade.slice(0, 10),
        holdings_rows: holdingsCount,
        holdings_bioguides: Object.keys(byBioguide).length,
        bioguides: bioguides.length,
        synced_at: polPayload.synced_at,
      },
      200
    );
  } catch (e) {
    console.error('sync-quiver-congress-cache', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
