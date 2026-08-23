// uw-fund-profile — תיק 13F מ-DB + גרף היסטורי + מחיר כניסה Yahoo@first_added

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  fetchYahooDaily,
  priceOnOrBefore,
} from '../_shared/congressPortfolio.ts';

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
  /** דיווח 13F ראשון שבו הטיקר מופיע ב-DB שלנו */
  first_added_date?: string | null;
  /**
   * מחיר כניסה מוצר = מחיר שוק (Yahoo) ב־first_added_date —
   * כמו פוליטיקאים. לא value/shares מהדוח.
   */
  entry_price?: number | null;
  current_price?: number | null;
  /** (current - entry) / entry * 100 — רק כשיש שני המחירים */
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

    // Yahoo היסטורי: מחיר כניסה ב־first_added + מחיר נוכחי → תשואה. עד 20 מובילים.
    const priceTargets = holdings.slice(0, 20);
    if (priceTargets.length) {
      const settled = await Promise.all(
        priceTargets.map(async (h) => {
          const sym = h.ticker.toUpperCase().trim();
          const firstAdded = (h.first_added_date ?? '').slice(0, 10);
          const map = await fetchYahooDaily(sym, '5y');
          let bestDate = '';
          let current: number | null = null;
          for (const [d, p] of map.entries()) {
            if (!Number.isFinite(p) || !(p > 0)) continue;
            if (d >= bestDate) {
              bestDate = d;
              current = p;
            }
          }
          const entry =
            firstAdded && map.size
              ? priceOnOrBefore(map, firstAdded)
              : null;
          return [sym, { entry, current }] as const;
        })
      );
      const priceByTicker = new Map(settled);
      holdings = holdings.map((h) => {
        const row = priceByTicker.get(h.ticker.toUpperCase().trim());
        if (!row) return h;
        const entry = row.entry != null && row.entry > 0 ? row.entry : null;
        const current = row.current != null && row.current > 0 ? row.current : null;
        if (entry == null || current == null) {
          return {
            ...h,
            entry_price: entry != null ? Math.round(entry * 10000) / 10000 : null,
            current_price: current != null ? Math.round(current * 10000) / 10000 : null,
            return_pct: null,
          };
        }
        const return_pct =
          Math.round(((current - entry) / entry) * 10000) / 100;
        return {
          ...h,
          current_price: Math.round(current * 10000) / 10000,
          entry_price: Math.round(entry * 10000) / 10000,
          return_pct,
        };
      });
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
