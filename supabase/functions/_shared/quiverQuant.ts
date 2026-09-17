/**
 * Quiver Quantitative REST client — קונגרס (Trader) + insiders/13F כשזמין.
 *
 * אין webhooks לפידים האלה ב־Trader — רק REST pull דרך pg_cron.
 * תדירויות ו־«למה לא realtime»: docs/DARK_POOL_DATA_SYNC.md
 *
 * Secrets (Supabase Dashboard → Edge Functions → Secrets, או CLI):
 *   QUIVER_API_KEY          — חובה ל-Quiver (אל תדביקו מפתח בצ'אט)
 *   CONGRESS_TRADES_PROVIDER=quiverquant|unusualwhales  (ברירת מחדל: quiverquant)
 *
 * Endpoints בשימוש (Trader):
 *   /beta/live/congresstrading
 *   /beta/bulk/congresstrading?bioguide_id=
 *   /beta/historical/congresstrading/{ticker}
 *   /beta/historical/housetrading/{ticker}
 *   /beta/historical/senatetrading/{ticker}
 *   /beta/bulk/trumpstocktrades
 *   /beta/live/offexchange (+ /beta/historical/offexchange/{ticker})
 *   /beta/live/insiders
 *   /beta/live/sec13f?owner=
 *   /beta/live/sec13fchanges
 *   /beta/bulk/congress/politicians
 *   /beta/live/congress_stock_holdings
 */

const QUIVER_BASE = 'https://api.quiverquant.com';

export const QUIVER_POLITICIANS_CACHE_KEY = 'quiver_congress_politicians';
export const QUIVER_HOLDINGS_CACHE_KEY = 'quiver_congress_holdings';
/** James: רשימת פוליטיקאים — cache יומי, לא בכל hit */
export const QUIVER_POLITICIANS_FRESH_MS = 24 * 60 * 60 * 1000;
export const QUIVER_HOLDINGS_FRESH_MS = 24 * 60 * 60 * 1000;

export const TRUMP_DARKPOOL_PERSON_ID =
  '888dc73f-f1eb-485a-a241-80657aaaaff9';

export type CongressTradesProvider = 'quiverquant' | 'unusualwhales';

export interface QuiverCongressTrade {
  Representative?: string;
  BioGuideID?: string;
  ReportDate?: string;
  TransactionDate?: string;
  /** SenateTrade — שם הסנאטור (במקום Representative) */
  Senator?: string;
  /** HouseTrade / SenateTrade — תאריך העסקה (במקום TransactionDate) */
  Date?: string;
  Ticker?: string;
  Transaction?: string;
  Range?: string;
  House?: string;
  Amount?: string;
  Party?: string;
  last_modified?: string;
  TickerType?: string;
  Description?: string | null;
  ExcessReturn?: number | null;
  PriceChange?: number | null;
  SPYChange?: number | null;
  /** V2 fields — CongressionalTradeV2 ב-schema.json */
  Name?: string;
  Filed?: string;
  Traded?: string;
  Trade_Size_USD?: string;
  Company?: string;
  Chamber?: string;
}

export interface QuiverPolitician {
  Name?: string;
  BioGuideID?: string;
  CandidateID?: string;
  Party?: string;
  Chamber?: string;
  House?: string;
  TradeCount?: number;
  TradeVolume?: number;
  NetWorth?: number;
  'Net Worth'?: number;
  LastTraded?: string;
  State?: string;
  ImageURL?: string;
}

export interface QuiverCongressStockHolding {
  BioGuideID?: string;
  Name?: string;
  Ticker?: string;
  CurrentHolding?: number | string;
  Allocation?: number | string;
}

export interface QuiverTrumpStockTrade {
  Ticker?: string;
  Company?: string;
  Transaction?: string;
  Amount?: string;
  Filed?: string;
  Traded?: string;
  /** Quiver docs: string כמו "224.73%" או מספר */
  ExcessReturn?: string | number | null;
}

/** Off-exchange / dark-pool intensity (יומי — לא prints בודדים כמו UW) */
export interface QuiverOffExchangeRow {
  Ticker?: string;
  Date?: string;
  OTC_Short?: number;
  OTC_Total?: number;
  DPI?: number;
}

export interface QuiverInsiderRow {
  Ticker?: string;
  Date?: string;
  Name?: string;
  AcquiredDisposedCode?: string;
  TransactionCode?: string;
  Shares?: number;
  PricePerShare?: number;
  SharesOwnedFollowing?: number;
  fileDate?: string;
  officerTitle?: string;
  Title?: string;
  AccessionNumber?: string;
  TransactionDate?: string;
  isDirector?: boolean;
  isOfficer?: boolean;
  directOrIndirectOwnership?: string;
}

export interface QuiverSec13fHolding {
  Ticker?: string;
  Company?: string;
  Name?: string;
  Shares?: number | string;
  Value?: number | string;
  Weight?: number | string;
  CUSIP?: string;
  Owner?: string;
  Fund?: string;
  /** Live sec13f / changes — shares held */
  Held?: number | string;
  Held_Normalized?: number | string;
  Close?: number | string;
  ReportDate?: string;
  FilingDate?: string;
  Date?: string;
  ReportPeriod?: string;
  PutCall?: string;
  Class?: string;
  Direction?: string;
}

/**
 * Live SEC 13F changes — docs fields:
 * Date, ReportPeriod, Ticker, Fund, Change, Change_Share, Change_Pct,
 * Held, Held_Normalized, Close (+ legacy Owner/Shares/Value aliases).
 */
