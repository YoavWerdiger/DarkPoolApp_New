/**
 * sync-fund-13f-sec — אחזקות 13F ישירות מ-SEC EDGAR, לקרנות ש-Quiver לא מכסה (או מכסה חלקית).
 * כותב לאותן טבלאות כמו sync-fund-13f (dark_pool_fund_managers / dark_pool_fund_holdings),
 * כך שהמסכים וה-materialize עובדים בלי שינוי. שרת בלבד (מפתח service).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { isServiceCaller, serviceOnlyDenied } from '../_shared/serviceOnly.ts';
import {
  aggregateSec13f,
  fetchSec13fInfoTable,
  listSec13fFilings,
  mapCusipsToTickers,
} from '../_shared/sec13f.ts';

/** קרנות שנקראות מה-SEC (Quiver לא מחזיר להן אחזקות) */
export const SEC_13F_FUNDS: Record<string, { manager: string; name: string; image?: string }> = {
  '1647251': {
    manager: 'Chris Hohn',
    name: 'TCI Fund Management',
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/31/Chris_Hohn_GFSS_2023.jpg',
  },
  '1747057': { manager: 'Dan Sundheim', name: 'D1 Capital Partners' },
};

const TIME_BUDGET_MS = 120_000;

serve(async (req) => {
  if (!isServiceCaller(req)) return serviceOnlyDenied();
  const started = Date.now();
  const body = (await req.json().catch(() => ({}))) as { ciks?: string[]; filings?: number };
  const ciks = (body.ciks?.length ? body.ciks : Object.keys(SEC_13F_FUNDS)).map((c) => String(c).trim());
  const maxFilings = Math.max(1, Math.min(Number(body.filings) || 8, 16));

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  const results: Array<Record<string, unknown>> = [];
  for (const cik of ciks) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      results.push({ cik, skipped: 'time_budget' });
      continue;
    }
    try {
      const meta = SEC_13F_FUNDS[cik];
      const { name: secName, filings } = await listSec13fFilings(cik, maxFilings);
      if (!filings.length) {
        results.push({ cik, ok: false, reason: 'no_13f' });
        continue;
      }

      // קודם המנהל (FK של האחזקות)
      await supabase.from('dark_pool_fund_managers').upsert(
        {
          cik,
          name: meta?.name ?? secName,
          manager_name: meta?.manager ?? secName,
          image_url: meta?.image ?? null,
          source: 'sec',
        },
        { onConflict: 'cik' }
      );

      let latest: { period: string; total: number; count: number } | null = null;
      let written = 0;
      for (const f of filings) {
        if (Date.now() - started > TIME_BUDGET_MS) break;
        const rows = await fetchSec13fInfoTable(cik, f.accession);
        if (!rows.length) continue;
        const tickers = await mapCusipsToTickers(supabase, rows.map((r) => r.cusip));
        const holdings = aggregateSec13f(rows, tickers);
        const total = holdings.reduce((s, h) => s + h.value_usd, 0);
        const now = new Date().toISOString();
        const { error } = await supabase.from('dark_pool_fund_holdings').upsert(
          holdings.map((h) => ({
            fund_cik: cik,
            filing_date: f.period,
            ticker: h.ticker,
            issuer_name: h.issuer_name,
            cusip: h.cusip,
            shares: h.shares,
            value_usd: h.value_usd,
            allocation_pct: h.allocation_pct,
            synced_at: now,
          })),
          { onConflict: 'fund_cik,filing_date,ticker' }
        );
        if (error) throw new Error(error.message);
        written += holdings.length;
        if (!latest) latest = { period: f.period, total, count: holdings.length };
      }

      if (latest) {
        await supabase
          .from('dark_pool_fund_managers')
          .update({
            last_filing_date: latest.period,
            last_value_usd: latest.total,
            holdings_count: latest.count,
            synced_at: new Date().toISOString(),
          })
          .eq('cik', cik);
      }
      results.push({ cik, ok: true, filings: filings.length, holdings_written: written, latest });
    } catch (e) {
      results.push({ cik, ok: false, error: String((e as Error)?.message ?? e).slice(0, 200) });
    }
  }

  return new Response(JSON.stringify({ ok: true, results, ms: Date.now() - started }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
