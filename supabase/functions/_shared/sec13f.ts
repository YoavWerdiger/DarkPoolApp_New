/**
 * 13F ישירות מ-SEC EDGAR — לקרנות ש-Quiver לא מחזיר להן אחזקות (TCI, D1...).
 * submissions JSON → הגשות 13F-HR אחרונות → טבלת האחזקות (information table XML) → CUSIP → טיקר (OpenFIGI, עם cache).
 * בלי תלות ב-Quiver, בלי תקרת 2,000 שורות, וטיקרים עדכניים (לא SQ/FB ישנים).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';
import { SEC_USER_AGENT } from './edgarForm4.ts';

const SEC_GAP_MS = 150;
const OPENFIGI_URL = 'https://api.openfigi.com/v3/mapping';
/** בלי מפתח: 25 בקשות לדקה, עד 10 מיפויים לבקשה */
const OPENFIGI_GAP_MS = 2600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Sec13fFiling {
  accession: string;
  period: string;
  filed: string;
}

export interface Sec13fRow {
  issuer: string;
  cusip: string;
  value_usd: number;
  shares: number;
  put_call: string | null;
}

async function secGet(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'User-Agent': SEC_USER_AGENT } });
  await sleep(SEC_GAP_MS);
  return res;
}

/** הגשות 13F-HR (מקור, לא תיקון) — האחרונה לכל תקופה, מהחדשה לישנה */
export async function listSec13fFilings(cik: string, max = 8): Promise<{ name: string; filings: Sec13fFiling[] }> {
  const res = await secGet(`https://data.sec.gov/submissions/CIK${String(Number(cik)).padStart(10, '0')}.json`);
  if (!res.ok) throw new Error(`sec submissions ${res.status}`);
  const d = await res.json();
  const f = d?.filings?.recent ?? {};
  const out: Sec13fFiling[] = [];
  const seen = new Set<string>();
  const forms: string[] = f.form ?? [];
  for (let i = 0; i < forms.length && out.length < max; i++) {
    if (forms[i] !== '13F-HR') continue;
    const period = String(f.reportDate?.[i] ?? '').slice(0, 10);
    if (!period || seen.has(period)) continue;
    seen.add(period);
    out.push({ accession: String(f.accessionNumber[i]), period, filed: String(f.filingDate?.[i] ?? '') });
  }
  return { name: String(d?.name ?? ''), filings: out };
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/** טבלת האחזקות של הגשה — regex (ה-XML עם/בלי prefix של namespace) */
export async function fetchSec13fInfoTable(cik: string, accession: string): Promise<Sec13fRow[]> {
  const base = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, '')}`;
  const idx = await secGet(`${base}/index.json`);
  if (!idx.ok) throw new Error(`sec index ${idx.status}`);
  const items: Array<{ name: string }> = (await idx.json())?.directory?.item ?? [];
  const xmlName = items
    .map((x) => x.name)
    .find((n) => n.toLowerCase().endsWith('.xml') && !n.toLowerCase().includes('primary_doc'));
  if (!xmlName) return [];
  const xres = await secGet(`${base}/${xmlName}`);
  if (!xres.ok) throw new Error(`sec infotable ${xres.status}`);
  const x = await xres.text();

  const rows: Sec13fRow[] = [];
  const re = /<(?:\w+:)?infoTable>([\s\S]*?)<\/(?:\w+:)?infoTable>/g;
  for (const m of x.matchAll(re)) {
    const b = m[1];
    const g = (t: string) => {
      const mm = b.match(new RegExp(`<(?:\\w+:)?${t}>([^<]*)<`));
      return mm ? decodeXml(mm[1].trim()) : null;
    };
    const cusip = (g('cusip') ?? '').toUpperCase();
    if (!cusip) continue;
    rows.push({
      issuer: g('nameOfIssuer') ?? '',
      cusip,
      // מ-2023 SEC מדווח בדולרים (לא באלפים)
      value_usd: Number(g('value') ?? 0) || 0,
      shares: Number(g('sshPrnamt') ?? 0) || 0,
      put_call: g('putCall'),
    });
  }
  return rows;
}

/** CUSIP → טיקר: cache בטבלה, והשאר מ-OpenFIGI (US קודם, אחר כך בלי סינון בורסה) */
export async function mapCusipsToTickers(
  supabase: SupabaseClient,
  cusips: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = Array.from(new Set(cusips.filter(Boolean)));
  if (!uniq.length) return out;

  for (let i = 0; i < uniq.length; i += 500) {
    const { data } = await supabase
      .from('cusip_ticker_map')
      .select('cusip, ticker')
      .in('cusip', uniq.slice(i, i + 500));
    for (const r of data ?? []) if (r.ticker) out.set(String(r.cusip), String(r.ticker));
  }
  // «לא נמצא» שמור — לא מנסים שוב, חוץ מאלה שנבדקו בגרסה הישנה (בלי CINS) או לפני 30 יום
  const cachedNull = new Set<string>();
  {
    const retryBefore = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data } = await supabase
      .from('cusip_ticker_map')
      .select('cusip, source, updated_at')
      .in('cusip', uniq)
      .is('ticker', null);
    for (const r of data ?? []) {
      if (r.source === 'openfigi_v2' && String(r.updated_at ?? '') > retryBefore) cachedNull.add(String(r.cusip));
    }
  }
  const missing = uniq.filter((c) => !out.has(c) && !cachedNull.has(c));

  const key = Deno.env.get('OPENFIGI_API_KEY')?.trim();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['X-OPENFIGI-APIKEY'] = key;

  const lookup = async (batch: string[], exch: boolean) => {
    // CUSIP שמתחיל באות = CINS (חברה זרה: G קיימן/בריטניה, N הולנד, H שוויץ…) — מזהה אחר ב-OpenFIGI
    const jobs = batch.map((c) => ({
      idType: /^[A-Z]/.test(c) ? 'ID_CINS' : 'ID_CUSIP',
      idValue: c,
      ...(exch ? { exchCode: 'US' } : {}),
    }));
    const res = await fetch(OPENFIGI_URL, { method: 'POST', headers, body: JSON.stringify(jobs) });
    await sleep(key ? 300 : OPENFIGI_GAP_MS);
    if (!res.ok) throw new Error(`openfigi ${res.status}`);
    return (await res.json()) as Array<{ data?: Array<{ ticker?: string; name?: string; securityType?: string }> }>;
  };

  const rowsToCache: Array<Record<string, unknown>> = [];
  for (let i = 0; i < missing.length; i += 10) {
    const batch = missing.slice(i, i + 10);
    let res = await lookup(batch, true);
    const retry = batch.filter((_, j) => !res[j]?.data?.[0]?.ticker);
    let retryRes: Awaited<ReturnType<typeof lookup>> = [];
    if (retry.length) retryRes = await lookup(retry, false);
    batch.forEach((c, j) => {
      let d = res[j]?.data?.[0];
      if (!d?.ticker) {
        const k = retry.indexOf(c);
        d = k >= 0 ? retryRes[k]?.data?.[0] : undefined;
      }
      const ticker = d?.ticker ? String(d.ticker).toUpperCase() : null;
      if (ticker) out.set(c, ticker);
      rowsToCache.push({
        cusip: c,
        ticker,
        name: d?.name ?? null,
        security_type: d?.securityType ?? null,
        source: 'openfigi_v2',
        updated_at: new Date().toISOString(),
      });
    });
    res = [];
  }
  if (rowsToCache.length) {
    await supabase.from('cusip_ticker_map').upsert(rowsToCache, { onConflict: 'cusip' });
  }
  return out;
}

export interface Sec13fHolding {
  ticker: string;
  issuer_name: string;
  cusip: string;
  shares: number;
  value_usd: number;
  allocation_pct: number;
}

/**
 * אחזקות long בלבד (שורות Put/Call לא נספרות — אופציה ≠ אחזקה), מאוחדות לפי טיקר.
 * CUSIP בלי טיקר נשאר עם ה-CUSIP כמזהה (נדיר — ניירות זרים).
 */
export function aggregateSec13f(rows: Sec13fRow[], tickers: Map<string, string>): Sec13fHolding[] {
  const byTicker = new Map<string, Sec13fHolding>();
  for (const r of rows) {
    if (r.put_call) continue;
    const ticker = tickers.get(r.cusip) ?? r.cusip;
    const cur = byTicker.get(ticker) ?? {
      ticker,
      issuer_name: r.issuer,
      cusip: r.cusip,
      shares: 0,
      value_usd: 0,
      allocation_pct: 0,
    };
    cur.shares += r.shares;
    cur.value_usd += r.value_usd;
    byTicker.set(ticker, cur);
  }
  const list = Array.from(byTicker.values()).sort((a, b) => b.value_usd - a.value_usd);
  const total = list.reduce((s, h) => s + h.value_usd, 0);
  for (const h of list) h.allocation_pct = total > 0 ? Math.round((h.value_usd / total) * 1000) / 10 : 0;
  return list;
}
