/**
 * sync-fund-13f-sec — אחזקות 13F ישירות מ-SEC EDGAR לכל הקרנות (עד 16 רבעונים; רבעון שנקרא — מדלגים).
 * שורות מסומנות source='sec', והקוראים מעדיפים אותן על Quiver לאותה תקופה.
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

type Sec13fMeta = {
  manager: string;
  name: string;
  image?: string;
  /** company = חברה ציבורית שמגישה 13F (אחזקות אסטרטגיות), לא קרן */
  entity_type?: 'fund' | 'company';
  /** טיקר החברה עצמה — לוגו ותת-כותרת «חברה ציבורית · NVDA» */
  ticker?: string;
};

const company = (name: string, display: string, ticker: string): Sec13fMeta => ({
  manager: display,
  name,
  entity_type: 'company',
  ticker,
});

/** קרנות שנקראות מה-SEC (Quiver לא מחזיר להן אחזקות) + חברות ציבוריות שמגישות 13F-HR */
export const SEC_13F_FUNDS: Record<string, Sec13fMeta> = {
  '1647251': {
    manager: 'Chris Hohn',
    name: 'TCI Fund Management',
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/31/Chris_Hohn_GFSS_2023.jpg',
  },
  '1747057': { manager: 'Dan Sundheim', name: 'D1 Capital Partners' },

  // ── חברות (לא פיננסיות) — 13F-HR ב-2 הרבעונים האחרונים, אומת מול EDGAR 2026-10-26 ──
  // חייב להישאר מסונכרן עם CURATED_MATERIALIZE_TARGETS ב-_shared/darkpoolPortfolioSnapshots.ts
  '1045810': company('NVIDIA Corp', 'NVIDIA', 'NVDA'),
  '1652044': company('Alphabet Inc.', 'Alphabet', 'GOOGL'),
  '1065521': company('SoftBank Group Corp.', 'SoftBank', 'SFTBY'),
  '1543151': company('Uber Technologies, Inc.', 'Uber', 'UBER'),
  '1018724': company('Amazon.com, Inc.', 'Amazon', 'AMZN'),
  '1094517': company('Toyota Motor Corp.', 'Toyota', 'TM'),
  '882095': company('Gilead Sciences, Inc.', 'Gilead', 'GILD'),
  '2488': company('Advanced Micro Devices, Inc.', 'AMD', 'AMD'),
  '200406': company('Johnson & Johnson', 'Johnson & Johnson', 'JNJ'),
  '1110646': company('NetEase, Inc.', 'NetEase', 'NTES'),
  '104169': company('Walmart Inc.', 'Walmart', 'WMT'),
  '50863': company('Intel Corp', 'Intel', 'INTC'),
  '310158': company('Merck & Co., Inc.', 'Merck', 'MRK'),
  '1121404': company('Sanofi', 'Sanofi', 'SNY'),
  '1577552': company('Alibaba Group Holding Ltd', 'Alibaba', 'BABA'),
  '40545': company('GE Aerospace', 'GE Aerospace', 'GE'),
  '858877': company('Cisco Systems, Inc.', 'Cisco', 'CSCO'),
  '872589': company('Regeneron Pharmaceuticals, Inc.', 'Regeneron', 'REGN'),
  '78003': company('Pfizer Inc.', 'Pfizer', 'PFE'),

  // ── QA 11.3 (2026-11-08): עוד חברות לא פיננסיות — 13F-HR ב-Q3 2026, אומת מול EDGAR form.idx ──
  '1069183': company('Axon Enterprise, Inc.', 'Axon', 'AXON'),
  '6201': company('American Airlines Group Inc.', 'American Airlines', 'AAL'),
  '27904': company('Delta Air Lines, Inc.', 'Delta', 'DAL'),
  '100517': company('United Airlines Holdings, Inc.', 'United Airlines', 'UAL'),
  '93410': company('Chevron Corp', 'Chevron', 'CVX'),
  '313807': company('BP p.l.c.', 'BP', 'BP'),
  '1090012': company('Devon Energy Corp', 'Devon Energy', 'DVN'),
  '64803': company('CVS Health Corp', 'CVS Health', 'CVS'),
  '1131399': company('GSK plc', 'GSK', 'GSK'),
  '920760': company('Lennar Corp', 'Lennar', 'LEN'),
  '873303': company('Sarepta Therapeutics, Inc.', 'Sarepta', 'SRPT'),
  '104889': company('Graham Holdings Co', 'Graham Holdings', 'GHC'),
  '783412': company('Daily Journal Corp', 'Daily Journal', 'DJCO'),

  // ── QA 11.3: עוד קרנות (כולל Situational Awareness) — 13F-HR ב-Q3 2026, אומת מול EDGAR ──
  '2045724': { manager: 'Leopold Aschenbrenner', name: 'Situational Awareness LP' },
  '1791786': { manager: 'Paul Singer', name: 'Elliott Investment Management' },
  '1061165': { manager: 'Stephen Mandel', name: 'Lone Pine Capital' },
  '1709323': { manager: 'Li Lu', name: 'Himalaya Capital Management' },
  '1418814': { manager: 'Mason Morfit', name: 'ValueAct Capital' },
  '1541617': { manager: 'Brad Gerstner', name: 'Altimeter Capital' },
  '1358706': { manager: 'David Abrams', name: 'Abrams Capital Management' },
  '1112520': { manager: 'Chuck Akre', name: 'Akre Capital Management' },
  '1602189': { manager: 'Marc Stad', name: 'Dragoneer Investment Group' },
  '1798849': { manager: 'Henry Ellenbogen', name: 'Durable Capital Partners' },
  '1569205': { manager: 'Terry Smith', name: 'Fundsmith' },
  '1387322': { manager: 'Alex Sacerdote', name: 'Whale Rock Capital' },
};

