/**
 * Backfill Form 4 למנכ"לים מאוצרים — CIK מרoster החברה + transactions per insider.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';
import {
  fetchForm4CompanyInsiders,
  fetchForm4InsiderTransactions,
  type Form4Transaction,
  type NormalizedForm4Trade,
} from './form4api.ts';
import {
  CURATED_INSIDER_PINS,
  insiderNameMatchesPin,
  normalizeInsiderMatchName,
  tickersForCuratedInsider,
  type CuratedInsiderPin,
} from './curatedInsiderProfiles.ts';
import { upsertPortrait } from './personPortraits.ts';
import {
  fetchQuiverLiveInsiders,
  type QuiverInsiderRow,
} from './quiverQuant.ts';

export interface NormalizedInsiderBuyRow {
  external_id: string;
  ticker: string;
  company_name: string | null;
  insider_cik: string | null;
  insider_name: string | null;
  insider_role: string | null;
  transaction_type: 'P' | 'S' | 'A' | 'M' | 'G' | 'F' | 'O' | 'D';
  shares: number;
  price: number;
  value: number;
  filed_at: string;
  transaction_date: string;
  source: string;
  sector: string | null;
  is_sp500: boolean | null;
  marketcap: number | null;
  next_earnings_date: string | null;
  is_10b5_plan: boolean | null;
  shares_owned_after: number | null;
  return_1d: number | null;
  return_1w: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_6m: number | null;
}

/** כל קודי Form 4 הרלוונטיים לשחזור פוזיציה — לא רק P/S */
function mapCuratedForm4Transaction(r: Form4Transaction): NormalizedForm4Trade | null {
  if (!r.ticker || !r.transactionDate) return null;
  const code = (r.transactionCode || 'P').toUpperCase();
  const allowed = new Set(['P', 'S', 'A', 'M', 'F', 'G', 'J', 'C', 'D', 'X', 'I', 'O']);
  if (!allowed.has(code)) return null;
  const dbCode = coerceInsiderTransactionType(code);

  const shares = Number(r.sharesAmount) || 0;
  const price = r.pricePerShare != null ? Number(r.pricePerShare) : 0;
  const value =
    r.totalValue != null && Number.isFinite(Number(r.totalValue))
      ? Number(r.totalValue)
      : shares * price;
  if (shares <= 0 && code !== 'J') return null;

  const txDate = r.transactionDate.slice(0, 10);
  const filedAt = r.filedAt || r.transactionDate;
  const insiderCik = r.insiderCik?.trim() || null;
  const accession = r.accessionNumber?.trim();

  const external_id = accession
    ? `f4:${accession}:${insiderCik ?? 'na'}:${code}:${txDate}:${shares}:${price}`
    : `f4:${r.ticker}:${insiderCik ?? 'na'}:${code}:${txDate}:${shares}:${price}`;

  const roleParts: string[] = [];
  if (r.insiderTitle?.trim()) roleParts.push(r.insiderTitle.trim());
  else {
    if (r.isOfficer) roleParts.push('Officer');
    if (r.isDirector) roleParts.push('Director');
    if (r.is10PctOwner) roleParts.push('10% Owner');
  }

  return {
    external_id,
    ticker: r.ticker.toUpperCase(),
    company_name: r.companyName?.trim() || null,
    insider_cik: insiderCik,
    insider_name: r.insiderName ?? null,
    insider_role: roleParts.join(' · ') || null,
    transaction_type: dbCode,
    shares,
    price,
    value,
    filed_at: filedAt,
    transaction_date: txDate,
    source: 'form4api',
    sector: null,
    is_10b5_plan: r.is10b5Plan ?? null,
    shares_owned_after: r.sharesOwnedAfter != null ? Number(r.sharesOwnedAfter) : null,
    return_1d: r.return1d ?? null,
    return_1w: r.return1w ?? null,
    return_1m: r.return1m ?? null,
    return_3m: r.return3m ?? null,
    return_6m: r.return6m ?? null,
  };
}

