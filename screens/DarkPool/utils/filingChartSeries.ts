/**
 * 13F whale chart — historical filings × daily closes.
 *
 * Between quarters the last known book is marked to market:
 *   shares_i × P_i,d   or, if shares are missing,
 *   value_usd_i × (P_i,d / P_i,filing).
 * Trading days only. No STOCK Act ranges. No linear 2-point interpolate.
 */

import type { CongressBasketPricePoint } from './investorHoldings';

export interface Filing13FRow {
  filing_date: string;
  ticker: string;
  shares: number | null;
  value_usd: number | null;
}

export interface Filing13FValuePoint {
  date: string;
  value: number;
}

/** כמה טיקרים מהספר הרבעוני נכנסים ל-MTM — השאר זנב שלא משנה את הצורה. */
export const FILING_CHART_TOP_N = 30;
export const FILING_CHART_MAX_TICKERS = 40;
export const FILING_CHART_MIN_COVERAGE = 0.55;
export const FILING_CHART_MIN_POINTS = 5;

function isoDay(raw: string | null | undefined): string | null {
  const d = String(raw ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function cleanTicker(raw: string | null | undefined): string | null {
  const t = String(raw ?? '')
    .toUpperCase()
    .trim();
  return t.length > 0 && t.length <= 8 ? t : null;
}

/**
 * ספר 13F נוכחי כשורות דיווח — filing_date = יום המחיר הראשון
 * כדי לסמן את הספר האחרון לכל יום מסחר, בלי שתי נקודות רבעוניות.
 */
export function latestBookRowsFromHoldings(
  holdings: Array<{
    ticker: string;
    shares?: number | null;
    value_usd?: number | null;
  }>,
  /** תאריך 13F אחרון — לא תחילת סדרת Yahoo (שובר יחס value/close). */
  filingDate?: string | null
): Filing13FRow[] {
  const asOf = isoDay(filingDate);
  if (!asOf) return [];
  return holdings.map((h) => ({
    filing_date: asOf,
    ticker: h.ticker,
    shares: h.shares ?? null,
    value_usd: h.value_usd ?? null,
  }));
}

/** MTM על טופ-N — מכפיל לשווי 13F המדווח של אותו רבעון. */
export function scale13FChartToReportedBook(
  series: Filing13FValuePoint[],
  reportedBookUsd: number | null | undefined
): Filing13FValuePoint[] {
  if (!series.length) return series;
  const book = Number(reportedBookUsd);
  if (!(book > 0)) return series;
  const last = series[series.length - 1]?.value;
  if (!(last > 0)) return series;
  const ratio = book / last;
  if (!Number.isFinite(ratio) || ratio < 1.02) return series;
  return series.map((p) => ({
    date: p.date,
    value: Math.round(p.value * ratio * 100) / 100,
  }));
}

export function normalizeFiling13FRows(rows: Filing13FRow[]): Filing13FRow[] {
  const out: Filing13FRow[] = [];
  for (const row of rows) {
    const filing_date = isoDay(row.filing_date);
    const ticker = cleanTicker(row.ticker);
    if (!filing_date || !ticker) continue;
    const shares =
      row.shares != null && Number.isFinite(row.shares) && row.shares > 0
        ? row.shares
        : null;
    const value_usd =
      row.value_usd != null && Number.isFinite(row.value_usd) && row.value_usd > 0
        ? row.value_usd
        : null;
    if (shares == null && value_usd == null) continue;
    out.push({ filing_date, ticker, shares, value_usd });
  }
  return out;
}

/**
 * טיקרים למחירי Yahoo: טופ של הרבעון האחרון + טיקרים שחזרו בטופ של רבעונים קודמים.
 */
export function select13FPriceTickers(
  rows: Filing13FRow[],
  max = FILING_CHART_MAX_TICKERS
): string[] {
  const clean = normalizeFiling13FRows(rows);
  if (!clean.length) return [];

  const byFiling = new Map<string, Filing13FRow[]>();
  for (const row of clean) {
    const list = byFiling.get(row.filing_date) ?? [];
    list.push(row);
    byFiling.set(row.filing_date, list);
  }

  const score = new Map<string, number>();
  const bump = (ticker: string, usd: number) => {
    score.set(ticker, Math.max(score.get(ticker) ?? 0, usd));
  };

  const dates = [...byFiling.keys()].sort();
  const latest = dates[dates.length - 1];
  for (const [date, list] of byFiling) {
    const ranked = [...list].sort(
      (a, b) => (b.value_usd ?? 0) - (a.value_usd ?? 0)
    );
    const keep = date === latest ? FILING_CHART_TOP_N : Math.min(10, FILING_CHART_TOP_N);
    for (const row of ranked.slice(0, keep)) {
      bump(row.ticker, row.value_usd ?? 0);
    }
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([ticker]) => ticker);
}

type FilingBookLeg = {
  ticker: string;
  shares: number | null;
  valueUsd: number | null;
};

function bookFromRows(rows: Filing13FRow[]): FilingBookLeg[] {
  const byTicker = new Map<string, FilingBookLeg>();
  for (const row of rows) {
    const prev = byTicker.get(row.ticker);
    if (!prev) {
      byTicker.set(row.ticker, {
        ticker: row.ticker,
        shares: row.shares,
        valueUsd: row.value_usd,
      });
      continue;
    }
    byTicker.set(row.ticker, {
      ticker: row.ticker,
      shares: row.shares ?? prev.shares,
      valueUsd:
        row.value_usd != null
          ? (prev.valueUsd ?? 0) + row.value_usd
          : prev.valueUsd,
    });
  }
  return [...byTicker.values()].sort(
    (a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0)
  );
}

function closeMapsFromPrices(
  pricesByTicker: Record<string, CongressBasketPricePoint[]>
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const [ticker, series] of Object.entries(pricesByTicker)) {
    const map = new Map<string, number>();
    for (const p of series) {
      if (!(p.close > 0) || !isoDay(p.date)) continue;
      map.set(p.date, p.close);
    }
    if (map.size) out.set(ticker.toUpperCase(), map);
  }
  return out;
}

function closeOnOrBeforeInMap(
  map: Map<string, number> | undefined,
  day: string
): number | null {
  if (!map?.size) return null;
  let best: { date: string; close: number } | null = null;
  for (const [date, close] of map) {
    if (date > day || !(close > 0)) continue;
    if (!best || date > best.date) best = { date, close };
  }
  return best?.close ?? null;
}

/**
 * Mark-to-market יומי של ספרי 13F.
 * ריק אם אין לפחות שני רבעונים / כיסוי מחירים — עדיף גרף ריק מכזב.
 */
export function build13FMarkToMarketSeries(
  rows: Filing13FRow[],
  pricesByTicker: Record<string, CongressBasketPricePoint[]>
): Filing13FValuePoint[] {
  const clean = normalizeFiling13FRows(rows);
  if (!clean.length) return [];

  const byFiling = new Map<string, Filing13FRow[]>();
  for (const row of clean) {
    const list = byFiling.get(row.filing_date) ?? [];
    list.push(row);
    byFiling.set(row.filing_date, list);
  }

  const filingDates = [...byFiling.keys()].sort();
  const books = filingDates.map((date) => ({
    date,
    legs: bookFromRows(byFiling.get(date) ?? []).slice(0, FILING_CHART_TOP_N),
  }));
  if (!books.length) return [];

  const closeMaps = closeMapsFromPrices(pricesByTicker);
  if (!closeMaps.size) return [];

  const dateSet = new Set<string>();
  for (const map of closeMaps.values()) {
    for (const d of map.keys()) dateSet.add(d);
  }
  const start = books[0].date;
  const dates = [...dateSet].filter((d) => d >= start).sort();
  if (dates.length < FILING_CHART_MIN_POINTS) return [];

  const lastClose = new Map<string, number>();
  const out: Filing13FValuePoint[] = [];
  let bookIdx = 0;

  for (const date of dates) {
    while (bookIdx + 1 < books.length && books[bookIdx + 1].date <= date) {
      bookIdx += 1;
    }
    if (books[bookIdx].date > date) continue;

    for (const [ticker, map] of closeMaps) {
      const px = map.get(date);
      if (px != null && px > 0) lastClose.set(ticker, px);
    }

    const book = books[bookIdx];
    let value = 0;
    let haveUsd = 0;
    let bookUsd = 0;

    for (const leg of book.legs) {
      const weight = leg.valueUsd != null && leg.valueUsd > 0 ? leg.valueUsd : 0;
      if (weight > 0) bookUsd += weight;
      const live = lastClose.get(leg.ticker);
      if (!(live > 0)) continue;

      if (leg.shares != null && leg.shares > 0) {
        value += leg.shares * live;
        haveUsd += weight > 0 ? weight : leg.shares * live;
        continue;
      }
      if (leg.valueUsd != null && leg.valueUsd > 0) {
        const filingPx = closeOnOrBeforeInMap(closeMaps.get(leg.ticker), book.date);
        if (!(filingPx != null && filingPx > 0)) continue;
        value += leg.valueUsd * (live / filingPx);
        haveUsd += leg.valueUsd;
      }
    }

    const denom = bookUsd > 0 ? bookUsd : haveUsd;
    if (!(value > 0) || !(denom > 0) || haveUsd / denom < FILING_CHART_MIN_COVERAGE) {
      continue;
    }
    out.push({ date, value });
  }

  return out.length >= FILING_CHART_MIN_POINTS ? out : [];
}