export interface QuiverSec13fChange {
  Ticker?: string;
  Company?: string;
  Owner?: string;
  Fund?: string;
  Shares?: number | string;
  Value?: number | string;
  Held?: number | string;
  Held_Normalized?: number | string;
  Close?: number | string;
  Change?: number | string;
  Change_Share?: number | string;
  Change_Pct?: number | string;
  ChangePercent?: number | string;
  Action?: string;
  ReportDate?: string;
  FilingDate?: string;
  Date?: string;
  ReportPeriod?: string;
  CUSIP?: string;
  period?: string | number;
}

export interface QuiverSec13fChangesOpts {
  owner?: string;
  ticker?: string;
  period?: string | number;
  mostRecent?: boolean;
  page?: number;
  pageSize?: number;
  maxRows?: number;
}

export interface QuiverSec13fByOwnerOpts {
  /**
   * @deprecated `most_recent` מתועד ב-schema.json רק ל-/beta/live/sec13fchanges
   * ולא ל-/beta/live/sec13f — לכן הוא לא נשלח יותר כאן. צימוד לתקופה האחרונה
   * נעשה בצד הצרכן (`quiverHoldingsToFiling` ב-sync-fund-13f), או דרך `period`.
   */
  mostRecent?: boolean;
  /** `period` מהדוקס — תקופת דיווח (YYYYMMDD; ISO מתורגם אוטומטית) */
  period?: string | number;
  page?: number;
  pageSize?: number;
  maxRows?: number;
}

/** CIK → שם owner ל-Quiver sec13f / sec13fchanges (סדר = עדיפות ניסוי) */
export const CURATED_FUND_QUIVER_OWNERS: Record<
  string,
  { owner: string; owners: string[]; name: string; manager: string }
> = {
  '1067983': {
    owner: 'BERKSHIRE HATHAWAY INC',
    owners: [
      'BERKSHIRE HATHAWAY INC',
      'Berkshire Hathaway Inc',
      'Berkshire Hathaway',
    ],
    name: 'Berkshire Hathaway Inc',
    manager: 'Warren Buffett',
  },
  '1697748': {
    owner: 'ARK Investment Management LLC',
    owners: ['ARK Investment Management LLC', 'ARK Investment Management', 'ARK Invest'],
    name: 'ARK Investment Management LLC',
    manager: 'Cathie Wood',
  },
  '1336528': {
    owner: 'Pershing Square Capital Management, L.P.',
    owners: [
      'Pershing Square Capital Management, L.P.',
      'Pershing Square Capital Management L.P.',
      'PERSHING SQUARE CAPITAL MANAGEMENT, L.P.',
      'PERSHING SQUARE CAPITAL MANAGEMENT L.P.',
      'Pershing Square Capital Management LP',
      'Pershing Square Capital Management',
      'Pershing Square',
    ],
    name: 'Pershing Square Capital Management LP',
    manager: 'Bill Ackman',
  },
};

export interface QuiverPoliticiansCachePayload {
  politicians: QuiverPolitician[];
  synced_at: string;
  count: number;
  /** Top by TradeCount — לבחירת פרופילים מעניינים */
  top_by_trade_count?: Array<{
    BioGuideID?: string;
    Name?: string;
    TradeCount: number;
    Party?: string;
    Chamber?: string;
    LastTraded?: string;
  }>;
  curated_bioguides?: string[];
}

export interface QuiverHoldingsCachePayload {
  by_bioguide: Record<string, QuiverCongressStockHolding[]>;
  synced_at: string;
}

function quiverHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  };
}

function unwrapQuiverList<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as T[];
    if (Array.isArray(o.results)) return o.results as T[];
  }
  return [];
}

