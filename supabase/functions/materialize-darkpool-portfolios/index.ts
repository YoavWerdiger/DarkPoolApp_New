// materialize-darkpool-portfolios
// Precompute chart series + holdings entry/return → dark_pool_person_portfolio_snapshots
// Yahoo batch once per unique ticker (market_daily_prices). No Form4 live.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  congressDbRowToUwTrade,
  createServiceSupabase,
  loadCongressTradesForPoliticianFromDb,
  loadInsiderBuysFromDb,
} from '../_shared/uwDbCache.ts';
import {
  mapInsiderTradeToCongressInput,
  metricsFromCongressTrades,
  priceOnOrBefore,
  type CongressTradeInput,
} from '../_shared/congressPortfolio.ts';
import {
  CURATED_MATERIALIZE_TARGETS,
  ensureYahooPriceMaps,
  metricsToSnapshotFields,
  upsertPortfolioSnapshot,
  type SnapshotKind,
} from '../_shared/darkpoolPortfolioSnapshots.ts';
import type { UwCongressTrade } from '../_shared/unusualWhales.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Target {
  id: string;
  kind: SnapshotKind;
  ticker?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  let body: {
    mode?: string;
    ids?: Array<{ id: string; kind: string; ticker?: string }>;
    force_refresh_prices?: boolean;
  } = {};
  try {
    if (req.method === 'POST') body = await req.json();
  } catch {
    /* empty */
  }

  const mode = String(body.mode ?? 'hot').toLowerCase();
  const supabase = createServiceSupabase();

  try {
    const targets =
      body.ids?.length
        ? body.ids
            .map((x) => ({
              id: String(x.id).trim(),
              kind: (x.kind === 'insider'
                ? 'insider'
                : x.kind === 'fund_manager'
                  ? 'fund_manager'
                  : 'politician') as SnapshotKind,
              ticker: x.ticker,
            }))
            .filter((t) => t.id)
        : await resolveTargets(supabase, mode);

    if (!targets.length) {
      return json({ ok: true, mode, targets: 0, materialized: 0 });
    }

    // --- Collect tickers for batch Yahoo ---
    const tickerHints = new Set<string>();
    const congressInputs = new Map<string, CongressTradeInput[]>();
    const insiderInputs = new Map<string, CongressTradeInput[]>();
    const fundCiks: string[] = [];

    for (const t of targets) {
      if (t.kind === 'politician') {
        const rows = await loadCongressTradesForPoliticianFromDb(
          supabase,
          t.id,
          500
        ).catch(() => []);
        const inputs = rows.map((r) => {
          const uw = congressDbRowToUwTrade(r) as UwCongressTrade;
          return {
            ticker: String(uw.ticker ?? r.ticker ?? '').toUpperCase(),
            txn_type: r.transaction_type,
            amounts: r.amount_label ?? undefined,
            transaction_date: r.transaction_date,
            filed_at_date: r.filed_at?.slice(0, 10),
            // קונגרס: לא ממציאים shares — רק אם יש בדיווח
            shares: r.shares != null && r.shares > 0 ? r.shares : null,
            disclosed_price: r.price != null && r.price > 0 ? r.price : null,
            shares_disclosed: r.shares != null && r.shares > 0,
          } satisfies CongressTradeInput;
        });
        congressInputs.set(t.id, inputs);
        for (const i of inputs) {
          const sym = String(i.ticker ?? '').toUpperCase();
          if (sym && sym.length <= 5) tickerHints.add(sym);
        }
      } else if (t.kind === 'insider') {
        const parts = t.id.split(':');
        const ticker = (t.ticker || parts[0] || '').toUpperCase();
        const nameKey = parts.slice(1).join(':').trim() || t.id;
        const rows = await loadInsiderBuysFromDb(supabase, {
          ticker: ticker || undefined,
          insiderName: nameKey,
          limit: 200,
        }).catch(() => []);
        const inputs = dedupeInputs(
          rows.map((r) =>
            mapInsiderTradeToCongressInput({
              ticker: r.ticker,
              transaction_type: r.transaction_type,
              shares: r.shares,
              price: r.price,
              value: r.value,
              transaction_date: r.transaction_date,
              filed_at: r.filed_at,
            })
          )
        );
        insiderInputs.set(t.id, inputs);
        for (const i of inputs) {
          const sym = String(i.ticker ?? '').toUpperCase();
          if (sym && sym.length <= 5) tickerHints.add(sym);
        }
      } else if (t.kind === 'fund_manager') {
        fundCiks.push(t.id);
      }
    }

    // Fund holdings tickers
    if (fundCiks.length) {
      const { data: fundRows } = await supabase
        .from('dark_pool_fund_holdings')
        .select('ticker')
        .in('fund_cik', fundCiks)
        .limit(2000);
      for (const r of fundRows ?? []) {
        const sym = String(r.ticker ?? '').toUpperCase();
        if (sym && sym.length <= 5) tickerHints.add(sym);
      }
    }

    const pricesByTicker = await ensureYahooPriceMaps(
      supabase,
      Array.from(tickerHints),
      { forceRefresh: !!body.force_refresh_prices, concurrency: 6 }
    );

    let ok = 0;
    let fail = 0;
    const errors: string[] = [];

    for (const t of targets) {
      try {
        if (t.kind === 'politician') {
          const inputs = congressInputs.get(t.id) ?? [];
          if (!inputs.length) {
            await upsertPortfolioSnapshot(supabase, {
              person_id: t.id,
              kind: 'politician',
              series: [],
              holdings: [],
              period_returns: {},
              source_meta: { reason: 'no_trades', mode },
            });
            ok++;
            continue;
          }
          const metrics = await metricsFromCongressTrades(inputs, {
            maxTickers: 40,
            pricesByTicker,
          });
          const fields = metrics
            ? metricsToSnapshotFields(metrics)
            : {
                series: [],
                holdings: [],
                period_returns: {},
                portfolio_value: null,
                total_return_pct: null,
                metrics: null,
              };
          await upsertPortfolioSnapshot(supabase, {
            person_id: t.id,
            kind: 'politician',
            ...fields,
            profile_meta: { trade_count: inputs.length },
            source_meta: {
              mode,
              accuracy: 'congress_yahoo_first_added',
              yahoo_tickers: Array.from(pricesByTicker.keys()).length,
            },
          });
          ok++;
        } else if (t.kind === 'insider') {
          const inputs = insiderInputs.get(t.id) ?? [];
          if (!inputs.length) {
            await upsertPortfolioSnapshot(supabase, {
              person_id: t.id,
              kind: 'insider',
              series: [],
              holdings: [],
              period_returns: {},
              source_meta: { reason: 'no_trades', mode },
            });
            ok++;
            continue;
          }
          const metrics = await metricsFromCongressTrades(inputs, {
            maxTickers: 20,
            pricesByTicker,
          });
          const fields = metrics
            ? metricsToSnapshotFields(metrics)
            : {
                series: [],
                holdings: [],
                period_returns: {},
                portfolio_value: null,
                total_return_pct: null,
                metrics: null,
              };
          await upsertPortfolioSnapshot(supabase, {
            person_id: t.id,
            kind: 'insider',
            ...fields,
            profile_meta: { trade_count: inputs.length },
            source_meta: {
              mode,
              accuracy: 'form4_db_disclosed_when_basis_reliable',
              trade_source: 'dark_pool_insider_buys',
            },
          });
          ok++;
        } else if (t.kind === 'fund_manager') {
          await materializeFund(supabase, t.id, pricesByTicker, mode);
          ok++;
        }
      } catch (e) {
        fail++;
        errors.push(`${t.kind}:${t.id}: ${(e as Error).message}`);
        console.error('materialize failed', t, e);
      }
    }

    return json({
      ok: true,
      mode,
      targets: targets.length,
      materialized: ok,
      failed: fail,
      yahoo_tickers: pricesByTicker.size,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    console.error('materialize-darkpool-portfolios', e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function resolveTargets(
  supabase: ReturnType<typeof createServiceSupabase>,
  mode: string
): Promise<Target[]> {
  const byKey = new Map<string, Target>();
  const add = (t: Target) => {
    if (!t.id) return;
    byKey.set(`${t.kind}:${t.id}`, t);
  };

  // תמיד curated
  for (const c of CURATED_MATERIALIZE_TARGETS) add(c);

  // featured מ-DB
  const { data: featured } = await supabase
    .from('dark_pool_featured_profiles')
    .select('person_id, kind, ticker')
    .order('sort_order', { ascending: true })
    .limit(80);
  for (const f of featured ?? []) {
    const kind = String(f.kind ?? '') as SnapshotKind;
    if (kind !== 'politician' && kind !== 'insider' && kind !== 'fund_manager') {
      continue;
    }
    add({
      id: String(f.person_id),
      kind,
      ticker: f.ticker ? String(f.ticker) : undefined,
    });
  }

  if (mode === 'hot' || mode === 'full') {
    // followed — unique
    const { data: followed } = await supabase
      .from('dark_pool_followed_investors')
      .select('person_id, kind, ticker')
      .limit(500);
    for (const f of followed ?? []) {
      const kind = String(f.kind ?? '') as SnapshotKind;
      if (kind !== 'politician' && kind !== 'insider' && kind !== 'fund_manager') {
        continue;
      }
      add({
        id: String(f.person_id),
        kind,
        ticker: f.ticker ? String(f.ticker) : undefined,
      });
    }

    // recent feed activity — congress + insider
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: recentPol } = await supabase
      .from('dark_pool_congress_trades')
      .select('politician_id')
      .gte('filed_at', since)
      .order('filed_at', { ascending: false })
      .limit(120);
    for (const r of recentPol ?? []) {
      add({ id: String(r.politician_id), kind: 'politician' });
    }

    const { data: recentIns } = await supabase
      .from('dark_pool_insider_buys')
      .select('ticker, insider_name')
      .gte('filed_at', since)
      .order('filed_at', { ascending: false })
      .limit(80);
    for (const r of recentIns ?? []) {
      const ticker = String(r.ticker ?? '').toUpperCase();
      const name = String(r.insider_name ?? '').trim();
      if (!ticker || !name) continue;
      // person key כמו בפרופיל: TICKER:Last First → נשמור Last כפי שב-DB
      const parts = name.split(/\s+/).filter(Boolean);
      const keyName =
        parts.length >= 2
          ? `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`
          : name;
      add({ id: `${ticker}:${keyName}`, kind: 'insider', ticker });
    }
  }

  if (mode === 'full') {
    const { data: funds } = await supabase
      .from('dark_pool_fund_managers')
      .select('cik')
      .order('last_value_usd', { ascending: false })
      .limit(40);
    for (const f of funds ?? []) add({ id: String(f.cik), kind: 'fund_manager' });
  }

  // hot: הגבלת גודל
  const all = Array.from(byKey.values());
  if (mode === 'hot') return all.slice(0, 60);
  return all.slice(0, 200);
}

async function materializeFund(
  supabase: ReturnType<typeof createServiceSupabase>,
  cik: string,
  pricesByTicker: Map<string, Map<string, number>>,
  mode: string
) {
  const { data: fund } = await supabase
    .from('dark_pool_fund_managers')
    .select(
      'cik, name, manager_name, image_url, last_filing_date, last_value_usd, holdings_count'
    )
    .eq('cik', cik)
    .maybeSingle();
  if (!fund) {
    throw new Error(`fund ${cik} not found`);
  }

  const filingDate = fund.last_filing_date
    ? String(fund.last_filing_date).slice(0, 10)
    : null;

  const { data: historyRows } = await supabase
    .from('dark_pool_fund_holdings')
    .select('filing_date, ticker, value_usd, issuer_name, shares, allocation_pct')
    .eq('fund_cik', cik);

  const totalsByDate = new Map<string, number>();
  const firstSeenByTicker = new Map<string, string>();
  for (const row of historyRows ?? []) {
    const d = String(row.filing_date ?? '').slice(0, 10);
    const ticker = String(row.ticker ?? '').toUpperCase();
    const v = Number(row.value_usd) || 0;
    if (d && v > 0) totalsByDate.set(d, (totalsByDate.get(d) ?? 0) + v);
    if (d && ticker) {
      const prev = firstSeenByTicker.get(ticker);
      if (!prev || d < prev) firstSeenByTicker.set(ticker, d);
    }
  }

  const value_series = Array.from(totalsByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));

  let holdings: Array<Record<string, unknown>> = [];
  if (filingDate) {
    const latest = (historyRows ?? []).filter(
      (r) => String(r.filing_date ?? '').slice(0, 10) === filingDate
    );
    latest.sort((a, b) => (Number(b.value_usd) || 0) - (Number(a.value_usd) || 0));
    holdings = latest.slice(0, 40).map((r) => {
      const ticker = String(r.ticker).toUpperCase();
      const firstAdded =
        firstSeenByTicker.get(ticker) ?? filingDate;
      const map = pricesByTicker.get(ticker);
      let entry: number | null = null;
      let current: number | null = null;
      if (map && map.size) {
        entry = firstAdded ? priceOnOrBefore(map, firstAdded) : null;
        let bestDate = '';
        for (const [d, p] of map.entries()) {
          if (!Number.isFinite(p) || !(p > 0)) continue;
          if (d >= bestDate) {
            bestDate = d;
            current = p;
          }
        }
      }
      const entry_price =
        entry != null && entry > 0 ? Math.round(entry * 10000) / 10000 : null;
      const current_price =
        current != null && current > 0
          ? Math.round(current * 10000) / 10000
          : null;
      const return_pct =
        entry_price != null && current_price != null
          ? Math.round(((current_price - entry_price) / entry_price) * 10000) / 100
          : null;
      return {
        ticker,
        issuer_name: r.issuer_name ? String(r.issuer_name) : null,
        shares: r.shares != null ? Number(r.shares) : null,
        value_usd: r.value_usd != null ? Number(r.value_usd) : null,
        allocation_pct:
          r.allocation_pct != null ? Number(r.allocation_pct) : null,
        first_added_date: firstAdded,
        entry_price,
        current_price,
        return_pct,
      };
    });
  }

  const period_returns = buildPeriodReturns(value_series);
  const first = value_series[0]?.value ?? 0;
  const last = value_series[value_series.length - 1]?.value ?? 0;
  const total_return_pct =
    value_series.length >= 2 && first > 0
      ? Math.round(((last - first) / first) * 10000) / 100
      : null;

  await upsertPortfolioSnapshot(supabase, {
    person_id: cik,
    kind: 'fund_manager',
    series: value_series,
    holdings,
    period_returns,
    portfolio_value: fund.last_value_usd != null ? Number(fund.last_value_usd) : last || null,
    total_return_pct,
    profile_meta: {
      name: String(fund.manager_name || fund.name || 'קרן'),
      subtitle: String(fund.name || '13F'),
      image_url: fund.image_url ? String(fund.image_url) : null,
      holdings_count: Number(fund.holdings_count) || holdings.length,
      filing_date: filingDate,
    },
    source_meta: {
      mode,
      accuracy: '13f_yahoo_at_first_added',
    },
  });
}

function buildPeriodReturns(
  series: Array<{ date: string; value: number }>
): Record<string, number | null> {
  if (series.length < 2) {
    return { '1M': null, '3M': null, YTD: null, '1Y': null, '5Y': null, ALL: null };
  }
  const last = series[series.length - 1];
  const pctFromDays = (days: number): number | null => {
    const cutoff = new Date(last.date);
    cutoff.setDate(cutoff.getDate() - days);
    const iso = cutoff.toISOString().slice(0, 10);
    const start = series.find((p) => p.date >= iso);
    if (!start || start.value <= 0) return null;
    return Math.round(((last.value - start.value) / start.value) * 10000) / 100;
  };
  const yearStart = `${last.date.slice(0, 4)}-01-01`;
  const ytdStart = series.find((p) => p.date >= yearStart);
  const ytd =
    ytdStart && ytdStart.value > 0
      ? Math.round(((last.value - ytdStart.value) / ytdStart.value) * 10000) / 100
      : null;
  const first = series[0];
  const all =
    first.value > 0
      ? Math.round(((last.value - first.value) / first.value) * 10000) / 100
      : null;
  return {
    '1M': pctFromDays(30),
    '3M': pctFromDays(90),
    YTD: ytd,
    '1Y': pctFromDays(365),
    '5Y': pctFromDays(365 * 5),
    ALL: all,
  };
}

function dedupeInputs(inputs: CongressTradeInput[]): CongressTradeInput[] {
  const seen = new Set<string>();
  const out: CongressTradeInput[] = [];
  for (const row of inputs) {
    const key = `${row.ticker}:${row.transaction_date}:${row.txn_type}:${row.amounts ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
