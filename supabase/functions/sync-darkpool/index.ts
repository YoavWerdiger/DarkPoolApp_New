// supabase/functions/sync-darkpool/index.ts
// ----------------------------------------------------------------------------
// Pipeline סנכרון Dark Pool — נקרא ע"י Supabase Scheduled Function כל 30 שניות.
//
// שלבים:
//   1. fetch    — קריאה לספק הפעיל (Polygon / UW / Intrinio)
//   2. normalize— באמצעות `_shared/darkpool.ts`
//   3. dedupe   — דה־דופ מול dark_pool_trades (uq indices)
//   4. store    — insert ל-dark_pool_trades + aggregate daily
//   5. signal   — הרצת engine פר ticker שזוהו לו prints חדשים
//   6. alerts   — הזרקת push notifications ל-watchers (Premium only)
// ----------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';
import {
  buildTemplateInsight,
  DEFAULT_UNIVERSE,
  detectSignals,
  fetchFromIntrinio,
  fetchFromPolygon,
  fetchFromUnusualWhales,
  type DetectedSignal,
  type InsiderBuy,
  type NormalizedTrade,
  type ProviderFetch,
} from '../_shared/darkpool.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function pickProvider(): 'polygon' | 'unusualwhales' | 'intrinio' {
  const raw = (Deno.env.get('DARK_POOL_PROVIDER') || 'polygon').toLowerCase();
  if (raw === 'unusualwhales' || raw === 'intrinio') return raw;
  return 'polygon';
}

async function fetchTrades(sinceIso: string): Promise<ProviderFetch> {
  const p = pickProvider();
  if (p === 'polygon') {
    const key = Deno.env.get('POLYGON_API_KEY') || '';
    if (!key) throw new Error('POLYGON_API_KEY missing');
    return fetchFromPolygon(key, sinceIso, DEFAULT_UNIVERSE);
  }
  if (p === 'unusualwhales') {
    const key = Deno.env.get('UNUSUAL_WHALES_API_KEY') || '';
    if (!key) throw new Error('UNUSUAL_WHALES_API_KEY missing');
    return fetchFromUnusualWhales(key, sinceIso);
  }
  const key = Deno.env.get('INTRINIO_API_KEY') || '';
  if (!key) throw new Error('INTRINIO_API_KEY missing');
  return fetchFromIntrinio(key, sinceIso);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let resetLookbackHours = 0;
  try {
    const body = await req.json();
    if (body?.reset === true) resetLookbackHours = Number(body.lookback_hours) || 168;
    else if (body?.lookback_hours) resetLookbackHours = Number(body.lookback_hours);
  } catch {
    /* cron / empty body */
  }

  // Authorize: rely on Supabase secret SUPABASE_SERVICE_ROLE_KEY for scheduled runs.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  const provider = pickProvider();
  const startedAt = Date.now();

  try {
    // 1. read last cursor
    const { data: stateRow } = await supabase
      .from('dark_pool_provider_state')
      .select('last_ts, last_cursor')
      .eq('provider', provider)
      .maybeSingle();
    const defaultLookback = 60 * 60 * 1000; // 1h
    const sinceIso =
      resetLookbackHours > 0
        ? new Date(Date.now() - resetLookbackHours * 60 * 60 * 1000).toISOString()
        : stateRow?.last_ts
          ? new Date(Date.parse(stateRow.last_ts)).toISOString()
          : new Date(Date.now() - defaultLookback).toISOString();

    // 2. fetch
    const fetched = await fetchTrades(sinceIso);
    const rows = fetched.trades;
    if (!rows.length) {
      await supabase.from('dark_pool_provider_state').upsert({
        provider,
        last_ts: stateRow?.last_ts ?? new Date(Date.now() - defaultLookback).toISOString(),
        last_cursor: stateRow?.last_cursor ?? null,
        meta: { last_run_ms: Date.now() - startedAt, fetched: 0 },
      });
      return jsonOk({ inserted: 0, signals: 0, ms: Date.now() - startedAt });
    }

    // 3. dedupe via UNIQUE indices
    const insertRows = rows.map(toDbRow);
    const { data: inserted, error: insertErr } = await supabase
      .from('dark_pool_trades')
      .upsert(insertRows, { onConflict: 'provider,external_id', ignoreDuplicates: true })
      .select('id, ticker, ts, premium, size, side');
    if (insertErr) throw insertErr;

    // 4. update aggregates per ticker per day
    const tickersAffected = Array.from(new Set(rows.map((r) => r.ticker)));
    await Promise.all(
      tickersAffected.map((t) => recomputeDailyAggregate(supabase, t))
    );

    // 5. signal engine
    const allSignals: DetectedSignal[] = [];
    for (const ticker of tickersAffected) {
      const tickerTrades = rows.filter((r) => r.ticker === ticker);
      const signals = await runEngineForTicker(supabase, ticker, tickerTrades);
      if (signals.length) allSignals.push(...signals);
    }

    // 6. persist signals
    if (allSignals.length) {
      const signalRows = allSignals.map((s) => ({
        ticker: s.ticker,
        signal_type: s.signal_type,
        score: s.score,
        reason: s.reason,
        ai_summary: buildTemplateInsight(
          s.ticker,
          s.metrics.company_name ?? null,
          s.signal_type,
          s.metrics
        ),
        metrics: s.metrics,
        detected_at: s.detected_at,
      }));
      // ייחודיות לפי (ticker, signal_type, bucket_5m) — מתעדכן בלי כפילויות
      await supabase
        .from('dark_pool_signals')
        .upsert(signalRows, {
          onConflict: 'ticker,signal_type,bucket_5m',
          ignoreDuplicates: false,
        });
    }

    // 7. update state
    const newTs = fetched.lastTimestamp
      ? new Date(fetched.lastTimestamp).toISOString()
      : sinceIso;
    await supabase.from('dark_pool_provider_state').upsert({
      provider,
      last_ts: newTs,
      last_cursor: null,
      meta: { last_run_ms: Date.now() - startedAt, fetched: rows.length },
    });

    return jsonOk({
      inserted: inserted?.length || 0,
      signals: allSignals.length,
      ms: Date.now() - startedAt,
    });
  } catch (e) {
    console.error('sync-darkpool error', e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? 'internal' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toDbRow(t: NormalizedTrade) {
  return {
    external_id: t.externalId,
    ticker: t.ticker,
    company_name: t.companyName,
    ts: new Date(t.timestamp).toISOString(),
    price: t.price,
    size: t.size,
    premium: t.premium,
    volume: t.volume,
    side: t.side,
    exchange: t.exchange,
    market_cap: t.marketCap,
    provider: t.provider,
  };
}

async function recomputeDailyAggregate(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ticker: string
) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: trades } = await supabase
    .from('dark_pool_trades')
    .select('side, premium, volume')
    .eq('ticker', ticker)
    .gte('ts', `${today}T00:00:00.000Z`);
  if (!trades) return;
  let total = 0, buy = 0, sell = 0, volume = 0, whales = 0;
  for (const t of trades as Array<{ side: string; premium: number; volume: number | null }>) {
    total += Number(t.premium) || 0;
    if (t.side === 'buy') buy += Number(t.premium) || 0;
    else if (t.side === 'sell') sell += Number(t.premium) || 0;
    if ((Number(t.premium) || 0) >= 1_000_000) whales++;
    volume += Number(t.volume) || 0;
  }

  // ממוצע 30 ימים אחרון (לא כולל היום) — מתבסס על אגרגציות שמורות
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data: hist } = await supabase
    .from('dark_pool_daily_aggregates')
    .select('total_premium')
    .eq('ticker', ticker)
    .gte('date', since.toISOString().slice(0, 10))
    .lt('date', today);
  const histArr = (hist || []) as Array<{ total_premium: number }>;
  const avg30 = histArr.length
    ? histArr.reduce((s, r) => s + Number(r.total_premium), 0) / histArr.length
    : null;

  await supabase.from('dark_pool_daily_aggregates').upsert({
    ticker,
    date: today,
    prints: trades.length,
    total_volume: volume,
    total_premium: total,
    buy_premium: buy,
    sell_premium: sell,
    whale_count: whales,
    avg30_premium: avg30,
  }, { onConflict: 'ticker,date' });
}