async function quiverGetJson<T>(
  apiKey: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const url = new URL(`${QUIVER_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), { headers: quiverHeaders(apiKey) });
  if (!res.ok) {
    const body = await res.text();
    const snippet = body.includes('<!')
      ? `HTTP ${res.status}`
      : body.slice(0, 80).replace(/\s+/g, ' ').trim();
    throw new Error(`quiver ${path} ${res.status}${snippet ? `: ${snippet}` : ''}`);
  }
  return (await res.json()) as T;
}

export function getCongressTradesProvider(): CongressTradesProvider {
  const raw = (Deno.env.get('CONGRESS_TRADES_PROVIDER') || 'quiverquant').toLowerCase();
  return raw === 'unusualwhales' ? 'unusualwhales' : 'quiverquant';
}

export function resolveQuiverApiKey(): string {
  return (
    Deno.env.get('QUIVER_API_KEY')?.trim() ||
    Deno.env.get('QUIVERQUANT_API_KEY')?.trim() ||
    Deno.env.get('FORM4_API_KEY')?.trim() ||
    ''
  );
}

export function resolveCongressApiKey(
  provider: CongressTradesProvider = getCongressTradesProvider()
): string {
  if (provider === 'quiverquant') return resolveQuiverApiKey();
  return Deno.env.get('UNUSUAL_WHALES_API_KEY')?.trim() || '';
}

/** עסקאות קונגרס אחרונות — GET /beta/live/congresstrading */
export async function fetchQuiverLiveCongressTrades(
  apiKey: string
): Promise<QuiverCongressTrade[]> {
  const json = await quiverGetJson<unknown>(apiKey, '/beta/live/congresstrading');
  return unwrapQuiverList<QuiverCongressTrade>(json).map(normalizeCongressTrade);
}

/** היסטוריה לפי טיקר — GET /beta/historical/congresstrading/{ticker} */
export async function fetchQuiverHistoricalCongressByTicker(
  apiKey: string,
  ticker: string
): Promise<QuiverCongressTrade[]> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return [];
  const json = await quiverGetJson<unknown>(
    apiKey,
    `/beta/historical/congresstrading/${encodeURIComponent(sym)}`
  );
  return unwrapQuiverList<QuiverCongressTrade>(json).map(normalizeCongressTrade);
}

/**
 * היסטוריה מלאה לפי BioGuide — GET /beta/bulk/congresstrading?bioguide_id=
 * Trader: page + page_size + bioguide_id (חובה לפרופיל עמוק).
 * עדיף על historical-by-ticker לפרופילים; historical משלים לפי טיקר לפיד/מסכי טיקר.
 */
export async function fetchQuiverBulkCongressTradesByBioguide(
  apiKey: string,
  bioguideId: string,
  opts: { pageSize?: number; maxPages?: number } = {}
): Promise<QuiverCongressTrade[]> {
  const bg = bioguideId.trim().toUpperCase();
  if (!/^[A-Z]\d{6}$/.test(bg)) return [];

  const pageSize = Math.min(200, Math.max(20, opts.pageSize ?? 100));
  const maxPages = Math.min(25, Math.max(1, opts.maxPages ?? 20));
  const out: QuiverCongressTrade[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const json = await quiverGetJson<unknown>(apiKey, '/beta/bulk/congresstrading', {
      bioguide_id: bg,
      page,
      page_size: pageSize,
      version: 'V1',
    });
    const batch = unwrapQuiverList<QuiverCongressTrade>(json).map(normalizeCongressTrade);
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < pageSize) break;
    await delay(100);
  }
  return out;
}

/**
 * היסטוריה לפי כמה טיקרים — GET /beta/historical/congresstrading/{ticker}
 * שימושי להעשרת פיד + מסכי טיקר (לא תחליף מלא ל-bulk לפי BioGuide).
 */
export async function fetchQuiverHistoricalCongressForTickers(
  apiKey: string,
  tickers: string[],
  opts: { delayMs?: number; maxTickers?: number } = {}
): Promise<QuiverCongressTrade[]> {
  const maxTickers = Math.min(40, Math.max(1, opts.maxTickers ?? 20));
  const delayMs = Math.min(400, Math.max(40, opts.delayMs ?? 80));
  const want = Array.from(
    new Set(
      tickers
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z][A-Z0-9.]{0,5}$/.test(t))
    )
  ).slice(0, maxTickers);

  const out: QuiverCongressTrade[] = [];
  for (const ticker of want) {
    try {
      const rows = await fetchQuiverHistoricalCongressByTicker(apiKey, ticker);
      out.push(...rows);
      await delay(delayMs);
    } catch (e) {
      console.warn(`quiver historical congress ${ticker}:`, (e as Error).message);
    }
  }
  return out;
}

/**
 * דירוג פוליטיקאים לפי TradeCount (מ־/beta/bulk/congress/politicians).
 */
export function rankPoliticiansByTradeCount(
  politicians: QuiverPolitician[],
  limit = 40
): QuiverPolitician[] {
  const n = Math.min(200, Math.max(1, limit));
  return [...politicians]
    .filter((p) => {
      const bg = String(p.BioGuideID ?? '')
        .trim()
        .toUpperCase();
      return /^[A-Z]\d{6}$/.test(bg);
    })
    .sort((a, b) => (Number(b.TradeCount ?? 0) || 0) - (Number(a.TradeCount ?? 0) || 0))
    .slice(0, n);
}

/**
 * מאוצרים + סוחרים פעילים מה-cache של politicians (TradeCount).
 */
export function mergeBioguidesWithTopActive(
  curated: string[],
  politicians: QuiverPolitician[],
  topN = 40
): string[] {
  const out = new Set(
    curated.map((b) => b.trim().toUpperCase()).filter((b) => /^[A-Z]\d{6}$/.test(b))
  );
  const ranked = rankPoliticiansByTradeCount(politicians, Math.max(topN * 2, topN));
  for (const p of ranked) {
    const bg = String(p.BioGuideID ?? '')
      .trim()
      .toUpperCase();
    out.add(bg);
    if (out.size >= curated.length + topN) break;
  }
  return Array.from(out);
}

/** טיקרים נפוצים מעסקאות bulk — להעשרה אופציונלית ב־historical/*trading */
export function topTickersFromCongressTrades(
  rows: QuiverCongressTrade[],
  limit = 12
): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const t = String(row.Ticker ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z][A-Z0-9.]{0,5}$/.test(t)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.min(40, Math.max(1, limit)))
    .map(([t]) => t);
}

/**
 * היסטוריה לפוליטיקאים — מקור ראשי: bulk לפי BioGuide.
 * אופציונלי: historical/congresstrading (+ house/senate) לפי טיקרים.
 */
export async function fetchQuiverTradesForBioguides(
  apiKey: string,
  bioguides: string[],
  tickers: string[] = DEFAULT_HISTORY_TICKERS,
  opts: {
    bulkMaxPages?: number;
    enrichTickers?: boolean;
    maxTickers?: number;
    /** house+senate historical — יקר ב-rate; ברירת מחדל false */
    includeChambers?: boolean;
    /** אם false — לא מסננים ל-want בלבד (שימושי להעשרת פיד לפי טיקר) */
    filterToBioguides?: boolean;
  } = {}
): Promise<QuiverCongressTrade[]> {
  const want = Array.from(
    new Set(
      bioguides.map((b) => b.trim().toUpperCase()).filter((b) => /^[A-Z]\d{6}$/.test(b))
    )
  );
  if (!want.length && opts.filterToBioguides !== false) return [];

  const merged: QuiverCongressTrade[] = [];
  try {
    const live = await fetchQuiverLiveCongressTrades(apiKey);
    merged.push(...live);
  } catch (e) {
    console.warn('quiver live congress:', (e as Error).message);
  }

  // Person history: /beta/bulk/congresstrading?bioguide_id= (עמודים עמוקים)
  const bulkMaxPages = Math.min(25, Math.max(4, opts.bulkMaxPages ?? 20));
  const bulkRows: QuiverCongressTrade[] = [];
  for (const bg of want) {
    try {
      const hist = await fetchQuiverBulkCongressTradesByBioguide(apiKey, bg, {
        pageSize: 100,
        maxPages: bulkMaxPages,
      });
      bulkRows.push(...hist);
      merged.push(...hist);
      await delay(120);
    } catch (e) {
      console.warn(`quiver bulk congress ${bg}:`, (e as Error).message);
    }
  }

  // Ticker history (אופציונלי): historical/congresstrading|house|senate
  // עדיפות לטיקרים שכבר הופיעו ב-bulk של המאוצרים — לא DEFAULT מלא.
  const enrich = opts.enrichTickers === true;
  if (enrich) {
    const fromBulk = topTickersFromCongressTrades(bulkRows, opts.maxTickers ?? 12);
    const explicit = (tickers?.length ? tickers : []).map((t) => t.trim().toUpperCase());
    const tickerList = Array.from(new Set([...fromBulk, ...explicit])).slice(
      0,
      opts.maxTickers ?? 12
    );
    if (tickerList.length) {
      try {
        const byTicker = await fetchQuiverChamberHistoryForTickers(apiKey, tickerList, {
          maxTickers: opts.maxTickers ?? 12,
          includeChambers: opts.includeChambers === true,
        });
        merged.push(...byTicker);
      } catch (e) {
        console.warn('quiver chamber historical tickers:', (e as Error).message);
      }
    }
  }

  const wantSet = new Set(want);
  const filterBg = opts.filterToBioguides !== false && want.length > 0;
  const out: QuiverCongressTrade[] = [];
  const seen = new Set<string>();
  for (const row of merged) {
    const bg = String(row.BioGuideID ?? '')
      .trim()
      .toUpperCase();
    if (filterBg && !wantSet.has(bg)) continue;
    if (!isQuiverEquityTrade(row)) continue;
    const key = [
      bg,
      String(row.Ticker ?? '').toUpperCase(),
      String(row.TransactionDate ?? '').slice(0, 10),
      String(row.Transaction ?? ''),
      String(row.Range ?? row.Amount ?? ''),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** אחזקות מוערכות — GET /beta/live/congress_stock_holdings */
export async function fetchQuiverCongressStockHoldings(
  apiKey: string,
  opts: { bioguideId?: string; ticker?: string } = {}
): Promise<QuiverCongressStockHolding[]> {
  const json = await quiverGetJson<unknown>(apiKey, '/beta/live/congress_stock_holdings', {
    bioguide_id: opts.bioguideId?.trim() || undefined,
    ticker: opts.ticker?.trim().toUpperCase() || undefined,
    sort_by_holding: true,
  });
  return unwrapQuiverList<QuiverCongressStockHolding>(json);
}

/**
 * תאריך Quiver → YYYY-MM-DD (Filed / Traded / ReportDate).
 * תומך ב־ISO וב־MM/DD/YYYY מהדוקס.
 */
export function normalizeQuiverIsoDate(raw?: string | null): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const mm = mdy[1].padStart(2, '0');
    const dd = mdy[2].padStart(2, '0');
    return `${mdy[3]}-${mm}-${dd}`;
  }
  const t = Date.parse(s);
  if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

/**
 * פרמטר תאריך ל-Quiver → YYYYMMDD.
 * schema.json מתעד את הפורמט הזה לכל פרמטרי התאריך (`date`, `uploaded`,
 * `date_from`, `date_to`); `period` חולק את אותו `type: string, format: date`.
 */
export function formatQuiverDateParam(
  raw?: string | number | null
): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  if (/^\d{8}$/.test(s)) return s;
  const iso = normalizeQuiverIsoDate(s);
  return iso ? iso.replace(/-/g, '') : undefined;
}

/**
 * עסקאות טראמפ — GET /beta/bulk/trumpstocktrades
 * Paginated (page, page_size) כמו בדוקס Quiver.
 * אין bioguide — מזהה פנימי ב-DB: TRUMP_DARKPOOL_PERSON_ID.
 * ממוין לפי Filed (חדש→ישן) כדי ש«אחרונות» יתאימו לדוקס.
 */
export async function fetchQuiverTrumpStockTrades(
  apiKey: string,
  opts: { pageSize?: number; maxPages?: number } = {}
): Promise<QuiverTrumpStockTrade[]> {
  const pageSize = Math.min(200, Math.max(20, opts.pageSize ?? 200));
  const maxPages = Math.min(20, Math.max(1, opts.maxPages ?? 12));
  const out: QuiverTrumpStockTrade[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const json = await quiverGetJson<unknown>(apiKey, '/beta/bulk/trumpstocktrades', {
      page,
      page_size: pageSize,
    });
    const batch = unwrapQuiverList<QuiverTrumpStockTrade>(json);
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < pageSize) break;
    await delay(100);
  }
  // גיבוי: חלק מהתוכניות מחזירות מערך מלא בלי pagination
  if (!out.length) {
    const json = await quiverGetJson<unknown>(apiKey, '/beta/bulk/trumpstocktrades');
    out.push(...unwrapQuiverList<QuiverTrumpStockTrade>(json));
  }
  return out.sort((a, b) => {
    const fa =
      normalizeQuiverIsoDate(String(b.Filed ?? '')) ||
      normalizeQuiverIsoDate(String(b.Traded ?? '')) ||
      '';
    const fb =
      normalizeQuiverIsoDate(String(a.Filed ?? '')) ||
      normalizeQuiverIsoDate(String(a.Traded ?? '')) ||
      '';
    return fa.localeCompare(fb);
  });
}

/** House לפי טיקר — GET /beta/historical/housetrading/{ticker} */
export async function fetchQuiverHistoricalHouseByTicker(
  apiKey: string,
  ticker: string
): Promise<QuiverCongressTrade[]> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return [];
  const json = await quiverGetJson<unknown>(
    apiKey,
    `/beta/historical/housetrading/${encodeURIComponent(sym)}`
  );
  return unwrapQuiverList<QuiverCongressTrade>(json).map(normalizeCongressTrade);
}

/** Senate לפי טיקר — GET /beta/historical/senatetrading/{ticker} */
export async function fetchQuiverHistoricalSenateByTicker(
  apiKey: string,
  ticker: string
): Promise<QuiverCongressTrade[]> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return [];
  const json = await quiverGetJson<unknown>(
    apiKey,
    `/beta/historical/senatetrading/${encodeURIComponent(sym)}`
  );
  return unwrapQuiverList<QuiverCongressTrade>(json).map(normalizeCongressTrade);
}

/**
 * העשרת היסטוריית קונגרס לפי טיקר: congress + house + senate.
 */
export async function fetchQuiverChamberHistoryForTickers(
  apiKey: string,
  tickers: string[],
  opts: { maxTickers?: number; includeChambers?: boolean } = {}
): Promise<QuiverCongressTrade[]> {
  const maxTickers = Math.min(30, Math.max(1, opts.maxTickers ?? 16));
  const includeChambers = opts.includeChambers !== false;
  const want = Array.from(
    new Set(
      tickers
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z][A-Z0-9.]{0,5}$/.test(t))
    )
  ).slice(0, maxTickers);

  const out: QuiverCongressTrade[] = [];
  for (const ticker of want) {
    try {
      out.push(...(await fetchQuiverHistoricalCongressByTicker(apiKey, ticker)));
    } catch (e) {
      console.warn(`quiver hist congress ${ticker}:`, (e as Error).message);
    }
    if (includeChambers) {
      try {
        out.push(...(await fetchQuiverHistoricalHouseByTicker(apiKey, ticker)));
      } catch (e) {
        console.warn(`quiver hist house ${ticker}:`, (e as Error).message);
      }
      try {
        out.push(...(await fetchQuiverHistoricalSenateByTicker(apiKey, ticker)));
      } catch (e) {
        console.warn(`quiver hist senate ${ticker}:`, (e as Error).message);
      }
    }
    await delay(80);
  }
  return out;
}

/** Live off-exchange — GET /beta/live/offexchange (פעילות יומית לכל הטיקרים) */
export async function fetchQuiverLiveOffexchange(
  apiKey: string
): Promise<QuiverOffExchangeRow[]> {
  const json = await quiverGetJson<unknown>(apiKey, '/beta/live/offexchange');
  return unwrapQuiverList<QuiverOffExchangeRow>(json);
}

/** היסטוריית off-exchange לפי טיקר */
export async function fetchQuiverHistoricalOffexchange(
  apiKey: string,
  ticker: string
): Promise<QuiverOffExchangeRow[]> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return [];
  const json = await quiverGetJson<unknown>(
    apiKey,
    `/beta/historical/offexchange/${encodeURIComponent(sym)}`
  );
  return unwrapQuiverList<QuiverOffExchangeRow>(json);
}

/**
 * ימי `uploaded` לסריקה — מהיום אחורה עד `dateFrom` (כולל), חדש→ישן.
 *
 * schema.json מתעד `uploaded` כ-«Date the transaction was uploaded» בלי לומר
 * אם זה «ביום הזה» או «מהיום הזה והלאה». סריקה יום-יום נכונה בשתי הסמנטיקות,
 * והסדר חדש→ישן מבטיח שתקרת `maxRows` לא תחתוך דווקא את השורות הטריות.
 */
function quiverUploadedDays(dateFrom: string, maxDays: number): string[] {
  const from = normalizeQuiverIsoDate(dateFrom);
  if (!from) return [];
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  if (!Number.isFinite(fromMs)) return [];
  const cursor = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const out: string[] = [];
  while (out.length < maxDays && cursor.getTime() >= fromMs) {
    out.push(cursor.toISOString().slice(0, 10).replace(/-/g, ''));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return out;
}

/** מפתח דה-דופ לשורת insider — אין id יציב בתשובה של Quiver */
function quiverInsiderRowKey(r: QuiverInsiderRow): string {
  return [
    String(r.Ticker ?? '').trim().toUpperCase(),
    String(r.Name ?? '').trim().toLowerCase(),
    String(r.Date ?? r.TransactionDate ?? '').slice(0, 10),
    String(r.TransactionCode ?? ''),
    String(r.Shares ?? ''),
    String(r.PricePerShare ?? ''),
    String(r.fileDate ?? '').slice(0, 10),
  ].join('|');
}

/**
 * Live insiders — GET /beta/live/insiders
 * Quiver מחזיר snapshot של עסקאות אחרונות (לרוב עד ~1000).
 * page_size / page נשלחים אם ה-API תומך; אחרת חותכים מקומית כדי לא לנפח Edge Worker.
 *
 * פילטר התאריך הוא `uploaded` (YYYYMMDD) — הפרמטר המתועד ב-schema.json.
 * `date_from` לא קיים ב-endpoint הזה (הוא קיים רק ב-patents/lobbying).
 * הפילטר בצד הלקוח (`transaction_date >= since` ב-sync-insider-buys) נשאר
 * כרשת ביטחון: `uploaded` הוא זמן הקליטה של Quiver, לא תאריך העסקה.
 */
export async function fetchQuiverLiveInsiders(
  apiKey: string,
  opts: {
    /** תחילת חלון — נסרק כ-`uploaded` יום-יום */
    dateFrom?: string;
    /** יום העלאה בודד — `uploaded` מהדוקס (YYYYMMDD או ISO) */
    uploaded?: string;
    pageSize?: number;
    page?: number;
    /** Soft cap אחרי unwrap — מונע CPU/memory על payload ענק */
    maxRows?: number;
    /** תקרת ימי `uploaded` לסריקה כשמועבר dateFrom (ברירת מחדל 7) */
    maxUploadedDays?: number;
  } = {}
): Promise<QuiverInsiderRow[]> {
  const pageSize =
    opts.pageSize != null && opts.pageSize > 0
      ? Math.min(Math.floor(opts.pageSize), 1000)
      : undefined;
  const page =
    opts.page != null && opts.page > 0 ? Math.floor(opts.page) : undefined;
  const maxRows =
    opts.maxRows != null && opts.maxRows > 0
      ? Math.min(Math.floor(opts.maxRows), 2000)
      : pageSize ?? 1000;

  const cap = (rows: QuiverInsiderRow[]) =>
    rows.length > maxRows ? rows.slice(0, maxRows) : rows;

  const fetchDay = async (uploaded?: string): Promise<QuiverInsiderRow[]> => {
    const json = await quiverGetJson<unknown>(apiKey, '/beta/live/insiders', {
      uploaded,
      page_size: pageSize,
      page,
    });
    return unwrapQuiverList<QuiverInsiderRow>(json);
  };

  const explicitDay = formatQuiverDateParam(opts.uploaded);
  if (explicitDay) return cap(await fetchDay(explicitDay));

  const days = opts.dateFrom
    ? quiverUploadedDays(
        opts.dateFrom,
        Math.min(31, Math.max(1, opts.maxUploadedDays ?? 7))
      )
    : [];
  if (!days.length) return cap(await fetchDay());

  const out: QuiverInsiderRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < days.length; i++) {
    let batch: QuiverInsiderRow[];
    try {
      batch = await fetchDay(days[i]);
    } catch (e) {
      // אם השרת דוחה את `uploaded` — חוזרים לקריאה ללא פילטר (כמו קודם),
      // והפילטר בצד הלקוח ממשיך לחתוך את החלון.
      if (i === 0) {
        console.warn(
          'quiver insiders uploaded filter failed; unfiltered fallback:',
          (e as Error).message
        );
        return cap(await fetchDay());
      }
      console.warn(`quiver insiders uploaded=${days[i]}:`, (e as Error).message);
      continue;
    }
    for (const row of batch) {
      const key = quiverInsiderRowKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
      if (out.length >= maxRows) return out;
    }
    if (i < days.length - 1) await delay(120);
  }
  return out;
}

/**
 * אחזקות 13F לפי owner — GET /beta/live/sec13f?owner=&period=
 * הפרמטרים המתועדים: date, owner, page, page_size, period, ticker, today.
 */
export async function fetchQuiverSec13fByOwner(
  apiKey: string,
  owner: string,
  opts: QuiverSec13fByOwnerOpts = {}
): Promise<QuiverSec13fHolding[]> {
  const o = owner.trim();
  if (!o) return [];
  const pageSize =
    opts.pageSize != null && opts.pageSize > 0
      ? Math.min(Math.floor(opts.pageSize), 1000)
      : 500;
  const maxRows =
    opts.maxRows != null && opts.maxRows > 0
      ? Math.min(Math.floor(opts.maxRows), 5000)
      : 2000;
  const period = formatQuiverDateParam(opts.period);
  const out: QuiverSec13fHolding[] = [];
  const maxPages = opts.page != null ? 1 : Math.ceil(maxRows / pageSize);

  for (let page = opts.page ?? 1; page < (opts.page ?? 1) + maxPages; page++) {
    const json = await quiverGetJson<unknown>(apiKey, '/beta/live/sec13f', {
      owner: o,
      period,
      page,
      page_size: pageSize,
    });
    const batch = unwrapQuiverList<QuiverSec13fHolding>(json);
    if (!batch.length) break;
    out.push(...batch);
    if (out.length >= maxRows) break;
    if (batch.length < pageSize) break;
    if (opts.page != null) break;
  }
  return out.length > maxRows ? out.slice(0, maxRows) : out;
}

/**
 * שינויי 13F — GET /beta/live/sec13fchanges
 * חובה לסנן owner / ticker / most_recent — בלי פילטר Quiver מחזיר עשרות אלפי שורות.
 */
export async function fetchQuiverLiveSec13fChanges(
  apiKey: string,
  opts: QuiverSec13fChangesOpts = {}
): Promise<QuiverSec13fChange[]> {
  const pageSize =
    opts.pageSize != null && opts.pageSize > 0
      ? Math.min(Math.floor(opts.pageSize), 1000)
      : 200;
  const maxRows =
    opts.maxRows != null && opts.maxRows > 0
      ? Math.min(Math.floor(opts.maxRows), 5000)
      : opts.owner
        ? 1500
        : 400;
  const mostRecent = opts.mostRecent !== false;
  const out: QuiverSec13fChange[] = [];
  const startPage = opts.page ?? 1;
  const maxPages = opts.page != null ? 1 : Math.ceil(maxRows / pageSize);

  for (let page = startPage; page < startPage + maxPages; page++) {
    const json = await quiverGetJson<unknown>(apiKey, '/beta/live/sec13fchanges', {
      owner: opts.owner?.trim() || undefined,
      ticker: opts.ticker?.trim() || undefined,
      period: formatQuiverDateParam(opts.period),
      // most_recent מתועד ל-endpoint הזה (בשונה מ-/beta/live/sec13f)
      most_recent: mostRecent ? 'true' : undefined,
      page,
      page_size: pageSize,
    });
    const batch = unwrapQuiverList<QuiverSec13fChange>(json);
    if (!batch.length) break;
    out.push(...batch);
    if (out.length >= maxRows) break;
    if (batch.length < pageSize) break;
    if (opts.page != null) break;
  }
  return out.length > maxRows ? out.slice(0, maxRows) : out;
}

/** שינויי 13F רק ל-owners מאוצרים (Buffett / Wood / Ackman) */
export async function fetchQuiverCuratedFundChanges(
  apiKey: string,
  opts: { mostRecent?: boolean; pageSize?: number; maxPerOwner?: number } = {}
): Promise<{
  changes: QuiverSec13fChange[];
  by_owner: Record<string, number>;
  owners_tried: string[];
}> {
  const by_owner: Record<string, number> = {};
  const owners_tried: string[] = [];
  const seen = new Set<string>();
  const changes: QuiverSec13fChange[] = [];
  const maxPerOwner = opts.maxPerOwner ?? 800;

  for (const meta of Object.values(CURATED_FUND_QUIVER_OWNERS)) {
    const owners = meta.owners?.length ? meta.owners : [meta.owner];
    let got = 0;
    for (const owner of owners) {
      owners_tried.push(owner);
      try {
        const rows = await fetchQuiverLiveSec13fChanges(apiKey, {
          owner,
          mostRecent: opts.mostRecent !== false,
          pageSize: opts.pageSize ?? 200,
          maxRows: maxPerOwner,
        });
        by_owner[owner] = rows.length;
        got = Math.max(got, rows.length);
        for (const row of rows) {
          const t = String(row.Ticker ?? '')
            .trim()
            .toUpperCase();
          const d = String(row.Date ?? row.FilingDate ?? row.ReportDate ?? '').slice(0, 10);
          const fund = String(row.Fund ?? row.Owner ?? owner).trim().toLowerCase();
          const key = `${fund}|${t}|${d}|${row.Change ?? row.Change_Share ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          changes.push(row);
        }
        if (rows.length > 0) break;
      } catch {
        by_owner[owner] = -1;
      }
      await delay(120);
    }
    by_owner[meta.owner] = by_owner[meta.owner] ?? got;
  }

  return { changes, by_owner, owners_tried };
}

