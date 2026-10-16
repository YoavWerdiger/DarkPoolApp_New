/**
 * תיק אינסיידר מהמקור (SEC EDGAR) — יתרות מדווחות לכל קו אחזקה, לא שחזור מעסקאות.
 *
 * למה: השחזור מעסקאות מתחיל מ-0 בעסקה הראשונה שיש לנו (2023+), מתעלם ממניות שנצברו קודם
 * וממכירות כשהיתרה המשוחזרת 0 — ובפועל הציג פי 8–60 פחות מהאמת. form4api מערבב קווים
 * (Class A / Class B / RSU / נאמנויות) ולכן גם «היתרה אחרי» שלו קופצת.
 *
 * כאן:
 *  - שווי = Σ קווי מניות רגילות (ישיר + עקיף) × מחיר נוכחי. נגזרים (Class B, RSU, אופציות) לא נספרים.
 *  - גרף = יתרה ידועה לכל יום × מחיר; שינוי בכמות המניות הוא «זרימת הון» (external_flow), לא תשואה → TWR נקי.
 *  - עלות/מחיר כניסה לא ידועים (מניות מלפני הנתונים, מענקים) → basis_reliable=false, בלי תשואת פוזיציה.
 * עסקאות ממשיכות לשמש לאחוז הצלחה, עיכוב דיווח ומספר עסקאות.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';
import {
  type CongressPortfolioMetrics,
  type PortfolioHoldingMetric,
  type ValuePoint,
  computeConcentration,
  computeProfileScore,
  computeSeriesRisk,
  isChartSeriesReliable,
  periodReturn,
  priceOnOrBefore,
  sparsifyValueSeries,
  twrPeriodReturnPct,
  ytdReturn,
} from './congressPortfolio.ts';
import { isCommonEquityLine } from './edgarForm4.ts';

export interface InsiderOwnershipPoint {
  ticker: string;
  line_key: string;
  is_derivative: boolean;
  security_title: string | null;
  shares_owned: number;
  as_of_date: string;
}

/** קו שלא דווח שנתיים מאז הדיווח האחרון על אותה מניה — כנראה נסגר (נאמנות שפורקה וכו') */
const STALE_LINE_DAYS = 730;

export type InsiderOwnershipMetrics = CongressPortfolioMetrics & {
  ownership_source: 'sec_edgar';
  ownership_as_of: string;
};

export async function loadInsiderOwnershipPoints(
  supabase: SupabaseClient,
  cik: string
): Promise<InsiderOwnershipPoint[]> {
  const { data, error } = await supabase
    .from('insider_ownership_points')
    .select('ticker, line_key, is_derivative, security_title, shares_owned, as_of_date')
    .eq('insider_cik', cik)
    // נגזרים לא נספרים בשווי (חוץ ממניות Class B/C) — לא טוענים אופציות/RSU (זיכרון ב-materialize)
    .or('is_derivative.eq.false,security_title.ilike.%class b%,security_title.ilike.%class c%')
    .order('as_of_date', { ascending: true })
    .limit(3000);
  if (error || !data) return [];
  return (data as InsiderOwnershipPoint[])
    .map((p) => ({ ...p, ticker: String(p.ticker).toUpperCase(), shares_owned: Number(p.shares_owned) }))
    .filter((p) => isCommonEquityLine(p) && Number.isFinite(p.shares_owned));
}

/**
 * טיקרים שעדיין מוחזקים (יתרה אחרונה > 0 באחד הקווים) — רק להם צריך מחירים.
 * מוגבל למספר טיקרים כדי לא לטעון היסטוריית מחירים של כל מה שהאדם החזיק אי פעם.
 */
export function heldOwnershipTickers(points: InsiderOwnershipPoint[], max = 12): string[] {
  const latest = new Map<string, { date: string; shares: number; ticker: string }>();
  for (const p of points) {
    const k = `${p.ticker}|${p.line_key}`;
    const cur = latest.get(k);
    if (!cur || p.as_of_date >= cur.date) latest.set(k, { date: p.as_of_date, shares: p.shares_owned, ticker: p.ticker });
  }
  const byTicker = new Map<string, string>();
  for (const v of latest.values()) {
    if (!(v.shares > 0)) continue;
    const prev = byTicker.get(v.ticker);
    if (!prev || v.date > prev) byTicker.set(v.ticker, v.date);
  }
  return Array.from(byTicker.entries())
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, max)
    .map(([t]) => t);
}

