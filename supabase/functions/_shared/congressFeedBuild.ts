/**
 * בניית שורות פיד קונגרס — Quiver (ברירת מחדל) או UW.
 */

import { parseTxnSide } from './congressPortfolio.ts';
import {
  dedupeCongressTrades,
  fetchUwCongressRecent,
  fetchUwCongressUnusualTrades,
  fetchUwPoliticians,
  fetchUwPoliticianTrades,
  fetchUwTradesForBioguides,
  mapUnusualTradeToCongress,
  uwCongressPersonName,
  type UwCongressTrade,
} from './unusualWhales.ts';
import {
  DEFAULT_HISTORY_TICKERS,
  fetchQuiverLiveCongressTrades,
  fetchQuiverTradesForBioguides,
  fetchQuiverTrumpStockTrades,
  getCongressTradesProvider,
  isQuiverEquityTrade,
  normalizeQuiverIsoDate,
  parseQuiverTxnSide,
  resolveCongressApiKey,
  resolveQuiverApiKey,
  CURATED_CONGRESS_BIOGUIDES,
  CURATED_EXECUTIVE_UW_IDS,
  TRUMP_DARKPOOL_PERSON_ID,
  type CongressTradesProvider,
  type QuiverCongressTrade,
  type QuiverPolitician,
  type QuiverTrumpStockTrade,
} from './quiverQuant.ts';
import type { CongressTradeRow } from './uwDbCache.ts';

/**
 * Quiver מחזיר את שדות התשואה כ-number, ולעיתים כ-string ("224.73%").
 * מחזיר אחוזים (24.11 = +24.11%). null = אין נתון — לעולם לא 0.
 */