function form4TradeToInsiderRow(
  t: NormalizedForm4Trade,
  pin: CuratedInsiderPin
): NormalizedInsiderBuyRow {
  return {
    external_id: t.external_id,
    ticker: t.ticker,
    company_name: t.company_name,
    insider_cik: t.insider_cik,
    insider_name: pin.form4NameExact,
    insider_role: t.insider_role,
    transaction_type: t.transaction_type,
    shares: t.shares,
    price: t.price,
    value: t.value,
    filed_at: t.filed_at,
    transaction_date: t.transaction_date,
    source: t.source,
    sector: t.sector,
    is_sp500: null,
    marketcap: null,
    next_earnings_date: null,
    is_10b5_plan: t.is_10b5_plan,
    shares_owned_after: t.shares_owned_after,
    return_1d: t.return_1d,
    return_1w: t.return_1w,
    return_1m: t.return_1m,
    return_3m: t.return_3m,
    return_6m: t.return_6m,
  };
}

function resolveInsiderCik(
  pin: CuratedInsiderPin,
  roster: Array<{ cik?: string; name?: string }>
): string | null {
  const exact = normalizeInsiderMatchName(pin.form4NameExact);
  for (const row of roster) {
    const name = String(row.name ?? '').trim();
    if (!name) continue;
    if (normalizeInsiderMatchName(name) === exact) {
      const cik = String(row.cik ?? '').replace(/\D/g, '');
      if (cik) return cik.padStart(10, '0');
    }
  }
  return null;
}

function txAllowedForPin(pin: CuratedInsiderPin, ticker: string): boolean {
  return tickersForCuratedInsider(pin).includes(ticker.toUpperCase());
}

function mapCuratedQuiverRow(
  r: QuiverInsiderRow,
  pin: CuratedInsiderPin
): NormalizedInsiderBuyRow | null {
  const ticker = String(r.Ticker ?? '')
    .trim()
    .toUpperCase();
  if (!tickersForCuratedInsider(pin).includes(ticker)) return null;

  const rawName = String(r.Name ?? '').trim();
  if (!insiderNameMatchesPin(pin, rawName)) {
    return null;
  }

  const txDate = String(r.TransactionDate ?? r.Date ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(txDate)) return null;

  const code = String(r.TransactionCode || 'P').toUpperCase();
  const shares = Math.abs(Number(r.Shares) || 0);
  if (shares <= 0 && code !== 'J') return null;

  const price = Number(r.PricePerShare) || 0;
  const filed = String(r.fileDate ?? r.Date ?? txDate).slice(0, 10);
  const ownedAfter = Number(r.SharesOwnedFollowing);

  return {
    external_id: r.AccessionNumber
      ? `quiver:${r.AccessionNumber}:${ticker}:${txDate}:${code}:${shares}`
      : `quiver:${ticker}:${txDate}:${pin.form4NameExact.replace(/\s+/g, '_')}:${code}:${shares}:${price}`,
    ticker,
    company_name: null,
    insider_cik: null,
    insider_name: pin.form4NameExact,
    insider_role: r.officerTitle ?? r.Title ?? null,
    transaction_type: coerceInsiderTransactionType(code),
    shares,
    price,
    value: Math.round(shares * price * 100) / 100,
    filed_at: filed ? `${filed.slice(0, 10)}T12:00:00Z` : new Date().toISOString(),
    transaction_date: txDate,
    source: 'quiverquant',
    sector: null,
    is_sp500: null,
    marketcap: null,
    next_earnings_date: null,
    is_10b5_plan: null,
    shares_owned_after: Number.isFinite(ownedAfter) ? ownedAfter : null,
    return_1d: null,
    return_1w: null,
    return_1m: null,
    return_3m: null,
    return_6m: null,
  };
}

async function syncCuratedFromQuiver(
  pin: CuratedInsiderPin,
  quiverKey: string
): Promise<NormalizedInsiderBuyRow[]> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 5);
  const sinceDate = since.toISOString().slice(0, 10);
  const out: NormalizedInsiderBuyRow[] = [];

  for (const sym of tickersForCuratedInsider(pin)) {
    const raw = await fetchQuiverLiveInsiders(quiverKey, {
      ticker: sym,
      dateFrom: sinceDate,
      maxUploadedDays: 21,
      pageSize: 500,
      maxRows: 2500,
    });
    for (const row of raw) {
      if (String(row.Date ?? '').slice(0, 10) < sinceDate) continue;
      const mapped = mapCuratedQuiverRow(row, pin);
      if (mapped) out.push(mapped);
    }
    await delay(120);
  }

  return out;
}