export function quiverSec13fFundName(row: {
  Fund?: string;
  Owner?: string;
}): string {
  return String(row.Fund ?? row.Owner ?? '').trim();
}

export function quiverSec13fShares(row: {
  Held?: number | string;
  Shares?: number | string;
  Held_Normalized?: number | string;
}): number | null {
  return (
    parseQuiverUsd(row.Held) ??
    parseQuiverUsd(row.Shares) ??
    parseQuiverUsd(row.Held_Normalized)
  );
}

export function quiverSec13fValueUsd(row: {
  Value?: number | string;
  Held?: number | string;
  Shares?: number | string;
  Held_Normalized?: number | string;
  Close?: number | string;
}): number | null {
  const direct = parseQuiverUsd(row.Value);
  if (direct != null && direct > 0) return direct;
  const shares = quiverSec13fShares(row);
  const close = parseQuiverUsd(row.Close);
  if (shares != null && close != null && close > 0) {
    return Math.round(shares * close * 100) / 100;
  }
  return null;
}

export function quiverSec13fChangePct(row: {
  Change_Pct?: number | string;
  ChangePercent?: number | string;
}): number | null {
  return parseQuiverUsd(row.Change_Pct) ?? parseQuiverUsd(row.ChangePercent);
}

export function quiverSec13fChangeShares(row: {
  Change?: number | string;
  Change_Share?: number | string;
}): number | null {
  return parseQuiverUsd(row.Change_Share) ?? parseQuiverUsd(row.Change);
}

