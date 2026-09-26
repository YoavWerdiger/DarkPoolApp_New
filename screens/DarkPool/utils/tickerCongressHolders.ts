/**
 * מחזיקי טיקר מ-Quiver congress_stock_holdings (cache by_bioguide).
 * CurrentHolding / Allocation בלבד — בלי midpoint של STOCK Act.
 * קירוב מניות = CurrentHolding ÷ מחיר חי בלבד (~N), לא Form 4 ולא amount_label.
 */

import { parseQuiverUsd, quiverAllocationToPct } from './congressHonesty';
import { formatFeedTickerDisplay } from './feedTradeDisplay';
import { isolateData } from './bidi';
import {
  formatCongressValue,
  formatCongressWeight,
} from './investorHoldings';
import {
  congressPhotoUrl,
  looksLikePersonPhoto,
} from './investorPlaceholder';

const BIOGUIDE_RE = /^[A-Z]\d{6}$/;

/** תואם `QUIVER_HOLDINGS_FRESH_MS` ב-edge — cache יומי, לא tick חי. */
export const TICKER_HOLDINGS_FRESH_MS = 24 * 60 * 60 * 1000;

export interface QuiverHoldingsTickerCache {
  by_bioguide?: Record<string, Array<Record<string, unknown>>>;
  /** חותמת `GET /beta/live/congress_stock_holdings?ticker=` לכל סימול. */
  tickers_synced?: Record<string, string>;
  /** חותמת `GET /beta/live/congress_stock_holdings?bioguide_id=` לכל אדם. */
  bioguides_synced?: Record<string, string>;
  synced_at?: string;
}

export interface TickerCongressHolder {
  bioguideId: string;
  name: string;
  imageUrl: string | null;
  currentValueUSD: number | null;
  allocationPct: number | null;
}

export type TickerHolderMetricKind = 'usd' | 'allocation';

export interface TickerHolderMetric {
  text: string;
  kind: TickerHolderMetricKind;
}

export interface PoliticianRosterRow {
  BioGuideID?: string;
  Name?: string;
  ImageURL?: string;
}

function asRecord(row: unknown): Record<string, unknown> {
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
}

function normalizeBioguide(raw: unknown): string | null {
  const id = String(raw ?? '')
    .trim()
    .toUpperCase();
  return BIOGUIDE_RE.test(id) ? id : null;
}

function normalizeTicker(raw: unknown): string {
  return String(raw ?? '')
    .replace(/^\$/, '')
    .trim()
    .toUpperCase();
}

function personPhotoUrl(raw: unknown): string | null {
  const url = String(raw ?? '').trim();
  if (!url || !looksLikePersonPhoto(url)) return null;
  return url;
}

function holderName(raw: unknown): string {
  return String(raw ?? '').trim();
}

/** CurrentHolding קומפקטי; אחרת Allocation %. בלי מניות מומצאות מטווח. */
export function formatTickerHolderMetric(
  holder: Pick<TickerCongressHolder, 'currentValueUSD' | 'allocationPct'>
): TickerHolderMetric | null {
  const usd = formatCongressValue(holder.currentValueUSD);
  if (usd !== '—') return { text: usd, kind: 'usd' };
  const alloc = formatCongressWeight(holder.allocationPct);
  if (alloc !== '—') return { text: alloc, kind: 'allocation' };
  return null;
}

/**
 * קירוב מניות מצילום Quiver: CurrentHolding (USD) ÷ מחיר חי.
 * לא amount_label, לא midpoint של STOCK Act, לא Form 4.
 */
export function impliedHoldingShares(
  holdingUsd: number | null | undefined,
  lastPrice: number | null | undefined
): number | null {
  if (
    holdingUsd == null ||
    lastPrice == null ||
    !Number.isFinite(holdingUsd) ||
    !Number.isFinite(lastPrice) ||
    holdingUsd <= 0 ||
    lastPrice <= 0
  ) {
    return null;
  }
  const n = Math.round(holdingUsd / lastPrice);
  return n > 0 ? n : null;
}

/** `~1,200 מניות` — מספר שלם עם grouping. בלי «משוער». */
export function formatImpliedHoldingShares(
  holdingUsd: number | null | undefined,
  lastPrice: number | null | undefined
): string | null {
  const n = impliedHoldingShares(holdingUsd, lastPrice);
  if (n == null) return null;
  return `~${n.toLocaleString('en-US')} מניות`;
}

/**
 * שורת מחזיק כמו בצילום: שם + הקצאה מתחת, שווי מימין.
 * Allocation רק כשיש גם CurrentHolding — אחרת המדד היחיד עולה לימין.
 * שורת ~מניות רק כשיש CurrentHolding + מחיר חי — לא מטווח STOCK Act.
 */
