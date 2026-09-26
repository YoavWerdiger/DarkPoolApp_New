/**
 * Dual-Engine holdings — שני מנועים נפרדים, בלי לערבב STOCK Act עם Form 4.
 *
 *   CONGRESS_BASELINE — Quiver CurrentHolding + Allocation לפי bioguide_id.
 *     PTR נשאר יומן עסקאות. לא מוסיפים midpoint של $1,001–$15,000 על CurrentHolding.
 *
 *   INSIDER_FORM_4 — מניות מדווחות × מחיר יומי (close).
 *     P/A/M מוסיפים, S/F/G גורעים. אופציות מחוץ ל-V_t.
 *     סופ״ש יורש close קודם. בלי פיצול/דיבידנד מומצא.
 *
 * טראמפ (אין bioguide) — מנוע שלישי ב-`trumpHoldings.ts` (נומינל × יחס close).
 * 13F (לווייתנים) לא עובר כאן.
 */

import type { ActualCongressHolding, InsiderBuyRow } from '../../../types/darkpool.types';
import { parseQuiverUsd, quiverAllocationToPct } from './congressHonesty';
import { formatSignedUsdRaw, formatUsdRawOrDash } from './usdRawFormat';

/** פנימי בלבד — לא מוצג כתג במסך. */
export const HOLDING_TAG_ESTIMATED = 'משוער';
export const HOLDING_TAG_EXACT = 'מדויק';

/** מאחורי `?` / (i) — לא כבאנר ולא כתג שורה. */
export const CONGRESS_HOLDINGS_HELP_TITLE = 'על המספרים';
export const CONGRESS_HOLDINGS_HELP_BODY =
  'שווי והקצאה מ-Quiver (CurrentHolding). תשואה בשורה: מחיר המניה מאז רכישה אחרונה שדווחה ב-PTR (פתיחת יום העסקה מול מחיר חי) — לא רווח/הפסד של הפוזיציה. אם Quiver מספק עלות כניסה — משתמשים בה.';

export const FORM4_HOLDINGS_HELP_TITLE = 'על המספרים';
export const FORM4_HOLDINGS_HELP_BODY =
  'כמות × מחיר מהפוזיציה שדווחה ב-Form 4 — לא כל השווי הנטו של האדם.';

export interface InsiderForm4Holding {
  type: 'INSIDER_FORM_4';
  ticker: string;
  exactShares: number;
  sharePrice: number;
  calculatedValueUSD: number;
  exactPortfolioWeight: number;
  /** ממוצע עלות ממחירי Form 4. null אם אין בסיס חיובי. */
  avgCost: number | null;
  /** (live − basis) / basis. null אם basis ≤ 0 (מענק ב־$0) או בסיס לא ידוע. */
  entryReturnPct: number | null;
  isEstimated: false;
}

export interface CongressModelHolding {
  type: 'CONGRESS_BASELINE';
  ticker: string;
  bioguideId: string;
  quiverBaselineHoldingUSD: number;
  quiverAllocationPercent: number;
  lastUpdatedFromPTR?: string | null;
  /** תאריך as-of של סנאפשוט ההחזקות (synced_at / updated_at). */
  asOfDate?: string | null;
  /** שדות vendor נדירים — לא 5-שדות הרגיל של congress_stock_holdings. */
  vendorShares?: number | null;
  vendorAvgCost?: number | null;
  vendorPriceChangePct?: number | null;
  isEstimated: true;
}

export type InvestorHolding = InsiderForm4Holding | CongressModelHolding;

export interface Form4TradeInput {
  ticker: string;
  transaction_date: string;
  transaction_code: string;
  shares: number;
  price: number | null;
  /** פוזיציה אחרי העסקה — משמש כזרע לטיקר אם זו הפעם הראשונה שיש ערך. */
  shares_owned_after?: number | null;
  /** חוזה אופציה / נגזר — לא נכנס ל-V_t של מניות. */
  is_option?: boolean;
  security?: string | null;
}

export interface Form4ValuePoint {
  date: string;
  value: number;
}

export interface CongressBasketPricePoint {
  date: string;
  close: number;
  /** פתיחה יומית — לתשואת PTR מאז transaction_date. */
  open?: number | null;
}

export interface CongressBasketValuePoint {
  date: string;
  value: number;
}