export const QUIVER_FUND_CHANGES_CACHE_KEY = 'quiver_sec13f_changes';

/** טיקרים עם דיווחי קונגרס נפוצים — fallback להיסטוריה */
export const DEFAULT_HISTORY_TICKERS = [
  'NVDA',
  'AAPL',
  'MSFT',
  'GOOGL',
  'GOOG',
  'AMZN',
  'META',
  'TSLA',
  'NFLX',
  'CRM',
  'AVGO',
  'AMD',
  'INTC',
  'UBER',
  'DIS',
  'BA',
  'JPM',
  'V',
  'MA',
  'COST',
  'PANW',
  'CRWD',
  'PLTR',
  'COIN',
];

/**
 * BioGuides מאוצרים — deep history / holdings / materialize (לא מגביל את פיד העסקאות).
 * מקורות BioGuide בפרופיל (בסדר עדיפות):
 *   1) CURATED_CONGRESS_BIOGUIDES (רשימה קשיחה)
 *   2) cache `quiver_congress_politicians` (BioGuideID מ־Quiver)
 *   3) dark_pool_congress_trades.politician_id כשזה BioGuide (^[A-Z]\\d{6}$)
 * אחזקות: GET /beta/live/congress_stock_holdings?bioguide_id= → cache יומי
 * מסונכרן עם curatedExploreProfiles.ts (+ Trump ב־CURATED_EXECUTIVE_UW_IDS).
 */