export function tickerHolderRowCopy(
  holder: Pick<TickerCongressHolder, 'currentValueUSD' | 'allocationPct'>,
  lastPrice?: number | null
): { subtitle: string | null; metric: TickerHolderMetric; sharesLabel: string | null } | null {
  const metric = formatTickerHolderMetric(holder);
  if (!metric) return null;
  const alloc = formatCongressWeight(holder.allocationPct);
  const subtitle =
    metric.kind === 'usd' && alloc !== '—' ? alloc : null;
  const sharesLabel =
    metric.kind === 'usd'
      ? formatImpliedHoldingShares(holder.currentValueUSD, lastPrice)
      : null;
  return { subtitle, metric, sharesLabel };
}

export function tickerHoldersSectionTitle(ticker: string): {
  lead: string;
  tickerDisplay: string;
  tickerIsolated: string;
  sentence: string;
} {
  const tickerDisplay = formatFeedTickerDisplay(ticker);
  return {
    lead: 'פוליטיקאים שמחזיקים ',
    tickerDisplay,
    tickerIsolated: isolateData(tickerDisplay),
    sentence: `פוליטיקאים שמחזיקים ${tickerDisplay}`,
  };
}

/** כיתוב מדד — שווי CurrentHolding, אחרת Allocation. לא עסקאות. */
export function tickerHoldersSectionSubtitle(): string {
  return 'שווי אחזקה מדווח או הקצאה בתיק — לא יומן עסקאות.';
}

export function tickerHoldersEmptyCopy(ticker: string): {
  title: string;
  body: string;
} {
  const tickerDisplay = formatFeedTickerDisplay(ticker);
  return {
    title: 'אין מחזיקים מדווחים',
    body:
      `לא נמצאה אחזקה נוכחית של חברי קונגרס ב-${isolateData(tickerDisplay)}. ` +
      'הרשימה מבוססת על CurrentHolding / Allocation של Quiver — לא על דיווחי STOCK Act.',
  };
}

export function tickerHoldersErrorCopy(): {
  title: string;
  body: string;
} {
  return {
    title: 'לא הצלחנו לטעון מחזיקים',
    body: 'אין נפילה ליומן עסקאות. נסו שוב בעוד רגע.',
  };
}

export function politicianRosterIndex(
  rows: PoliticianRosterRow[] | null | undefined
): Map<string, { name: string; imageUrl: string | null }> {
  const map = new Map<string, { name: string; imageUrl: string | null }>();
  for (const row of rows ?? []) {
    const id = normalizeBioguide(row.BioGuideID);
    if (!id) continue;
    map.set(id, {
      name: holderName(row.Name),
      imageUrl: personPhotoUrl(row.ImageURL),
    });
  }
  return map;
}

function mapHoldingRow(
  row: Record<string, unknown>,
  fallbackBioguide: string | null,
  roster: Map<string, { name: string; imageUrl: string | null }>
): TickerCongressHolder | null {
  const ticker = normalizeTicker(row.Ticker);
  if (!ticker) return null;
  const bioguideId = normalizeBioguide(row.BioGuideID) ?? fallbackBioguide;
  if (!bioguideId) return null;

  const currentValueUSD = parseQuiverUsd(
    (row.CurrentHolding as number | string | null) ?? null
  );
  const allocationPct = quiverAllocationToPct(
    (row.Allocation as number | string | null) ?? null
  );
  if (currentValueUSD == null && allocationPct == null) return null;

  const rosterHit = roster.get(bioguideId);
  const name =
    holderName(row.Name) || rosterHit?.name || 'חבר קונגרס';
  const imageUrl =
    personPhotoUrl(row.ImageURL) ??
    rosterHit?.imageUrl ??
    congressPhotoUrl(bioguideId);

  return {
    bioguideId,
    name,
    imageUrl,
    currentValueUSD,
    allocationPct,
  };
}

export function isHoldingsSyncStampFresh(
  raw: string | null | undefined,
  freshMs = TICKER_HOLDINGS_FRESH_MS,
  nowMs = Date.now()
): boolean {
  if (!raw) return false;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) && nowMs - ts >= 0 && nowMs - ts < freshMs;
}

export function isTickerHoldingsCacheFresh(
  payload: QuiverHoldingsTickerCache | null | undefined,
  ticker: string,
  freshMs = TICKER_HOLDINGS_FRESH_MS,
  nowMs = Date.now()
): boolean {
  const want = normalizeTicker(ticker);
  if (!want) return false;
  return isHoldingsSyncStampFresh(payload?.tickers_synced?.[want], freshMs, nowMs);
}