const TIME_BUDGET_MS = 120_000;

serve(async (req) => {
  if (!isServiceCaller(req)) return serviceOnlyDenied();
  const started = Date.now();
  const body = (await req.json().catch(() => ({}))) as { ciks?: string[]; filings?: number; refresh?: boolean };
  const maxFilings = Math.max(1, Math.min(Number(body.filings) || 16, 16));

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  // ברירת מחדל: כל הקרנות (גם אלה מ-Quiver) — ה-SEC הוא מקור האמת להיסטוריה; Quiver נשאר גיבוי
  let ciks: string[];
  if (body.ciks?.length) ciks = body.ciks.map((c) => String(c).trim());
  else {
    const { data } = await supabase.from('dark_pool_fund_managers').select('cik').order('synced_at', { ascending: true, nullsFirst: true });
    // הכי פחות מעודכנים קודם (סבב הוגן בתקציב הזמן); רשומות SEC חדשות שעוד לא ב-DB — בסוף
    ciks = Array.from(new Set([...(data ?? []).map((r) => String(r.cik)), ...Object.keys(SEC_13F_FUNDS)]));
  }

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

      // קודם המנהל (FK של האחזקות) — רק לקרנות SEC-בלבד; לקיימות לא דורסים שם/תמונה
      if (meta) {
        await supabase.from('dark_pool_fund_managers').upsert(
          {
            cik,
            name: meta.name ?? secName,
            manager_name: meta.manager ?? secName,
            image_url: meta.image ?? null,
            source: 'sec',
            entity_type: meta.entity_type ?? 'fund',
            ticker: meta.ticker ?? null,
          },
          { onConflict: 'cik' }
        );
      }

      // תקופות שכבר נקראו מה-SEC — לא קוראים שוב (חוץ מהאחרונה, למקרה של הגשה מתוקנת)
      const { data: doneRows } = await supabase
        .from('dark_pool_fund_holdings')
        .select('filing_date')
        .eq('fund_cik', cik)
        .eq('source', 'sec')
        .limit(1000);
      const done = new Set((doneRows ?? []).map((r) => String(r.filing_date).slice(0, 10)));

      let latest: { period: string; total: number; count: number } | null = null;
      let written = 0;
      let skipped = 0;
      for (const [i, f] of filings.entries()) {
        if (Date.now() - started > TIME_BUDGET_MS) break;
        if (i > 0 && !body.refresh && done.has(f.period)) {
          skipped++;
          continue;
        }
        const rows = await fetchSec13fInfoTable(cik, f.accession);
        if (!rows.length) continue;
        // הגשות לפני 3.1.2023 מדווחות value באלפי דולרים
        if (f.filed && f.filed < '2023-01-03') for (const r of rows) r.value_usd *= 1000;
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
            source: 'sec',
            synced_at: now,
          })),
          { onConflict: 'fund_cik,filing_date,ticker' }
        );
        if (error) throw new Error(error.message);
        written += holdings.length;
        if (!latest) latest = { period: f.period, total, count: holdings.length };
      }

      if (latest && meta) {
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
      results.push({ cik, ok: true, filings: filings.length, skipped, holdings_written: written, latest });
    } catch (e) {
      results.push({ cik, ok: false, error: String((e as Error)?.message ?? e).slice(0, 200) });
    }
  }

  return new Response(JSON.stringify({ ok: true, results, ms: Date.now() - started }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