export const CURATED_CONGRESS_BIOGUIDES = [
  'P000197', // Nancy Pelosi
  'C001114', // John Curtis (עסקאות רבות)
  'M000355', // Mitch McConnell
  'G000583', // Josh Gottheimer
  'C001098', // Ted Cruz
  'M001218', // Rich McCormick
  'B001236', // John Boozman
  'M001217', // Jared Moskowitz
  'S000168', // Maria Elvira Salazar
  'T000278', // Tommy Tuberville
  'G000596', // Marjorie Taylor Greene
  'K000389', // Ro Khanna
  'M001157', // Michael McCaul
  'W000802', // Sheldon Whitehouse
  'D000032', // Byron Donalds
  'M001190', // Markwayne Mullin
];

/**
 * UUID פנימי לפרופילים מאוצרים שאינם BioGuide (executive / נשיא).
 * Trump — גם מ-Quiver /beta/bulk/trumpstocktrades (לא STOCK Act).
 */
export const CURATED_EXECUTIVE_UW_IDS = [TRUMP_DARKPOOL_PERSON_ID];

/** רשימת פוליטיקאים — GET /beta/bulk/congress/politicians (paginated) */
export async function fetchQuiverCongressPoliticians(
  apiKey: string,
  opts: {
    pageSize?: number;
    maxPages?: number;
    includeCandidates?: boolean;
    isActive?: boolean;
  } = {}
): Promise<QuiverPolitician[]> {
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 50));
  const maxPages = Math.min(30, Math.max(1, opts.maxPages ?? 4));
  const out: QuiverPolitician[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const json = await quiverGetJson<unknown>(apiKey, '/beta/bulk/congress/politicians', {
      page,
      page_size: pageSize,
      sort_by: 'trade_count',
      include_candidates: opts.includeCandidates ?? false,
      is_active: opts.isActive ?? true,
    });
    const batch = unwrapQuiverList<QuiverPolitician>(json);
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < pageSize) break;
    await delay(120);
  }

  return out;
}