/** כיסוי מינימלי של סל Quiver במחירי שוק — מתחת לזה אין גרף / דלתא. */
export const CONGRESS_BASKET_MIN_COVERAGE = 0.6;
const CONGRESS_BASKET_MIN_POINTS = 5;

const FORM4_ADD = new Set(['P', 'A', 'M', 'C', 'X', 'I', 'O']);
const FORM4_SUB = new Set(['S', 'F', 'G', 'D']);

/**
 * סימן כמות לפי קוד Form 4.
 * P/A/M מוסיפים, S/F/G גורעים, D גריעה (disposition), אחר — 0 (לא מנחשים).
 */
export function form4QtySign(code: string | null | undefined): 1 | -1 | 0 {
  const c = (code ?? '').trim().toUpperCase();
  if (FORM4_ADD.has(c)) return 1;
  if (FORM4_SUB.has(c)) return -1;
  return 0;
}

const OPTION_SECURITY_RE = /\b(option|call|put|warrant|derivative|convertible)\b/i;

/**
 * שורת נגזר / אופציה — לא מניות רגילות.
 * בלי `security_title` (Quiver live/insiders) לא מנחשים; הקוד M/X נשאר תוספת מניות.
 */
export function isForm4OptionRow(t: {
  is_option?: boolean | null;
  security?: string | null;
}): boolean {
  if (t.is_option === true) return true;
  const s = (t.security ?? '').trim();
  return s.length > 0 && OPTION_SECURITY_RE.test(s);
}

function addUtcDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ימים קלנדריים כולל סופ״ש — לירושת close בחישוב פנימי בלבד. */
export function eachCalendarDate(start: string, end: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return [];
  if (end < start) return [];
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addUtcDays(cur, 1);
    if (out.length > 4000) break;
  }
  return out;
}

/**
 * ימי מסחר מאיחוד סדרות Yahoo — בלי שבת/ראשון שטוחים.
 * גרף תיק אמיתי מצייר רק session days.
 */
