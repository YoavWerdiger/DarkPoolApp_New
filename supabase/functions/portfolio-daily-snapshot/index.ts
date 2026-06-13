// ============================================================================
// portfolio-daily-snapshot edge function
// ----------------------------------------------------------------------------
// מחשב snapshot יומי לכל תיק ומכניס ל-public.portfolio_value_history.
//
// נקרא ע"י pg_cron בסוף יום מסחר (~23:00 UTC).
// ניתן גם לקריאה ידנית עם backfill_days כדי למלא היסטוריה.
//
// Body (JSON, אופציונלי):
//   { portfolio_id?: string }   – להגביל לתיק יחיד.
//   { backfill_days?: number }  – להוסיף N ימים אחורה (0..730).
//
// אימות: service-role בלבד (משימוש pg_cron + vault, או יד-נית).
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
interface Tx {
  type: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'fee' | 'dividend';
  symbol: string | null;
  date: string;
  quantity: number | null;
  price: number | null;
  commission: number | null;
  amount: number | null;
}

interface YahooPoint {
  date: string; // YYYY-MM-DD
  close: number;
}

interface SnapshotRow {
  portfolio_id: string;
  date: string;
  total_value: number;
  cash: number;
  invested: number;
  unrealized: number;
  realized: number;
}

type YahooRange = '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | 'max';

