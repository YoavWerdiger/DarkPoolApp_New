// materialize-trump-portfolio
// תיק טראמפ — שווי משוער מטווחי STOCK Act (Quiver trumpstocktrades / UW):
//   כל עסקה = טווח $ → מניות משוערות (low/high) לפי המחיר ביום העסקה → שווי לפי מחיר נוכחי,
//   מכירות FIFO. נשמר שווי אמצע + טווח low–high, גרף ומשקלים לפי האמצע.
// הרצה נפרדת מהמטריאלייזר הכללי: כל העסקאות (לא 500 אחרונות), בלי כפילויות Quiver/UW,
// ומחירים מהקאש + עד MAX_FETCH טיקרים חסרים בכל ריצה (לטראמפ ~1,000 טיקרים).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createServiceSupabase } from '../_shared/uwDbCache.ts';
import type { CongressTradeInput } from '../_shared/congressPortfolio.ts';
import {
  dedupeTrumpInputs,
  metricsFromTrumpCongressInputs,
  TRUMP_DARKPOOL_PERSON_ID,
} from '../_shared/trumpPortfolio.ts';
import {
  ensureYahooPriceMaps,
  metricsToSnapshotFields,
  upsertPortfolioSnapshot,
} from '../_shared/darkpoolPortfolioSnapshots.ts';

const MAX_FETCH = 120;
const PAGE = 1000;
const TICKER_RE = /^[A-Z]{1,5}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SERVICE_KEY || (req.headers.get('Authorization') ?? '') !== `Bearer ${SERVICE_KEY}`) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const supabase = createServiceSupabase();
  try {
    // כל העסקאות (paged)
    const rows: Array<Record<string, unknown>> = [];
    for (let from = 0; from < 20000; from += PAGE) {
      const { data, error } = await supabase
        .from('dark_pool_congress_trades')
        .select('ticker, transaction_type, amount_label, transaction_date, filed_at, shares, price, source')
        .eq('politician_id', TRUMP_DARKPOOL_PERSON_ID)
        .order('transaction_date', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }

    const inputs = dedupeTrumpInputs(
      rows.map((r) => ({
        ticker: String(r.ticker ?? '').toUpperCase().trim(),
        txn_type: String(r.transaction_type ?? ''),
        amounts: (r.amount_label as string | null) ?? undefined,
        transaction_date: String(r.transaction_date ?? '').slice(0, 10),
        filed_at_date: r.filed_at ? String(r.filed_at).slice(0, 10) : undefined,
        shares: typeof r.shares === 'number' && r.shares > 0 ? r.shares : null,
        disclosed_price: typeof r.price === 'number' && r.price > 0 ? r.price : null,
        shares_disclosed: typeof r.shares === 'number' && r.shares > 0,
        source: (r.source as string | null) ?? null,
      })),
    ).filter((i) => TICKER_RE.test(String(i.ticker ?? ''))) as CongressTradeInput[];

    const tickers = Array.from(new Set(inputs.map((i) => String(i.ticker))));
    const pricesByTicker = await ensureYahooPriceMaps(supabase, tickers, {
      concurrency: 4,
      maxFetch: MAX_FETCH,
    });
    const priced = tickers.filter((t) => (pricesByTicker.get(t)?.size ?? 0) > 0).length;

    const metrics = metricsFromTrumpCongressInputs(inputs, pricesByTicker);
    if (!metrics) return json({ ok: false, reason: 'no_trades', rows: rows.length });

    await upsertPortfolioSnapshot(supabase, {
      person_id: TRUMP_DARKPOOL_PERSON_ID,
      kind: 'politician',
      ...metricsToSnapshotFields(metrics),
      profile_meta: { trade_count: inputs.length, engine: 'trump_range' },
      source_meta: {
        accuracy: 'trump_range_estimate',
        raw_rows: rows.length,
        deduped_trades: inputs.length,
        tickers: tickers.length,
        priced_tickers: priced,
        written_at: new Date().toISOString(),
      },
    });

    return json({
      ok: true,
      raw_rows: rows.length,
      trades: inputs.length,
      tickers: tickers.length,
      priced_tickers: priced,
      value_mid: metrics.portfolio_value,
      value_range: metrics.value_range,
      holdings: metrics.holdings.length,
    });
  } catch (e) {
    console.error('[trump-portfolio] failed', e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