function parseQuiverReturnPct(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(/%/g, '').replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const CONGRESS_PHOTO = 'https://unitedstates.github.io/images/congress/225x275';
const TRUMP_PHOTO =
  'https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg';
const BIOGUIDE_RE = /^[A-Z]\d{6}$/;

export async function buildCongressTradeRows(
  apiKey?: string,
  limit = 60,
  providerOverride?: CongressTradesProvider
): Promise<CongressTradeRow[]> {
  const provider = providerOverride ?? getCongressTradesProvider();
  const key = apiKey?.trim() || resolveCongressApiKey(provider);
  if (!key) {
    throw new Error(
      provider === 'quiverquant'
        ? 'QUIVER_API_KEY missing (set CONGRESS_TRADES_PROVIDER=quiverquant)'
        : 'UNUSUAL_WHALES_API_KEY missing'
    );
  }

  if (provider === 'quiverquant') {
    return buildFromQuiver(key, limit);
  }
  return buildFromUw(key, limit);
}

/**
 * היסטוריה עמוקה לפוליטיקאים מאוצרים (BioGuide).
 * מנסה Quiver; אם אין מפתח / ריק — UW עם מיפוי BioGuide↔UUID.
 */
export async function buildCuratedCongressHistoryRows(
  apiKey?: string,
  bioguides: string[] = CURATED_CONGRESS_BIOGUIDES,
  opts: {
    tickers?: string[];
    /** אופציונלי — historical לפי טיקרים אחרי bulk (ברירת מחדל כבוי) */
    enrichTickers?: boolean;
    includeChambers?: boolean;
    bulkMaxPages?: number;
    maxTickers?: number;
    rowLimit?: number;
  } = {}
): Promise<CongressTradeRow[]> {
  const quiverKey = apiKey?.trim() || resolveCongressApiKey('quiverquant');
  if (quiverKey) {
    try {
      const raw = await fetchQuiverTradesForBioguides(
        quiverKey,
        bioguides,
        opts.tickers ?? DEFAULT_HISTORY_TICKERS,
        {
          // מקור ראשי: bulk/congresstrading?bioguide_id= (עמוק)
          enrichTickers: opts.enrichTickers === true,
          includeChambers: opts.includeChambers === true,
          bulkMaxPages: opts.bulkMaxPages ?? 20,
          maxTickers: opts.maxTickers ?? 12,
          filterToBioguides: true,
        }
      );
      if (raw.length) {
        return quiverTradesToRows(raw, { limit: opts.rowLimit ?? 8000 });
      }
    } catch (e) {
      console.warn('curated quiver history', e);
    }
  }

  const uwKey = Deno.env.get('UNUSUAL_WHALES_API_KEY')?.trim() || '';
  if (!uwKey) {
    throw new Error('No Quiver/UW key available for curated congress history');
  }
  const { trades, bioMap } = await fetchUwTradesForBioguides(uwKey, bioguides, 400);
  if (!trades.length) return [];

  const out: CongressTradeRow[] = [];
  const seen = new Set<string>();
  for (const t of trades) {
    const row = uwToCongressRow(t, bioMap);
    if (!row || seen.has(row.external_id)) continue;
    seen.add(row.external_id);
    out.push(row);
  }
  return out;
}

/**
 * היסטוריה לפרופילים מאוצרים שאינם BioGuide (executive — Trump).
 * Quiver Trader: /beta/bulk/trumpstocktrades; גיבוי UW politician-portfolios.
 */
export async function buildCuratedExecutiveTradeRows(
  apiKey?: string,
  uwIds: string[] = CURATED_EXECUTIVE_UW_IDS
): Promise<CongressTradeRow[]> {
  const wantTrump = uwIds.some(
    (id) => String(id).trim() === TRUMP_DARKPOOL_PERSON_ID
  );
  const out: CongressTradeRow[] = [];
  const seen = new Set<string>();

  if (wantTrump) {
    // רק מפתח Quiver אמיתי — לא לבלבל עם UW key שנשלח כ־apiKey
    const quiverKey = resolveQuiverApiKey();
    if (quiverKey) {
      try {
        const trumpRows = await fetchQuiverTrumpStockTrades(quiverKey, {
          pageSize: 200,
          maxPages: 12,
        });
        for (const t of trumpRows) {
          const row = trumpTradeToCongressRow(t);
          if (!row || seen.has(row.external_id)) continue;
          seen.add(row.external_id);
          out.push(row);
        }
      } catch (e) {
        console.warn('curated quiver trump trades:', (e as Error).message);
      }
    }
  }

  if (out.length) return out;

  // גיבוי UW בלבד — לעולם לא לשלוח QUIVER_API_KEY ל־Unusual Whales
  const uwKey = Deno.env.get('UNUSUAL_WHALES_API_KEY')?.trim() || '';
  if (!uwKey || !uwIds.length) return out;

  const trades: UwCongressTrade[] = [];
  for (const id of uwIds) {
    const pid = String(id ?? '').trim();
    if (!pid || BIOGUIDE_RE.test(pid)) continue;
    try {
      const rows = await fetchUwPoliticianTrades(uwKey, pid, 500);
      for (const t of rows) {
        trades.push({
          ...t,
          politician_id: String(t.politician_id ?? pid).trim() || pid,
        });
      }
    } catch (e) {
      console.warn(`curated executive trades ${pid}:`, (e as Error).message);
    }
  }
  if (!trades.length) return out;

  const emptyBio = new Map<string, string>();
  for (const t of trades) {
    const row = uwToCongressRow(t, emptyBio);
    if (!row || seen.has(row.external_id)) continue;
    seen.add(row.external_id);
    out.push(row);
  }
  return out;
}

function trumpTradeToCongressRow(t: QuiverTrumpStockTrade): CongressTradeRow | null {
  const ticker = String(t.Ticker ?? '').toUpperCase().trim();
  const side = parseQuiverTxnSide(t.Transaction);
  if (!ticker || !side) return null;
  // Quiver docs: Traded = יום העסקה, Filed = יום הדיווח (מה שמוצג כ־«אחרון»)
  const txDate = normalizeQuiverIsoDate(t.Traded);
  const filed = normalizeQuiverIsoDate(t.Filed) || txDate;
  const day = txDate || filed;
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const amount_label = t.Amount?.trim() || null;
  const txnSlug = String(t.Transaction ?? side).replace(/\s+/g, '_').slice(0, 40);
  // נשמר פורמט id קיים (בלי Amount) כדי לא לשכפל שורות מול סנכרונים ישנים
  return {
    external_id: `quiver:trump:${ticker}:${day}:${side}:${txnSlug}`,
    politician_id: TRUMP_DARKPOOL_PERSON_ID,
    politician_name: 'Donald Trump',
    politician_image_url: TRUMP_PHOTO,
    ticker,
    company_name: t.Company?.trim() || null,
    transaction_type: side,
    shares: null,
    price: null,
    amount_label,
    filed_at: `${(filed || day)}T12:00:00Z`,
    transaction_date: day,
    txn_label: side === 'sell' ? 'מכירה' : 'רכישה',
    source: 'quiverquant',
    // trumpstocktrades מחזיר ExcessReturn בלבד — PriceChange/SPYChange לא בסכימה
    excess_return_pct: parseQuiverReturnPct(t.ExcessReturn),
    price_change_pct: null,
    spy_change_pct: null,
  };
}

async function buildFromQuiver(apiKey: string, limit: number): Promise<CongressTradeRow[]> {
  const raw = await fetchQuiverLiveCongressTrades(apiKey);
  const sorted = raw
    .filter(isQuiverEquityTrade)
    .sort((a, b) => {
      const da = String(a.ReportDate ?? a.TransactionDate ?? '');
      const db = String(b.ReportDate ?? b.TransactionDate ?? '');
      return db.localeCompare(da);
    })
    .slice(0, Math.min(400, Math.max(limit * 3, limit)));

  return quiverTradesToRows(sorted, { limit });
}

async function quiverTradesToRows(
  raw: QuiverCongressTrade[],
  opts: { limit: number }
): Promise<CongressTradeRow[]> {
  const sorted = raw
    .filter(isQuiverEquityTrade)
    .sort((a, b) => {
      const da = String(a.ReportDate ?? a.TransactionDate ?? '');
      const db = String(b.ReportDate ?? b.TransactionDate ?? '');
      return db.localeCompare(da);
    });

  const out: CongressTradeRow[] = [];
  const seenExt = new Set<string>();
  for (const t of sorted) {
    const row = quiverToCongressRow(t);
    if (!row || seenExt.has(row.external_id)) continue;
    seenExt.add(row.external_id);
    out.push(row);
    if (out.length >= opts.limit) break;
  }
  return out;
}

function quiverToCongressRow(t: QuiverCongressTrade): CongressTradeRow | null {
  const politician_id = String(t.BioGuideID ?? '').trim();
  const politician_name = String(t.Representative ?? '').trim() || 'פוליטיקאי';
  const ticker = String(t.Ticker ?? '').toUpperCase().trim();
  const side = parseQuiverTxnSide(t.Transaction);
  if (!ticker || !side) return null;

  const txDate = String(t.TransactionDate ?? '').slice(0, 10);
  const filed = String(t.ReportDate ?? t.last_modified ?? txDate).slice(0, 10);
  const day = (txDate || filed).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const amount_label = t.Range?.trim() || null;
  // Quiver/STOCK Act — טווח $ בלבד; לא לזייף shares/price כאילו מדווחים

  const politician_image_url = politician_id
    ? `${CONGRESS_PHOTO}/${politician_id}.jpg`
    : null;
  const txn_label = side === 'sell' ? 'מכירה' : 'רכישה';
  const txnSlug = String(t.Transaction ?? side).replace(/\s+/g, '_').slice(0, 40);
  const external_id = `quiver:${politician_id}:${ticker}:${day}:${side}:${txnSlug}`;

  return {
    external_id,
    politician_id: politician_id || external_id,
    politician_name,
    politician_image_url,
    ticker,
    company_name: t.Description?.trim() || null,
    transaction_type: side,
    shares: null,
    price: null,
    amount_label,
    filed_at: `${(filed || day)}T12:00:00Z`,
    transaction_date: day,
    txn_label,
    source: 'quiverquant',
    // חוזרים בכל קריאת congresstrading — אפס קריאות API נוספות
    excess_return_pct: parseQuiverReturnPct(t.ExcessReturn),
    price_change_pct: parseQuiverReturnPct(t.PriceChange),
    spy_change_pct: parseQuiverReturnPct(t.SPYChange),
  };
}

async function buildFromUw(apiKey: string, limit: number): Promise<CongressTradeRow[]> {
  const fetchCap = Math.min(300, Math.max(limit * 2, limit));
  const [politicians, recent, unusual] = await Promise.all([
    fetchUwPoliticians(apiKey, 36).catch(() => []),
    fetchUwCongressRecent(apiKey, fetchCap).catch(() => [] as UwCongressTrade[]),
    fetchUwCongressUnusualTrades(apiKey, { limit: Math.min(120, fetchCap) }).catch(() => []),
  ]);

  const bioMap = new Map<string, string>();
  for (const p of politicians) {
    const id = String(p.politician_id ?? p.id ?? '').trim();
    const bg = p.bioguide_id?.trim();
    if (id && bg) bioMap.set(id, bg);
  }

  const merged = dedupeCongressTrades([
    ...recent,
    ...unusual.map(mapUnusualTradeToCongress),
  ]);

  const sorted = merged
    .filter((t) => {
      const ticker = String(t.ticker ?? t.symbol ?? '').toUpperCase().trim();
      const side = parseTxnSide(t.txn_type);
      return ticker.length >= 1 && ticker.length <= 5 && side != null;
    })
    .sort((a, b) => {
      const da = String(a.filed_at_date ?? a.transaction_date ?? '');
      const db = String(b.filed_at_date ?? b.transaction_date ?? '');
      return db.localeCompare(da);
    })
    .slice(0, Math.min(400, Math.max(limit * 2, limit)));

  const out: CongressTradeRow[] = [];
  const seenExt = new Set<string>();
  for (const t of sorted) {
    const row = uwToCongressRow(t, bioMap);
    if (!row || seenExt.has(row.external_id)) continue;
    seenExt.add(row.external_id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

function uwToCongressRow(
  t: UwCongressTrade,
  bioMap: Map<string, string>
): CongressTradeRow | null {
  const politician_id = String(t.politician_id ?? '').trim();
  const politician_name = uwCongressPersonName(t) || 'פוליטיקאי';
  const ticker = String(t.ticker ?? t.symbol ?? '').toUpperCase().trim();
  const side = parseTxnSide(t.txn_type);
  if (!ticker || !side) return null;

  const txDate = String(t.transaction_date ?? t.filed_at_date ?? '').slice(0, 10);
  const filed = String(t.filed_at_date ?? t.transaction_date ?? txDate).slice(0, 10);
  // STOCK Act — טווחי $ בלבד; לא ממציאים shares/price

  const mappedBg = bioMap.get(politician_id);
  const stableId =
    mappedBg ||
    (BIOGUIDE_RE.test(politician_id) ? politician_id : politician_id) ||
    politician_id;
  const photoId = mappedBg || (BIOGUIDE_RE.test(stableId) ? stableId : null);
  const politician_image_url = photoId ? `${CONGRESS_PHOTO}/${photoId}.jpg` : null;
  const txn_label = side === 'sell' ? 'מכירה' : 'רכישה';
  const amountKey = (t.amounts?.trim() || 'na').replace(/\s+/g, '_').slice(0, 48);
  const external_id = `uw-congress:${stableId}:${ticker}:${txDate}:${side}:${amountKey}`;

  return {
    external_id,
    politician_id: stableId || external_id,
    politician_name,
    politician_image_url,
    ticker,
    company_name: t.issuer?.trim() || null,
    transaction_type: side,
    shares: null,
    price: null,
    amount_label: t.amounts?.trim() || null,
    filed_at: filed ? `${filed}T12:00:00Z` : new Date().toISOString(),
    transaction_date: txDate || filed,
    txn_label,
    source: 'unusualwhales',
    // UW לא מחזיר את שדות התשואה של Quiver
    excess_return_pct: null,
    price_change_pct: null,
    spy_change_pct: null,
  };
}

/**
 * ב-INSERT: מעדיפים Quiver ImageURL מה-cache היומי על ניחוש unitedstates.github.io.
 * לא דורסים פורטרט ידני/ויקי. לא כותבים לוגו טיקר כפנים.
 */
export function applyQuiverPoliticianImages(
  rows: CongressTradeRow[],
  politicians: QuiverPolitician[] | null | undefined
): CongressTradeRow[] {
  if (!rows.length || !politicians?.length) return rows;

  const byBg = new Map<string, string>();
  for (const p of politicians) {
    const bg = String(p.BioGuideID ?? '')
      .trim()
      .toUpperCase();
    const url = p.ImageURL?.trim();
    if (bg && url && looksLikePersonPhotoUrl(url)) byBg.set(bg, url);
  }
  if (!byBg.size) return rows;

  return rows.map((row) => {
    const quiver = byBg.get(String(row.politician_id ?? '').trim().toUpperCase());
    if (!quiver) return row;
    const current = row.politician_image_url?.trim() || null;
    if (current && !isGuessedCongressPhoto(current) && looksLikePersonPhotoUrl(current)) {
      return row;
    }
    if (current === quiver) return row;
    return { ...row, politician_image_url: quiver };
  });
}

function looksLikePersonPhotoUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes('transback.png')) return false;
  if (u.includes('brandfetch') || u.includes('/logo') || u.includes('clearbit')) {
    return false;
  }
  if (u.includes('uwassets') && (u.includes('/tickers') || u.includes('/logos'))) {
    return false;
  }
  return true;
}

function isGuessedCongressPhoto(url: string): boolean {
  return url.includes('unitedstates.github.io/images/congress');
}

export { getCongressTradesProvider, resolveCongressApiKey, type CongressTradesProvider };