export async function syncCuratedInsiderForm4Backfill(
  supabase: SupabaseClient,
  opts: {
    form4ApiKey?: string;
    quiverKey?: string;
    historyYears?: number;
    maxPages?: number;
  } = {}
): Promise<{ rows: number; portraits: number; errors: string[] }> {
  const form4ApiKey = opts.form4ApiKey?.trim();
  const quiverKey = opts.quiverKey?.trim();
  const historyYears = Math.min(8, Math.max(2, opts.historyYears ?? 5));
  const maxPages = Math.min(30, Math.max(5, opts.maxPages ?? 20));
  const from = new Date();
  from.setFullYear(from.getFullYear() - historyYears);
  const fromIso = from.toISOString().slice(0, 10);

  const out: NormalizedInsiderBuyRow[] = [];
  const errors: string[] = [];
  let portraits = 0;

  for (const pin of CURATED_INSIDER_PINS) {
    try {
      await upsertPortrait(supabase, {
        person_id: pin.personId,
        kind: 'insider',
        display_name: pin.displayName,
        ticker: pin.ticker,
        image_url: pin.imageUrl,
        source: 'known',
        lookup_name: pin.displayName,
        fail_count: 0,
        last_error: null,
      });
      portraits += 1;

      let form4Rows = 0;
      if (form4ApiKey) {
        let cik = pin.insiderCik.replace(/\D/g, '').padStart(10, '0');
        if (!cik || cik === '0000000000') {
          const roster = await fetchForm4CompanyInsiders(form4ApiKey, pin.ticker);
          cik = resolveInsiderCik(pin, roster) ?? '';
          if (!cik && pin.altTickers?.length) {
            for (const alt of pin.altTickers) {
              const altRoster = await fetchForm4CompanyInsiders(form4ApiKey, alt);
              cik = resolveInsiderCik(pin, altRoster) ?? '';
              if (cik) break;
            }
          }
        }
        if (cik) {
          const txs = await fetchForm4InsiderTransactions(form4ApiKey, cik, {
            from: fromIso,
            maxPages,
          });
          for (const raw of txs) {
            const mapped = mapCuratedForm4Transaction(raw);
            if (!mapped) continue;
            if (!txAllowedForPin(pin, mapped.ticker)) continue;
            out.push(form4TradeToInsiderRow({ ...mapped, insider_cik: cik }, pin));
            form4Rows += 1;
          }
        } else {
          errors.push(`${pin.personId}: no insider CIK`);
        }
      }

      if (quiverKey && form4Rows === 0) {
        out.push(...(await syncCuratedFromQuiver(pin, quiverKey)));
      }

      await delay(100);
    } catch (e) {
      errors.push(`${pin.personId}: ${(e as Error).message}`);
    }
  }

  const deduped = dedupeInsiderRows(out);

  if (deduped.length) {
    const { error } = await supabase
      .from('dark_pool_insider_buys')
      .upsert(deduped, { onConflict: 'source,external_id' });
    if (error) throw error;
  }

  return { rows: deduped.length, portraits, errors };
}

function coerceInsiderTransactionType(
  code: string
): NormalizedInsiderBuyRow['transaction_type'] {
  const c = code.toUpperCase();
  if (c === 'P' || c === 'S' || c === 'A' || c === 'M' || c === 'F' || c === 'G' || c === 'O' || c === 'D') {
    return c;
  }
  if (c === 'J' || c === 'C' || c === 'X' || c === 'I') return 'A';
  return 'A';
}

function dedupeInsiderRows(rows: NormalizedInsiderBuyRow[]): NormalizedInsiderBuyRow[] {
  const map = new Map<string, NormalizedInsiderBuyRow>();
  for (const row of rows) {
    map.set(`${row.source}:${row.external_id}`, row);
  }
  return Array.from(map.values());
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