/**
 * מיזוג `?ticker=` משאיר לרוב שורה אחת. ספר עם 2+ טיקרים הוא
 * תוצאת `?bioguide_id=` גם בלי חותמת `bioguides_synced`.
 */
export function looksLikeCompleteBioguideHoldings(
  rows: Array<Record<string, unknown> | null | undefined> | null | undefined
): boolean {
  if (!Array.isArray(rows) || rows.length < 2) return false;
  const tickers = new Set<string>();
  for (const row of rows) {
    const ticker = String(row?.Ticker ?? '')
      .replace(/^\$/, '')
      .trim()
      .toUpperCase();
    if (ticker) tickers.add(ticker);
  }
  return tickers.size >= 2;
}

/**
 * סריקת `by_bioguide[bg]` בלי חותמת היא לא תיק מלא —
 * מיזוג `?ticker=` יכול להשאיר שורת מניה אחת.
 */
export function isBioguideHoldingsCacheFresh(
  payload: QuiverHoldingsTickerCache | null | undefined,
  bioguideId: string,
  freshMs = TICKER_HOLDINGS_FRESH_MS,
  nowMs = Date.now()
): boolean {
  const bg = normalizeBioguide(bioguideId);
  if (!bg) return false;
  const stamps = payload?.bioguides_synced ?? {};
  return isHoldingsSyncStampFresh(stamps[bg] ?? stamps[bioguideId], freshMs, nowMs);
}

/**
 * ממזג תוצאת `congress_stock_holdings?ticker=` לתוך `by_bioguide`.
 * מחליף את שורת הטיקר אצל כל BioGuide; מסיר אחזקה ישנה שלא חזרה מ-Quiver.
 */
export function mergeTickerHoldingRowsIntoByBioguide(
  byBioguide: Record<string, Array<Record<string, unknown>>> | null | undefined,
  ticker: string,
  rows: Array<Record<string, unknown>> | null | undefined
): Record<string, Array<Record<string, unknown>>> {
  const want = normalizeTicker(ticker);
  const next: Record<string, Array<Record<string, unknown>>> = {
    ...(byBioguide ?? {}),
  };
  if (!want) return next;

  const seen = new Set<string>();
  for (const raw of rows ?? []) {
    const row = asRecord(raw);
    const bg = normalizeBioguide(row.BioGuideID);
    if (!bg || normalizeTicker(row.Ticker) !== want) continue;
    seen.add(bg);
    const existing = [...(next[bg] ?? [])];
    const idx = existing.findIndex((item) => normalizeTicker(asRecord(item).Ticker) === want);
    if (idx >= 0) existing[idx] = { ...row, BioGuideID: bg, Ticker: want };
    else existing.push({ ...row, BioGuideID: bg, Ticker: want });
    next[bg] = existing;
  }

  for (const [bg, holdings] of Object.entries(next)) {
    if (seen.has(bg) || !Array.isArray(holdings)) continue;
    const filtered = holdings.filter((item) => normalizeTicker(asRecord(item).Ticker) !== want);
    if (filtered.length !== holdings.length) next[bg] = filtered;
  }

  return next;
}

/**
 * סורק `by_bioguide` ומחזיר רק שורות עם CurrentHolding / Allocation לטיקר.
 * אין fallback לעסקאות PTR — בלי שורת אחזקה אין ברשימה.
 */
export function mapTickerCongressHoldersFromCache(opts: {
  ticker: string;
  byBioguide: Record<string, Array<Record<string, unknown>>> | null | undefined;
  politicians?: PoliticianRosterRow[] | null;
}): TickerCongressHolder[] {
  const want = normalizeTicker(opts.ticker);
  if (!want) return [];
  const roster = politicianRosterIndex(opts.politicians);
  const byId = new Map<string, TickerCongressHolder>();

  for (const [key, rows] of Object.entries(opts.byBioguide ?? {})) {
    const keyBg = normalizeBioguide(key);
    if (!Array.isArray(rows)) continue;
    for (const raw of rows) {
      const row = asRecord(raw);
      if (normalizeTicker(row.Ticker) !== want) continue;
      const holder = mapHoldingRow(row, keyBg, roster);
      if (!holder) continue;
      const prev = byId.get(holder.bioguideId);
      if (!prev) {
        byId.set(holder.bioguideId, holder);
        continue;
      }
      const prevUsd = prev.currentValueUSD ?? 0;
      const nextUsd = holder.currentValueUSD ?? 0;
      if (nextUsd > prevUsd) byId.set(holder.bioguideId, holder);
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const usd = (b.currentValueUSD ?? 0) - (a.currentValueUSD ?? 0);
    if (usd !== 0) return usd;
    return (b.allocationPct ?? 0) - (a.allocationPct ?? 0);
  });
}