export function parseQuiverTxnSide(raw?: string | null): 'buy' | 'sell' | null {
  const t = (raw || '').toLowerCase();
  if (t.includes('sale') || t.includes('sell')) return 'sell';
  if (t.includes('purchase') || t.includes('buy')) return 'buy';
  return null;
}

export function isQuiverEquityTrade(row: QuiverCongressTrade): boolean {
  const ticker = String(row.Ticker ?? '').trim().toUpperCase();
  if (!ticker || ticker.length > 6) return false;
  const tt = String(row.TickerType ?? '').toLowerCase();
  if (tt && !tt.includes('stock') && tt !== 'st' && tt !== 'cs') return false;
  return parseQuiverTxnSide(row.Transaction) != null;
}

export function quiverPoliticianNetWorth(p: QuiverPolitician): number | undefined {
  const n = p.NetWorth ?? p['Net Worth'];
  return n != null && Number.isFinite(Number(n)) ? Number(n) : undefined;
}

/**
 * מנרמל את ארבעת ה-shapes של Quiver לשדות אחידים (schema.json):
 *   CongressionalTrade   — Representative · TransactionDate · ReportDate
 *   HouseTrade           — Representative · Date            · ReportDate
 *   SenateTrade          — Senator        · Date            · ReportDate
 *   CongressionalTradeV2 — Name           · Traded          · Filed
 *
 * TransactionDate/Traded/Date = תאריך העסקה · ReportDate/Filed = תאריך הדיווח.
 * בלי `Senator`/`Date` שורות Senate איבדו את השם ושורות House+Senate קיבלו
 * את תאריך הדיווח כתאריך העסקה.
 */
export function normalizeCongressTrade(row: QuiverCongressTrade): QuiverCongressTrade {
  return {
    ...row,
    Representative: row.Representative || row.Senator || row.Name,
    ReportDate: row.ReportDate || row.Filed,
    TransactionDate: row.TransactionDate || row.Traded || row.Date,
    Range: row.Range || row.Trade_Size_USD || row.Amount,
    Amount: row.Amount || row.Trade_Size_USD,
    House: row.House || row.Chamber,
    Description: row.Description ?? row.Company ?? null,
  };
}

export function parseQuiverUsd(raw: number | string | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).replace(/[$,%\s]/g, '').replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseQuiverAllocationPct(
  raw: number | string | null | undefined
): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 0 && raw <= 1 ? raw * 100 : raw;
  }
  const s = String(raw).replace(/%/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