// ----------------------------------------------------------------------------
// Yahoo prices
// ----------------------------------------------------------------------------
async function fetchYahooDaily(
  symbol: string,
  range: YahooRange
): Promise<YahooPoint[]> {
  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent(
      symbol
    )}?range=${range}&interval=1d`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const r = data?.chart?.result?.[0];
    if (!r?.timestamp) return [];
    const closes =
      r.indicators?.adjclose?.[0]?.adjclose ||
      r.indicators?.quote?.[0]?.close;
    const out: YahooPoint[] = [];
    for (let i = 0; i < r.timestamp.length; i++) {
      const c = closes?.[i];
      if (c == null) continue;
      const d = new Date(r.timestamp[i] * 1000).toISOString().slice(0, 10);
      out.push({ date: d, close: Number(c) });
    }
    return out;
  } catch {
    return [];
  }
}

// ----------------------------------------------------------------------------
// Snapshot computation (FIFO)
// ----------------------------------------------------------------------------
function findPriceOnOrBefore(
  priceMap: Map<string, number>,
  asOfDate: string,
  lookbackDays = 10
): number | null {
  const d = new Date(asOfDate + 'T00:00:00Z');
  for (let i = 0; i < lookbackDays; i++) {
    const iso = d.toISOString().slice(0, 10);
    const px = priceMap.get(iso);
    if (px != null) return px;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return null;
}

function computeSnapshot(
  portfolioId: string,
  txs: Tx[],
  pricesBySymbol: Map<string, Map<string, number>>,
  asOfDate: string
): SnapshotRow | null {
  // Include תרנזקציות עד כולל asOfDate
  const sorted = txs
    .filter((t) => t.date.slice(0, 10) <= asOfDate)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (!sorted.length) return null;

  let cash = 0;
  let realized = 0;
  const lots: Map<string, Array<{ qty: number; price: number }>> = new Map();

  for (const t of sorted) {
    const commission = Number(t.commission ?? 0);
    switch (t.type) {
      case 'buy': {
        if (!t.symbol) break;
        const qty = Number(t.quantity ?? 0);
        const px = Number(t.price ?? 0);
        cash -= qty * px + commission;
        const arr = lots.get(t.symbol) ?? [];
        arr.push({ qty, price: px });
        lots.set(t.symbol, arr);
        break;
      }
      case 'sell': {
        if (!t.symbol) break;
        let qtyRem = Number(t.quantity ?? 0);
        const px = Number(t.price ?? 0);
        cash += qtyRem * px - commission;
        const arr = lots.get(t.symbol) ?? [];
        while (qtyRem > 1e-12 && arr.length) {
          const lot = arr[0];
          const take = Math.min(lot.qty, qtyRem);
          realized += (px - lot.price) * take;
          lot.qty -= take;
          qtyRem -= take;
          if (lot.qty <= 1e-12) arr.shift();
        }
        lots.set(t.symbol, arr);
        break;
      }
      case 'deposit':
        cash += Number(t.amount ?? 0);
        break;
      case 'withdrawal':
      case 'fee':
        cash -= Number(t.amount ?? 0);
        break;
      case 'dividend':
        cash += Number(t.amount ?? 0);
        break;
    }
  }

  // Mark-to-market של פוזיציות פתוחות
  let positionsValue = 0;
  let invested = 0;
  for (const [sym, arr] of lots) {
    const totalQty = arr.reduce((s, l) => s + l.qty, 0);
    if (totalQty <= 1e-12) continue;
    const costBasis = arr.reduce((s, l) => s + l.qty * l.price, 0);
    invested += costBasis;
    const priceMap = pricesBySymbol.get(sym);
    const price = priceMap ? findPriceOnOrBefore(priceMap, asOfDate) : null;
    if (price != null) positionsValue += totalQty * price;
    else positionsValue += costBasis; // fallback: cost
  }

  const unrealized = positionsValue - invested;
  const totalValue = cash + positionsValue;

  return {
    portfolio_id: portfolioId,
    date: asOfDate,
    total_value: totalValue,
    cash,
    invested,
    unrealized,
    realized,
  };
}

// ----------------------------------------------------------------------------
// Date helpers
// ----------------------------------------------------------------------------
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildDateRange(backfillDays: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = backfillDays; i >= 0; i--) {
    const c = new Date(today);
    c.setUTCDate(today.getUTCDate() - i);
    dates.push(c.toISOString().slice(0, 10));
  }
  return dates;
}

function pickRangeForBackfill(days: number): YahooRange {
  if (days > 365 * 2) return '5y';
  if (days > 365) return '2y';
  if (days > 180) return '1y';
  if (days > 90) return '6mo';
  if (days > 30) return '3mo';
  if (days > 7) return '1mo';
  return '5d';
}

// ----------------------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SERVICE_ROLE_KEY' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const portfolioIdFilter =
      typeof body.portfolio_id === 'string' ? body.portfolio_id : undefined;
    const backfillDays = Math.max(
      0,
      Math.min(Number(body.backfill_days ?? 0), 730)
    );

    let query = admin
      .from('portfolios')
      .select('id, benchmark_symbol')
      .eq('is_archived', false);
    if (portfolioIdFilter) query = query.eq('id', portfolioIdFilter);
    const { data: portfolios, error: pErr } = await query;
    if (pErr) throw pErr;

    if (!portfolios || portfolios.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, total_rows: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dates =
      backfillDays > 0 ? buildDateRange(backfillDays) : [isoToday()];
    const yahooRange = pickRangeForBackfill(backfillDays);

    let totalInserted = 0;
    const results: Array<{
      portfolio_id: string;
      count: number;
      error?: string;
    }> = [];

    for (const p of portfolios) {
      try {
        const { data: txData, error: txErr } = await admin
          .from('portfolio_transactions')
          .select('type, symbol, date, quantity, price, commission, amount')
          .eq('portfolio_id', p.id)
          .order('date', { ascending: true });
        if (txErr) throw txErr;
        const txs: Tx[] = (txData ?? []) as Tx[];

        if (!txs.length) {
          results.push({ portfolio_id: p.id, count: 0 });
          continue;
        }

        const symbols = Array.from(
          new Set(txs.map((t) => t.symbol).filter(Boolean) as string[])
        );

        const pricesBySymbol = new Map<string, Map<string, number>>();
        await Promise.all(
          symbols.map(async (sym) => {
            const points = await fetchYahooDaily(sym, yahooRange);
            const m = new Map<string, number>();
            for (const pt of points) m.set(pt.date, pt.close);
            pricesBySymbol.set(sym, m);
          })
        );

        const rows: SnapshotRow[] = [];
        for (const date of dates) {
          const snap = computeSnapshot(p.id, txs, pricesBySymbol, date);
          if (snap) rows.push(snap);
        }

        if (rows.length) {
          // upsert בחלוקות (Supabase ב-batch גדול מאוד עשוי להיכשל)
          const CHUNK = 500;
          for (let i = 0; i < rows.length; i += CHUNK) {
            const chunk = rows.slice(i, i + CHUNK);
            const { error: upErr } = await admin
              .from('portfolio_value_history')
              .upsert(chunk, { onConflict: 'portfolio_id,date' });
            if (upErr) throw upErr;
          }
        }

        totalInserted += rows.length;
        results.push({ portfolio_id: p.id, count: rows.length });
      } catch (err) {
        console.error(`snapshot error for portfolio ${p.id}:`, err);
        results.push({
          portfolio_id: p.id,
          count: 0,
          error: (err as Error).message ?? 'error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: portfolios.length,
        total_rows: totalInserted,
        dates_count: dates.length,
        backfill_days: backfillDays,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('portfolio-daily-snapshot fatal:', e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? 'internal' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