async function runEngineForTicker(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ticker: string,
  newTrades: NormalizedTrade[]
): Promise<DetectedSignal[]> {
  if (!newTrades.length) return [];

  // 3-day trailing trades (excluding the new batch)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: trail } = await supabase
    .from('dark_pool_trades')
    .select('ticker, ts, price, size, premium, side, exchange, company_name, market_cap, provider, external_id, volume')
    .eq('ticker', ticker)
    .gte('ts', threeDaysAgo)
    .order('ts', { ascending: true })
    .limit(5000);
  const trailing = (trail || []).map(rowToNormalized);

  // today aggregate (post-recompute)
  const today = new Date().toISOString().slice(0, 10);
  const { data: agg } = await supabase
    .from('dark_pool_daily_aggregates')
    .select('total_premium, avg30_premium')
    .eq('ticker', ticker)
    .eq('date', today)
    .maybeSingle();
  const todayPremium = Number(agg?.total_premium) || 0;
  const avg30 = Number(agg?.avg30_premium) || null;

  // recent insider P-buys (30 days)
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const { data: insiders } = await supabase
    .from('dark_pool_insider_buys')
    .select('insider_name, value, transaction_date, transaction_type, ticker')
    .eq('ticker', ticker)
    .eq('transaction_type', 'P')
    .gte('transaction_date', since30.toISOString().slice(0, 10));
  const insiderBuys: InsiderBuy[] = (insiders || []) as InsiderBuy[];

  // recent signals count (72h)
  const since72 = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from('dark_pool_signals')
    .select('id', { count: 'exact', head: true })
    .eq('ticker', ticker)
    .gte('detected_at', since72);

  return detectSignals({
    ticker,
    companyName: newTrades.find((t) => t.companyName)?.companyName ?? null,
    marketCap: newTrades.find((t) => t.marketCap)?.marketCap ?? null,
    newTrades,
    trailing3dTrades: trailing,
    avg30dPremium: avg30,
    todayPremium,
    recentInsiderBuys: insiderBuys,
    recent72hSignals: recentCount ?? 0,
  });
}

function rowToNormalized(r: Record<string, unknown>): NormalizedTrade {
  return {
    externalId: (r.external_id as string) ?? null,
    ticker: String(r.ticker),
    companyName: (r.company_name as string) ?? null,
    timestamp: Date.parse(String(r.ts)),
    price: Number(r.price),
    size: Number(r.size),
    premium: Number(r.premium),
    volume: r.volume != null ? Number(r.volume) : null,
    side: (r.side as 'buy' | 'sell' | 'unknown') ?? 'unknown',
    exchange: (r.exchange as string) ?? null,
    marketCap: r.market_cap != null ? Number(r.market_cap) : null,
    provider: (r.provider as 'polygon' | 'unusualwhales' | 'intrinio') ?? 'polygon',
  };
}