export function unionTradingDates(
  pricesByTicker: Record<string, CongressBasketPricePoint[]>,
  start?: string,
  end?: string
): string[] {
  const dates = new Set<string>();
  for (const series of Object.values(pricesByTicker)) {
    for (const p of series) {
      if (!(p.close > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) continue;
      if (start && p.date < start) continue;
      if (end && p.date > end) continue;
      dates.add(p.date);
    }
  }
  return [...dates].sort();
}

export type HoldingRowEngine = 'congress' | 'form4' | 'trump' | 'filing';

export interface HoldingRowCells {
  ticker: string;
  allocationLabel: string;
  valueLabel: string;
  returnLabel: string;
}

export function formatHoldingWeight(holding: InvestorHolding): string {
  if (holding.type === 'CONGRESS_BASELINE') {
    return formatCongressWeight(holding.quiverAllocationPercent);
  }
  return formatForm4Weight(holding.exactPortfolioWeight);
}

export function formatHoldingValue(holding: InvestorHolding): string {
  if (holding.type === 'CONGRESS_BASELINE') {
    return formatCongressValue(holding.quiverBaselineHoldingUSD);
  }
  return formatForm4Value(holding.calculatedValueUSD);
}

/**
 * שורת אחזקה בפרופיל — ארבעה תאים בלבד, בלי תג «משוער».
 * RTL: לוגו+טיקר+הקצאה מימין; שווי+תשואה משמאל.
 */
export function formatHoldingRowCells(opts: {
  ticker: string;
  engine: HoldingRowEngine;
  allocationPct?: number | null;
  valueUsd?: number | null;
  returnPct?: number | null;
}): HoldingRowCells {
  return {
    ticker: opts.ticker.toUpperCase().trim(),
    allocationLabel: formatHoldingRowAllocation(opts.allocationPct, opts.engine),
    valueLabel: formatHoldingRowValue(opts.valueUsd, opts.engine),
    returnLabel: formatHoldingRowReturn(opts.returnPct),
  };
}

export function formatHoldingRowAllocation(
  pct: number | null | undefined,
  engine: HoldingRowEngine
): string {
  if (engine === 'congress') return formatCongressWeight(pct);
  if (engine === 'form4' || engine === 'trump') return formatForm4Weight(pct);
  return formatFilingWeight(pct);
}

export function formatHoldingRowValue(
  usd: number | null | undefined,
  engine: HoldingRowEngine
): string {
  if (engine === 'congress') return formatCongressPortfolioHeroValue(usd);
  if (engine === 'form4' || engine === 'trump') return formatForm4Value(usd);
  return formatFilingValue(usd);
}

/** 13F / filing — אחוז עם ספרה אחת; לא טווח STOCK Act. */
export function formatFilingWeight(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  return `${pct.toFixed(1)}%`;
}

export function formatFilingValue(usd: number | null | undefined): string {
  return formatUsdRawOrDash(usd);
}

/**
 * תשואת הטיקר — MTM / price_change אמיתי בלבד.
 * אין נתון → «—». לעולם לא midpoint של STOCK Act.
 */
export function formatHoldingRowReturn(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  if (pct > 0) return `+${pct.toFixed(1)}%`;
  if (pct < 0) return `−${Math.abs(pct).toFixed(1)}%`;
  return '0.0%';
}

/**
 * שינוי מחיר הטיקר בין close ראשון לאחרון בסדרה.
 * לא CurrentHolding, לא טווח STOCK Act, לא כמות מומצאת.
 * לא תשואת כניסה של שורת אחזקה — לזה `congressHonestHoldingReturnPct`.
 */
export function tickerMarkToMarketReturnPct(
  series: CongressBasketPricePoint[] | null | undefined
): number | null {
  if (!series?.length) return null;
  const sorted = series
    .filter((p) => p.close > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const first = sorted[0].close;
  const last = sorted[sorted.length - 1].close;
  if (!(first > 0) || !(last > 0)) return null;
  return ((last - first) / first) * 100;
}

function normalizeHoldingDate(iso: string | null | undefined): string | null {
  const d = String(iso ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** (חי − כניסה) / כניסה. מסתיר אם אין מחיר כניסה חיובי — לא ממציאים 0%. */
export function holdingReturnFromEntry(
  livePrice: number | null | undefined,
  entryPrice: number | null | undefined
): number | null {
  if (livePrice == null || entryPrice == null) return null;
  if (!(livePrice > 0) || !(entryPrice > 0)) return null;
  return ((livePrice - entryPrice) / entryPrice) * 100;
}

export function latestTickerClose(
  series: CongressBasketPricePoint[] | null | undefined
): number | null {
  if (!series?.length) return null;
  let best: { date: string; close: number } | null = null;
  for (const p of series) {
    if (!(p.close > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) continue;
    if (!best || p.date > best.date) best = p;
  }
  return best?.close ?? null;
}

/** Close ביום הכניסה או ביום המסחר האחרון שלפניו. בלי מחיר לפני התאריך — null. */
export function closeOnOrBefore(
  series: CongressBasketPricePoint[] | null | undefined,
  date: string | null | undefined
): number | null {
  const day = normalizeHoldingDate(date);
  if (!series?.length || !day) return null;
  let best: { date: string; close: number } | null = null;
  for (const p of series) {
    if (!(p.close > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) continue;
    if (p.date > day) continue;
    if (!best || p.date > best.date) best = p;
  }
  return best?.close ?? null;
}

/**
 * קונגרס: מחיר עכשיו מול מחיר ב־as-of של ההחזקות / תאריך סנאפשוט ראשון ידוע.
 * לא midpoint של STOCK Act. בלי מחיר כניסה — null (לא 0).
 */
export function congressHoldingReturnPct(
  series: CongressBasketPricePoint[] | null | undefined,
  asOfDate?: string | null,
  firstKnownDate?: string | null
): number | null {
  const live = latestTickerClose(series);
  const tryDate = (raw: string | null | undefined): number | null =>
    holdingReturnFromEntry(live, closeOnOrBefore(series, raw));
  const firstKnown = normalizeHoldingDate(firstKnownDate);
  if (firstKnown) {
    const fromFirst = tryDate(firstKnown);
    if (fromFirst != null) return fromFirst;
  }
  return tryDate(asOfDate);
}

/**
 * 13F: תשואה מול מחיר רבעון קודם. בלי מחיר רבעון — null (לא first-added לכל החיים).
 */
export function filingPriorQuarterReturnPct(
  livePrice: number | null | undefined,
  priorQuarterPrice: number | null | undefined
): number | null {
  return holdingReturnFromEntry(livePrice, priorQuarterPrice);
}

/** קונגרס: אחוז מעוגל, בלי טילדה ובלי שתי ספרות מזויפות. */
export function formatCongressWeight(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  return `${Math.round(pct)}%`;
}

/** Form 4: שני ספרות אחרי הנקודה. */
export function formatForm4Weight(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  return `${pct.toFixed(2)}%`;
}

/** קונגרס: דולרים שלמים עם פסיקים — בלי K/M/B. */
export function formatCongressValue(usd: number | null | undefined): string {
  return formatUsdRawOrDash(usd);
}

/** סכום CurrentHolding — שווי ה-hero. לא midpoint של טווח STOCK Act. */
export function sumCongressPortfolioValue(
  holdings: CongressModelHolding[]
): number | null {
  let sum = 0;
  for (const h of holdings) {
    if (h.quiverBaselineHoldingUSD > 0) sum += h.quiverBaselineHoldingUSD;
  }
  return sum > 0 ? sum : null;
}

/** שווי תיק בפרופיל — דולרים שלמים עם פסיקים, בלי K/M/B. */
export function formatCongressPortfolioHeroValue(
  usd: number | null | undefined
): string {
  return formatUsdRawOrDash(usd);
}

/** דלתא USD — אותו raw, עם סימן. */
export function formatCongressDeltaUsd(usd: number): string {
  return formatSignedUsdRaw(usd);
}

/**
 * Mark-to-market של סל האחזקות הנוכחי מ-Quiver:
 * `CurrentHolding[t] × (price[d] / price[latest])`.
 * לא משחזר מניות מטווחי STOCK Act ולא משתמש ב-midpoint.
 * אם אין מספיק מחירי שוק — מערך ריק (המסך מסתיר גרף/דלתא).
 */
export function buildCongressBasketMarkToMarketSeries(
  holdings: CongressModelHolding[],
  pricesByTicker: Record<string, CongressBasketPricePoint[]>
): CongressBasketValuePoint[] {
  const totalUsd = sumCongressPortfolioValue(holdings);
  if (totalUsd == null) return [];

  const legs: Array<{
    usd: number;
    last: number;
    byDate: Map<string, number>;
  }> = [];

  for (const h of holdings) {
    if (!(h.quiverBaselineHoldingUSD > 0)) continue;
    const series = pricesByTicker[h.ticker.toUpperCase()] ?? [];
    const sorted = series
      .filter((p) => p.close > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) continue;
    legs.push({
      usd: h.quiverBaselineHoldingUSD,
      last: sorted[sorted.length - 1].close,
      byDate: new Map(sorted.map((p) => [p.date, p.close])),
    });
  }

  const coveredUsd = legs.reduce((s, l) => s + l.usd, 0);
  if (!legs.length || coveredUsd / totalUsd < CONGRESS_BASKET_MIN_COVERAGE) {
    return [];
  }

  const dateSet = new Set<string>();
  for (const l of legs) {
    for (const d of l.byDate.keys()) dateSet.add(d);
  }
  const dates = [...dateSet].sort();
  if (dates.length < CONGRESS_BASKET_MIN_POINTS) return [];

  const lastClose = legs.map(() => 0);
  const out: CongressBasketValuePoint[] = [];
  for (const date of dates) {
    let value = 0;
    let haveUsd = 0;
    for (let i = 0; i < legs.length; i++) {
      const px = legs[i].byDate.get(date);
      if (px != null && px > 0) lastClose[i] = px;
      if (!(lastClose[i] > 0) || !(legs[i].last > 0)) continue;
      value += legs[i].usd * (lastClose[i] / legs[i].last);
      haveUsd += legs[i].usd;
    }
    if (haveUsd / coveredUsd < CONGRESS_BASKET_MIN_COVERAGE) continue;
    out.push({ date, value });
  }

  if (out.length < CONGRESS_BASKET_MIN_POINTS) return [];
  const last = out[out.length - 1];
  out[out.length - 1] = { date: last.date, value: coveredUsd };
  return out;
}

/** Form 4 — דולרים שלמים עם פסיקים, בלי K/M/B. */
export function formatForm4Value(usd: number | null | undefined): string {
  return formatUsdRawOrDash(usd);
}

/**
 * Quiver CurrentHolding + Allocation בלבד.
 * לא מקבל טווחי STOCK Act ולא מוסיף PTR midpoint.
 */
export function congressHoldingsFromQuiver(
  rows: ActualCongressHolding[],
  opts?: { lastUpdatedFromPTR?: string | null; asOfDate?: string | null }
): CongressModelHolding[] {
  const out: CongressModelHolding[] = [];
  const fallbackAsOf = normalizeHoldingDate(opts?.asOfDate);
  for (const row of rows) {
    const ticker = row.ticker?.toUpperCase().trim();
    const bioguideId = row.bioguideId?.trim().toUpperCase();
    if (!ticker || !bioguideId) continue;
    // כבר מפורסר ב-`listCongressHoldingsByBioguide` — לא מפרשים טווח STOCK Act.
    const usd =
      row.currentValueUSD != null && Number.isFinite(row.currentValueUSD) && row.currentValueUSD > 0
        ? row.currentValueUSD
        : parseQuiverUsd(row.currentValueUSD);
    const alloc =
      row.portfolioPercent != null && Number.isFinite(row.portfolioPercent) && row.portfolioPercent >= 0
        ? row.portfolioPercent
        : quiverAllocationToPct(row.portfolioPercent);
    if (usd == null && alloc == null) continue;
    out.push({
      type: 'CONGRESS_BASELINE',
      ticker,
      bioguideId,
      quiverBaselineHoldingUSD: usd ?? 0,
      quiverAllocationPercent: alloc ?? 0,
      lastUpdatedFromPTR: opts?.lastUpdatedFromPTR ?? null,
      asOfDate: normalizeHoldingDate(row.asOfDate) ?? fallbackAsOf,
      vendorShares: row.vendorShares ?? null,
      vendorAvgCost: row.vendorAvgCost ?? null,
      vendorPriceChangePct: row.vendorPriceChangePct ?? null,
      isEstimated: true,
    });
  }
  return out.sort(
    (a, b) => b.quiverBaselineHoldingUSD - a.quiverBaselineHoldingUSD
  );
}

export function form4TradesFromInsiderRows(rows: InsiderBuyRow[]): Form4TradeInput[] {
  return rows
    .map((r) => {
      const ticker = String(r.ticker ?? '')
        .toUpperCase()
        .trim();
      const day = String(r.transaction_date ?? r.filed_at ?? '').slice(0, 10);
      const shares = Math.abs(Number(r.shares) || 0);
      const priceRaw = Number(r.price);
      const price = Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : null;
      const ownedRaw = Number(r.shares_owned_after);
      const shares_owned_after =
        Number.isFinite(ownedRaw) && ownedRaw >= 0 ? ownedRaw : null;
      const security = r.security_title?.trim() || null;
      const is_option = r.is_option === true || isForm4OptionRow({ is_option: r.is_option, security });
      if (!ticker || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
      if (!(shares > 0) && shares_owned_after == null) return null;
      return {
        ticker,
        transaction_date: day,
        transaction_code: String(r.transaction_type ?? 'P'),
        shares,
        price,
        shares_owned_after,
        is_option,
        security,
      } satisfies Form4TradeInput;
    })
    .filter((t): t is Form4TradeInput => t != null);
}

type Form4Position = {
  shares: number;
  lastPrice: number | null;
  lastDate: string | null;
  seededFromOwnedAfter: boolean;
  costUsd: number;
  hasUnknownBasis: boolean;
};

function applyForm4CostOnAdd(cur: Form4Position, qty: number, price: number | null): void {
  if (price != null && price > 0 && qty > 0) {
    cur.costUsd += qty * price;
    return;
  }
  // מענק / בלי מחיר — מוסיפים מניות בלי עלות. basis 0 נשאר 0 → מסתירים ROI.
}

function applyForm4CostOnSub(cur: Form4Position, sold: number): void {
  if (!(sold > 0) || !(cur.shares > 0)) return;
  if (cur.costUsd > 0) {
    cur.costUsd *= Math.max(0, cur.shares - sold) / cur.shares;
  }
}

function applyForm4TradeToPosition(cur: Form4Position, t: Form4TradeInput): void {
  const owned =
    t.shares_owned_after != null && Number.isFinite(t.shares_owned_after) && t.shares_owned_after >= 0
      ? t.shares_owned_after
      : null;
  const priced = t.price != null && t.price > 0 ? t.price : null;
  if (!cur.seededFromOwnedAfter && owned != null) {
    cur.shares = owned;
    cur.seededFromOwnedAfter = true;
    if (priced != null && t.shares > 0 && Math.abs(t.shares - owned) < 1e-6) {
      cur.costUsd = owned * priced;
      cur.hasUnknownBasis = false;
    } else if (priced != null && t.shares > 0 && t.shares < owned) {
      cur.costUsd = t.shares * priced;
      cur.hasUnknownBasis = true;
    } else {
      cur.costUsd = 0;
      cur.hasUnknownBasis = owned > 0;
    }
  } else {
    const sign = form4QtySign(t.transaction_code);
    if (sign === 0 && !(t.shares > 0)) return;
    if (sign !== 0 && t.shares > 0) {
      if (sign === 1) {
        applyForm4CostOnAdd(cur, t.shares, priced);
        cur.shares += t.shares;
      } else {
        const sold = Math.min(t.shares, cur.shares);
        applyForm4CostOnSub(cur, sold);
        cur.shares = Math.max(0, cur.shares - sold);
      }
    }
  }
  if (priced != null) cur.lastPrice = priced;
  cur.lastDate = t.transaction_date;
}

export function replayForm4Positions(
  trades: Form4TradeInput[]
): Map<string, Form4Position> {
  const pos = new Map<string, Form4Position>();
  const sorted = [...trades].sort((a, b) => {
    const d = a.transaction_date.localeCompare(b.transaction_date);
    if (d !== 0) return d;
    return form4QtySign(a.transaction_code) - form4QtySign(b.transaction_code);
  });

  for (const t of sorted) {
    if (isForm4OptionRow(t)) continue;
    const sign = form4QtySign(t.transaction_code);
    const owned =
      t.shares_owned_after != null && Number.isFinite(t.shares_owned_after)
        ? t.shares_owned_after
        : null;
    if (sign === 0 && owned == null) continue;
    const cur = pos.get(t.ticker) ?? emptyForm4Position();
    applyForm4TradeToPosition(cur, t);
    pos.set(t.ticker, cur);
  }
  return pos;
}

/**
 * אחזקות Form 4 בין הטיקרים הידועים של אותו אדם.
 * טיקר יחיד = 100% מהפוזיציה הידועה — לא מכל השווי הנטו.
 * מחיר: last trade price (או מחיר שוק שסופק מבחוץ).
 */
export function buildForm4Holdings(
  trades: Form4TradeInput[],
  quotesByTicker?: Map<string, number>
): InsiderForm4Holding[] {
  const pos = replayForm4Positions(trades);
  const rows: Array<Omit<InsiderForm4Holding, 'exactPortfolioWeight'>> = [];

  for (const [ticker, p] of pos) {
    if (!(p.shares > 0)) continue;
    const quote = quotesByTicker?.get(ticker);
    const quoted = quote != null && quote > 0;
    const sharePrice = quoted
      ? quote
      : p.lastPrice != null && p.lastPrice > 0
        ? p.lastPrice
        : null;
    if (sharePrice == null) continue;
    const avgCost =
      !p.hasUnknownBasis && p.costUsd > 0 && p.shares > 0 ? p.costUsd / p.shares : null;
    rows.push({
      type: 'INSIDER_FORM_4',
      ticker,
      exactShares: p.shares,
      sharePrice,
      calculatedValueUSD: p.shares * sharePrice,
      avgCost,
      // תשואה רק מול מחיר חי — לא מול last fill (זה 0% מזויף).
      entryReturnPct: quoted ? holdingReturnFromEntry(sharePrice, avgCost) : null,
      isEstimated: false,
    });
  }

  const total = rows.reduce((s, h) => s + h.calculatedValueUSD, 0);
  const holdings: InsiderForm4Holding[] = rows
    .map((h) => ({
      ...h,
      exactPortfolioWeight: total > 0 ? (h.calculatedValueUSD / total) * 100 : 0,
    }))
    .sort((a, b) => b.calculatedValueUSD - a.calculatedValueUSD);

  return holdings;
}

function emptyForm4Position(): Form4Position {
  return {
    shares: 0,
    lastPrice: null,
    lastDate: null,
    seededFromOwnedAfter: false,
    costUsd: 0,
    hasUnknownBasis: false,
  };
}

function form4PortfolioValue(
  pos: Map<string, Form4Position>,
  priceOf: (ticker: string) => number | null
): number {
  let value = 0;
  for (const [ticker, p] of pos) {
    if (!(p.shares > 0)) continue;
    const px = priceOf(ticker);
    if (px != null && px > 0) value += p.shares * px;
  }
  return value;
}

/** גרף ריצה — qty מצטבר × מחיר אחרון ידוע לכל טיקר. Form 4 בלבד (fallback בלי סדרת close). */
export function buildForm4ValueSeries(trades: Form4TradeInput[]): Form4ValuePoint[] {
  const pos = new Map<string, Form4Position>();
  const sorted = [...trades].sort((a, b) =>
    a.transaction_date.localeCompare(b.transaction_date)
  );
  const series: Form4ValuePoint[] = [];

  for (const t of sorted) {
    if (isForm4OptionRow(t)) continue;
    const sign = form4QtySign(t.transaction_code);
    const owned =
      t.shares_owned_after != null && Number.isFinite(t.shares_owned_after)
        ? t.shares_owned_after
        : null;
    if (sign === 0 && owned == null) continue;
    const cur = pos.get(t.ticker) ?? emptyForm4Position();
    applyForm4TradeToPosition(cur, t);
    pos.set(t.ticker, cur);

    const value = form4PortfolioValue(pos, (ticker) => pos.get(ticker)?.lastPrice ?? null);
    if (value <= 0) continue;
    const last = series[series.length - 1];
    if (last && last.date === t.transaction_date) {
      last.value = value;
    } else {
      series.push({ date: t.transaction_date, value });
    }
  }

  return series;
}

/**
 * Mark-to-market יומי: מניות מדווחות × close.
 * רק ימי מסחר (איחוד Yahoo). עסקה בסופ״ש נכנסת ביום המסחר הבא.
 * חג בלי בר לטיקר: יורשים את ה-close הקודם. בלי פיצול/דיבידנד מומצא.
 */
export function buildForm4MarkToMarketSeries(
  trades: Form4TradeInput[],
  pricesByTicker: Record<string, CongressBasketPricePoint[]>
): Form4ValuePoint[] {
  const equity = trades.filter((t) => !isForm4OptionRow(t));
  if (!equity.length) return [];

  const sorted = [...equity].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  const closeMaps = new Map<string, Map<string, number>>();
  let lastPriceDate: string | null = null;
  for (const [ticker, series] of Object.entries(pricesByTicker)) {
    const map = new Map<string, number>();
    for (const p of series) {
      if (!(p.close > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) continue;
      map.set(p.date, p.close);
      if (lastPriceDate == null || p.date > lastPriceDate) lastPriceDate = p.date;
    }
    if (map.size) closeMaps.set(ticker.toUpperCase(), map);
  }
  if (!closeMaps.size) return [];

  const start = sorted[0].transaction_date;
  const endTrade = sorted[sorted.length - 1].transaction_date;
  const end = lastPriceDate != null && lastPriceDate > endTrade ? lastPriceDate : endTrade;
  const days = unionTradingDates(pricesByTicker, start, end);
  if (days.length < 2) return [];

  const pos = new Map<string, Form4Position>();
  const lastClose = new Map<string, number>();
  const out: Form4ValuePoint[] = [];
  let tradeIdx = 0;

  for (const date of days) {
    while (tradeIdx < sorted.length && sorted[tradeIdx].transaction_date <= date) {
      const t = sorted[tradeIdx];
      tradeIdx += 1;
      const sign = form4QtySign(t.transaction_code);
      const owned =
        t.shares_owned_after != null && Number.isFinite(t.shares_owned_after)
          ? t.shares_owned_after
          : null;
      if (sign === 0 && owned == null) continue;
      const cur = pos.get(t.ticker) ?? emptyForm4Position();
      applyForm4TradeToPosition(cur, t);
      pos.set(t.ticker, cur);
    }

    for (const ticker of closeMaps.keys()) {
      const px = closeMaps.get(ticker)?.get(date);
      if (px != null && px > 0) lastClose.set(ticker, px);
    }

    const value = form4PortfolioValue(pos, (ticker) => {
      const inherited = lastClose.get(ticker);
      if (inherited != null && inherited > 0) return inherited;
      return pos.get(ticker)?.lastPrice ?? null;
    });
    if (value <= 0) continue;
    out.push({ date, value });
  }

  return out;
}