/** ה-CIK השכיח בשורות של האדם (שם זהה יכול להופיע אצל כמה מגישים) */
export function dominantInsiderCik(rows: Array<{ insider_cik?: string | null }>): string | null {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const c = String(r.insider_cik ?? '').trim();
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [c, n] of counts) {
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

type Timeline = Array<{ date: string; shares: number }>;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ticker → line_key → נקודות יתרה ממוינות; בלי קווים ישנים */
function buildTimelines(points: InsiderOwnershipPoint[]): Map<string, Map<string, Timeline>> {
  const out = new Map<string, Map<string, Timeline>>();
  for (const p of points) {
    const lines = out.get(p.ticker) ?? new Map<string, Timeline>();
    const tl = lines.get(p.line_key) ?? [];
    tl.push({ date: p.as_of_date.slice(0, 10), shares: p.shares_owned });
    lines.set(p.line_key, tl);
    out.set(p.ticker, lines);
  }
  for (const [ticker, lines] of out) {
    let latest = '';
    for (const tl of lines.values()) {
      tl.sort((a, b) => a.date.localeCompare(b.date));
      const last = tl[tl.length - 1].date;
      if (last > latest) latest = last;
    }
    const cutoff = addDays(latest, -STALE_LINE_DAYS);
    for (const [key, tl] of lines) {
      if (tl[tl.length - 1].date < cutoff) lines.delete(key);
    }
    if (!lines.size) out.delete(ticker);
  }
  return out;
}

function sharesOn(lines: Map<string, Timeline>, day: string): number {
  let total = 0;
  for (const tl of lines.values()) {
    let v: number | null = null;
    for (const p of tl) {
      if (p.date <= day) v = p.shares;
      else break;
    }
    if (v != null) total += v;
  }
  return total;
}

function latestPrice(priceMap: Map<string, number> | undefined): number {
  if (!priceMap || !priceMap.size) return 0;
  const last = Array.from(priceMap.keys()).sort().pop()!;
  return priceMap.get(last) ?? 0;
}

/**
 * מחזיר null כשאין יתרות מדווחות (עוד לא נקרא מ-EDGAR) — הקורא נשאר עם השחזור הישן.
 * `fromTrades` — מדדי עסקאות (אחוז הצלחה, עיכוב, מספר עסקאות) מהמנוע הקיים.
 */
export function buildInsiderOwnershipMetrics(
  points: InsiderOwnershipPoint[],
  pricesByTicker: Map<string, Map<string, number>>,
  fromTrades: CongressPortfolioMetrics | null
): InsiderOwnershipMetrics | null {
  const timelines = buildTimelines(points);
  if (!timelines.size) return null;

  // אחזקות נוכחיות
  const holdings: PortfolioHoldingMetric[] = [];
  let totalValue = 0;
  let asOf = '';
  for (const [ticker, lines] of timelines) {
    const today = new Date().toISOString().slice(0, 10);
    const qty = sharesOn(lines, today);
    let firstDate: string | null = null;
    for (const tl of lines.values()) {
      if (tl[tl.length - 1].date > asOf) asOf = tl[tl.length - 1].date;
      if (!firstDate || tl[0].date < firstDate) firstDate = tl[0].date;
    }
    const px = latestPrice(pricesByTicker.get(ticker));
    if (!(qty > 0) || !(px > 0)) continue;
    const mv = qty * px;
    totalValue += mv;
    holdings.push({
      ticker,
      qty,
      cost_usd: 0,
      current_price: px,
      market_value: mv,
      allocation_pct: 0,
      return_pct: 0,
      first_added_date: firstDate,
      basis_reliable: false,
      qty_disclosed: true,
      entry_price: null,
    });
  }
  if (!holdings.length) return null;
  holdings.sort((a, b) => b.market_value - a.market_value);
  for (const h of holdings) {
    h.allocation_pct = totalValue > 0 ? Math.round((h.market_value / totalValue) * 1000) / 10 : 0;
  }

  // סדרה יומית: כמות ידועה × מחיר; שינוי כמות = זרימת הון
  let start = '';
  for (const lines of timelines.values()) {
    for (const tl of lines.values()) if (!start || tl[0].date < start) start = tl[0].date;
  }
  const dateSet = new Set<string>();
  for (const h of holdings) {
    for (const d of pricesByTicker.get(h.ticker)?.keys() ?? []) if (d >= start) dateSet.add(d);
  }
  const dates = Array.from(dateSet).sort();
  const fullSeries: ValuePoint[] = [];
  const prevQty = new Map<string, number>();
  for (const day of dates) {
    let value = 0;
    let flow = 0;
    for (const h of holdings) {
      const lines = timelines.get(h.ticker)!;
      const q = sharesOn(lines, day);
      const px = priceOnOrBefore(pricesByTicker.get(h.ticker) ?? new Map(), day) ?? 0;
      if (!(px > 0)) continue;
      const before = prevQty.get(h.ticker);
      if (before != null && q !== before) flow += (q - before) * px;
      prevQty.set(h.ticker, q);
      value += q * px;
    }
    if (value > 0) {
      fullSeries.push({ date: day, value, ...(flow !== 0 ? { external_flow: flow } : {}) });
    }
  }

  const series = sparsifyValueSeries(fullSeries, 7);
  const tradeCount = fromTrades?.trade_count ?? 0;
  const allReturn = twrPeriodReturnPct(fullSeries);
  const risk = computeSeriesRisk(fullSeries);
  const concentration = computeConcentration(holdings);
  const winRate = fromTrades?.win_rate ?? null;
  const score = computeProfileScore({
    totalReturnPct: allReturn ?? 0,
    winRate,
    sharpe: risk.sharpe,
    hhi: concentration.hhi,
    tradeCount,
  });

  return {
    portfolio_value: Math.round(totalValue * 100) / 100,
    // עלות לא ידועה (מניות מלפני הנתונים / מענקים) — לא ממציאים
    total_cost: 0,
    total_return_usd: 0,
    total_return_pct: allReturn ?? 0,
    series,
    chart_reliable: isChartSeriesReliable(series, Math.max(tradeCount, series.length >= 2 ? 3 : 0)),
    holdings,
    period_returns: {
      '1D': periodReturn(fullSeries, 1),
      '1W': periodReturn(fullSeries, 7),
      '1M': periodReturn(fullSeries, 30),
      '3M': periodReturn(fullSeries, 90),
      YTD: ytdReturn(fullSeries),
      '1Y': periodReturn(fullSeries, 365),
      '5Y': periodReturn(fullSeries, 365 * 5),
      ALL: allReturn,
    },
    win_rate: winRate,
    avg_delay_days: fromTrades?.avg_delay_days ?? null,
    trade_count: tradeCount,
    risk,
    concentration,
    score,
    ownership_source: 'sec_edgar',
    ownership_as_of: asOf,
  };
}
