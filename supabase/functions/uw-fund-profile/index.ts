// uw-fund-profile — תיק 13F מ-DB + snapshot ממומש (Yahoo@first_added ב-cron)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  priceOnOrBefore,
} from '../_shared/congressPortfolio.ts';
import {
  CURATED_ID_SET,
  ensureYahooPriceMaps,
  isSnapshotFresh,
  loadPortfolioSnapshot,
  upsertPortfolioSnapshot,
} from '../_shared/darkpoolPortfolioSnapshots.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FundHolding {
  ticker: string;
  issuer_name: string | null;
  shares: number | null;
  value_usd: number | null;
  allocation_pct: number | null;
  first_added_date?: string | null;
  entry_price?: number | null;
  current_price?: number | null;
  return_pct?: number | null;
}

interface ValuePoint {
  date: string;
  value: number;
}

interface FundProfilePayload {
  id: string;
  kind: 'fund_manager';
  name: string;
  subtitle: string;
  image_url: string | null;
  stats: {
    holdings_count: number;
    total_value_usd: number | null;
    filing_date: string | null;
    total_return_pct: number | null;
    period_returns: Record<string, number | null>;
  };
  holdings: FundHolding[];
  value_series: ValuePoint[];
  portfolio_source?: 'snapshot' | 'live' | 'db_only';
  snapshot_computed_at?: string | null;
  fetched_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  let cik = '';
  try {
    const body = await req.json();
    cik = String(body.id ?? body.cik ?? '').trim();
  } catch {
    return json({ error: 'id required' }, 400);
  }
  if (!cik) return json({ error: 'id required' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  const { data: fund, error: fundErr } = await supabase
    .from('dark_pool_fund_managers')
    .select('cik, name, manager_name, image_url, last_filing_date, last_value_usd, holdings_count')
    .eq('cik', cik)
    .maybeSingle();

  if (fundErr) return json({ error: fundErr.message }, 500);
  if (!fund) return json({ error: 'fund not found' }, 404);

  const snap = await loadPortfolioSnapshot(supabase, cik, 'fund_manager').catch(
    () => null
  );

  if (snap && isSnapshotFresh(snap.computed_at)) {
    const meta = (snap.profile_meta ?? {}) as Record<string, unknown>;
    const holdings = (Array.isArray(snap.holdings) ? snap.holdings : []) as FundHolding[];
    const value_series = (Array.isArray(snap.series) ? snap.series : []) as ValuePoint[];
    const period_returns =
      (snap.period_returns as Record<string, number | null>) ?? {};
    const payload: FundProfilePayload = {
      id: String(fund.cik),
      kind: 'fund_manager',
      name: String(meta.name ?? fund.manager_name ?? fund.name ?? 'קרן'),
      subtitle: String(meta.subtitle ?? fund.name ?? '13F'),
      image_url:
        (meta.image_url ? String(meta.image_url) : null) ??
        (fund.image_url ? String(fund.image_url) : null),
      stats: {
        holdings_count:
          Number(meta.holdings_count) ||
          Number(fund.holdings_count) ||
          holdings.length,
        total_value_usd:
          snap.portfolio_value != null
            ? Number(snap.portfolio_value)
            : fund.last_value_usd != null
              ? Number(fund.last_value_usd)
              : null,
        filing_date:
          (meta.filing_date ? String(meta.filing_date) : null) ??
          (fund.last_filing_date ? String(fund.last_filing_date) : null),
        total_return_pct:
          snap.total_return_pct != null ? Number(snap.total_return_pct) : null,
        period_returns,
      },
      holdings,
      value_series,
      portfolio_source: 'snapshot',
      snapshot_computed_at: snap.computed_at,
      fetched_at: new Date().toISOString(),
    };
    return json(payload, 200);
  }

  // אין snapshot טרי — חישוב מ-DB (+ bootstrap ל-curated)
  const filingDate = fund.last_filing_date;
  let holdings: FundHolding[] = [];

  const { data: historyRows } = await supabase
    .from('dark_pool_fund_holdings')
    .select('filing_date, ticker, value_usd')
    .eq('fund_cik', cik);

  const totalsByDate = new Map<string, number>();
  const firstSeenByTicker = new Map<string, string>();
  for (const row of historyRows ?? []) {
    const d = String(row.filing_date ?? '').slice(0, 10);
    const ticker = String(row.ticker ?? '').toUpperCase();
    const v = Number(row.value_usd) || 0;
    if (d && v > 0) {
      totalsByDate.set(d, (totalsByDate.get(d) ?? 0) + v);
    }
    if (d && ticker) {
      const prev = firstSeenByTicker.get(ticker);
      if (!prev || d < prev) firstSeenByTicker.set(ticker, d);
    }
  }

  const shouldBootstrap = CURATED_ID_SET.has(cik) || !snap;

  if (filingDate) {
    const { data: rows } = await supabase
      .from('dark_pool_fund_holdings')
      .select('ticker, issuer_name, shares, value_usd, allocation_pct')
      .eq('fund_cik', cik)
      .eq('filing_date', filingDate)
      .order('value_usd', { ascending: false })
      .limit(40);

    holdings = (rows ?? []).map((r) => {
      const ticker = String(r.ticker);
      const shares = r.shares != null ? Number(r.shares) : null;
      const value_usd = r.value_usd != null ? Number(r.value_usd) : null;
      return {
        ticker,
        issuer_name: r.issuer_name ? String(r.issuer_name) : null,
        shares,
        value_usd,
        allocation_pct: r.allocation_pct != null ? Number(r.allocation_pct) : null,
        first_added_date:
          firstSeenByTicker.get(ticker.toUpperCase()) ??
          (filingDate ? String(filingDate).slice(0, 10) : null),
        entry_price: null,
        current_price: null,
        return_pct: null,
      };
    });

    if (shouldBootstrap && holdings.length) {
      const priceTargets = holdings.slice(0, 20);
      const tickers = priceTargets.map((h) => h.ticker.toUpperCase());
      const pricesByTicker = await ensureYahooPriceMaps(supabase, tickers);
      holdings = holdings.map((h) => {
        const map = pricesByTicker.get(h.ticker.toUpperCase().trim());
        if (!map || !map.size) return h;
        const firstAdded = (h.first_added_date ?? '').slice(0, 10);
        const entry =
          firstAdded && map.size ? priceOnOrBefore(map, firstAdded) : null;
        let bestDate = '';
        let current: number | null = null;
        for (const [d, p] of map.entries()) {
          if (!Number.isFinite(p) || !(p > 0)) continue;
          if (d >= bestDate) {
            bestDate = d;
            current = p;
          }
        }
        if (entry == null || current == null || !(entry > 0) || !(current > 0)) {
          return {
            ...h,
            entry_price: entry != null && entry > 0 ? Math.round(entry * 10000) / 10000 : null,
            current_price:
              current != null && current > 0
                ? Math.round(current * 10000) / 10000
                : null,
            return_pct: null,
          };
        }
        return {
          ...h,
          current_price: Math.round(current * 10000) / 10000,
          entry_price: Math.round(entry * 10000) / 10000,
          return_pct: Math.round(((current - entry) / entry) * 10000) / 100,
        };
      });
    } else if (snap && Array.isArray(snap.holdings) && snap.holdings.length) {
      // snapshot ישן — מחזירים holdings עם מחירים מה-snapshot
      holdings = snap.holdings as FundHolding[];
    }
  }

  const value_series: ValuePoint[] = Array.from(totalsByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));

  const period_returns = buildPeriodReturns(value_series);
  const first = value_series[0]?.value ?? 0;
  const last = value_series[value_series.length - 1]?.value ?? 0;
  const total_return_pct =
    value_series.length >= 2 && first > 0
      ? Math.round(((last - first) / first) * 10000) / 100
      : null;

  const displayName = String(fund.manager_name || fund.name || 'קרן');
  let snapshot_computed_at: string | null = snap?.computed_at ?? null;

  if (shouldBootstrap) {
    try {
      await upsertPortfolioSnapshot(supabase, {
        person_id: cik,
        kind: 'fund_manager',
        series: value_series,
        holdings,
        period_returns,
        portfolio_value:
          fund.last_value_usd != null ? Number(fund.last_value_usd) : last || null,
        total_return_pct,
        profile_meta: {
          name: displayName,
          subtitle: String(fund.name || '13F'),
          image_url: fund.image_url ? String(fund.image_url) : null,
          holdings_count: Number(fund.holdings_count) || holdings.length,
          filing_date: filingDate ? String(filingDate) : null,
          bootstrap: true,
        },
        source_meta: {
          accuracy: '13f_yahoo_at_first_added',
          path: 'profile_bootstrap',
        },
      });
      snapshot_computed_at = new Date().toISOString();
    } catch (e) {
      console.warn('fund bootstrap snapshot', cik, e);
    }
  }

  const payload: FundProfilePayload = {
    id: String(fund.cik),
    kind: 'fund_manager',
    name: displayName,
    subtitle: String(fund.name || '13F'),
    image_url: fund.image_url ? String(fund.image_url) : null,
    stats: {
      holdings_count: Number(fund.holdings_count) || holdings.length,
      total_value_usd: fund.last_value_usd != null ? Number(fund.last_value_usd) : null,
      filing_date: filingDate ? String(filingDate) : null,
      total_return_pct,
      period_returns,
    },
    holdings,
    value_series,
    portfolio_source: shouldBootstrap ? 'live' : 'db_only',
    snapshot_computed_at,
    fetched_at: new Date().toISOString(),
  };

  return json(payload, 200);
});

function buildPeriodReturns(series: ValuePoint[]): Record<string, number | null> {
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
