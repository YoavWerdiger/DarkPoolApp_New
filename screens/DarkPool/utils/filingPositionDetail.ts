/**
 * פרטי פוזיציה מ-13F (קרן / חברה) — מההיסטוריה הרבעונית שכבר נטענת לפרופיל (בלי קריאה נוספת לשרת).
 *
 * 13F מדווח כמות ושווי בסוף כל רבעון — לא עסקאות. «עסקה» כאן = השינוי בכמות בין שני דיווחים:
 * קנייה (עלייה), מכירה (ירידה), פוזיציה חדשה, יציאה מלאה. המחיר = שווי/כמות בדיווח (מחיר סוף הרבעון),
 * לכן הוא משוער — המסך אומר את זה.
 */
import { normalizeFiling13FRows, type Filing13FRow } from './filingChartSeries';
import { implied13FMarkPrice, replay13FAvgCost } from './holdingEntryReturn';

export type FilingTxnSide = 'new' | 'buy' | 'sell' | 'exit';

export interface FilingPositionTxn {
  /** תאריך הדיווח (סוף הרבעון) */
  date: string;
  side: FilingTxnSide;
  /** כמות המניות שהשתנתה (תמיד חיובי) */
  shares: number;
  /** מחיר משוער — שווי/כמות בדיווח; ביציאה: מחיר הדיווח הקודם */
  price: number | null;
  totalUsd: number | null;
}

export interface FilingPositionDetail {
  ticker: string;
  /** כמות בדיווח האחרון של הקרן (0 = יצאה) */
  shares: number;
  /** שווי מדווח בדיווח האחרון */
  reportedValueUsd: number | null;
  /** מחיר ממוצע משוחזר (קניות לפי מחיר הרבעון) */
  avgCost: number | null;
  /** תאריך הדיווח האחרון של הקרן */
  asOf: string | null;
  /** מהישן לחדש */
  transactions: FilingPositionTxn[];
}

/** שורות כפולות לאותו טיקר באותו דיווח (סוגי מניות / שורות נפרדות) — מצורפות */
function aggregateByFiling(rows: Filing13FRow[], ticker: string) {
  const byDate = new Map<string, { shares: number | null; value: number | null }>();
  for (const r of rows) {
    if (r.ticker !== ticker) continue;
    const cur = byDate.get(r.filing_date) ?? { shares: null, value: null };
    if (r.shares != null) cur.shares = (cur.shares ?? 0) + r.shares;
    if (r.value_usd != null) cur.value = (cur.value ?? 0) + r.value_usd;
    byDate.set(r.filing_date, cur);
  }
  return byDate;
}

export function build13FPositionDetail(
  rawRows: Filing13FRow[],
  rawTicker: string
): FilingPositionDetail | null {
  const ticker = rawTicker.toUpperCase().trim();
  const rows = normalizeFiling13FRows(rawRows);
  if (!rows.length || !ticker) return null;

  // כל תאריכי הדיווח של הקרן — טיקר שנעלם מדיווח = יציאה מלאה
  const filingDates = [...new Set(rows.map((r) => r.filing_date))].sort();
  const mine = aggregateByFiling(rows, ticker);
  if (!mine.size) return null;

  const transactions: FilingPositionTxn[] = [];
  let prevShares = 0;
  let prevPrice: number | null = null;
  for (const date of filingDates) {
    const hit = mine.get(date);
    const shares = hit?.shares ?? 0;
    const price = hit ? implied13FMarkPrice(hit.value, hit.shares) : null;
    const delta = shares - prevShares;
    if (delta !== 0 && (hit?.shares != null || !hit)) {
      const side: FilingTxnSide =
        prevShares === 0 ? 'new' : shares === 0 ? 'exit' : delta > 0 ? 'buy' : 'sell';
      const px = side === 'exit' ? prevPrice : price;
      const qty = Math.abs(delta);
      transactions.push({
        date,
        side,
        shares: qty,
        price: px,
        totalUsd: px != null ? qty * px : null,
      });
    }
    if (hit?.shares != null || !hit) prevShares = shares;
    if (price != null) prevPrice = price;
  }

  const asOf = filingDates[filingDates.length - 1] ?? null;
  const latest = asOf ? mine.get(asOf) : undefined;
  const avg = replay13FAvgCost(rows.filter((r) => r.ticker === ticker)).get(ticker);

  return {
    ticker,
    shares: latest?.shares ?? 0,
    reportedValueUsd: latest?.value ?? null,
    avgCost: avg?.avgCost ?? null,
    asOf,
    transactions,
  };
}
