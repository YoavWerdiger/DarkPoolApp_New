import {
  readDailyClosesFromDisk,
  writeDailyClosesToDisk,
} from '../../../lib/dailyClosesDiskCache';
import { getHistoricalPrices } from '../../../services/portfolios/portfolioPriceFeed';
import type { CongressBasketPricePoint } from './investorHoldings';

export const MAX_BASKET_TICKERS = 40;
const CHUNK = 4;

/**
 * מחירי close יומיים — Yahoo `getHistoricalPrices` (chart v8).
 * אין ב-repo נתיב UW `/stock/{ticker}/historical-prices`; candles של UW הם intraday.
 * לא midpoint של STOCK Act. בלי פיצול מומצא — ה-helper מחזיר raw close.
 * Yahoo `max` יורד ל-1mo/3mo — רק 1y/5y + interval=1d.
 */
export async function fetchDailyClosesForTickers(
  tickers: string[],
  range: '1y' | '5y' = '5y'
): Promise<Record<string, CongressBasketPricePoint[]>> {
  const unique = Array.from(
    new Set(
      tickers
        .map((t) => t.toUpperCase().trim())
        .filter((t) => t.length > 0 && t.length <= 8)
    )
  ).slice(0, MAX_BASKET_TICKERS);

  const out: Record<string, CongressBasketPricePoint[]> = {};
  const needFetch: string[] = [];
  await Promise.all(
    unique.map(async (sym) => {
      const cached = await readDailyClosesFromDisk(sym, range);
      if (cached) {
        out[sym] = cached;
      } else {
        needFetch.push(sym);
      }
    })
  );

  for (let i = 0; i < needFetch.length; i += CHUNK) {
    const chunk = needFetch.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (sym) => {
        const points = await getHistoricalPrices(sym, range, { interval: '1d' });
        const mapped = points.map((p) => ({
          date: p.date.slice(0, 10),
          close: p.close,
          open: p.open != null && p.open > 0 ? p.open : null,
        }));
        out[sym] = mapped;
        void writeDailyClosesToDisk(sym, range, mapped);
      })
    );
  }
  return out;
}

/** סל Quiver הנוכחי — 5y יומי כדי ש-1M/1Y/5Y ייחתכו מאותה סדרה צפופה. */
export async function fetchCongressBasketDailyCloses(
  tickers: string[]
): Promise<Record<string, CongressBasketPricePoint[]>> {
  return fetchDailyClosesForTickers(tickers, '5y');
}

/** טיקרי Form 4 — 5y כדי לכסות היסטוריית דיווחים. */
export async function fetchForm4DailyCloses(
  tickers: string[]
): Promise<Record<string, CongressBasketPricePoint[]>> {
  return fetchDailyClosesForTickers(tickers, '5y');
}

/**
 * ברים תוך-יומיים לפי טווח הגרף — כמה שיותר סנאפשוטים בלי להעמיס:
 * 1D = 5 דקות של היום, 1W = 15 דקות של 5 ימים, 1M = שעה של חודש.
 * שאר הטווחים — רק היום ב-5 דקות (הזנב החי); ההיסטוריה שלהם יומית ממילא.
 * נשלף רק לטווח שנבחר (react-query לפי המפתח) — בחירת 1W/1M היא שמוסיפה את הקריאות שלה.
 */
export type IntradaySpec = { range: '1d' | '5d' | '1mo'; interval: '5m' | '15m' | '1h' };
export function intradaySpecForPeriod(period: string): IntradaySpec {
  if (period === '1W') return { range: '5d', interval: '15m' };
  if (period === '1M') return { range: '1mo', interval: '1h' };
  return { range: '1d', interval: '5m' };
}

export async function fetchIntradayCloses(
  tickers: string[],
  spec: IntradaySpec
): Promise<Record<string, { date: string; close: number }[]>> {
  const unique = Array.from(
    new Set(
      tickers
        .map((t) => t.toUpperCase().trim())
        .filter((t) => t.length > 0 && t.length <= 8)
    )
  ).slice(0, MAX_BASKET_TICKERS);
  const out: Record<string, { date: string; close: number }[]> = {};
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (sym) => {
        const points = await getHistoricalPrices(sym, spec.range, { interval: spec.interval });
        out[sym] = points
          .filter((p) => p.close > 0 && /T\d{2}:/.test(p.date))
          .map((p) => ({ date: p.date, close: p.close }));
      })
    );
  }
  return out;
}

/** ברי שעה של היום — סנאפשוט לסשן, לא סגירה יומית אחת. */
export async function fetchSessionHourlyCloses(
  tickers: string[]
): Promise<Record<string, { date: string; close: number }[]>> {
  const unique = Array.from(
    new Set(
      tickers
        .map((t) => t.toUpperCase().trim())
        .filter((t) => t.length > 0 && t.length <= 8)
    )
  ).slice(0, MAX_BASKET_TICKERS);
  const out: Record<string, { date: string; close: number }[]> = {};
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (sym) => {
        // 5 דקות — ~78 סנאפשוטים בסשן (שעתי נתן ~7 נקודות בלבד ב-1D)
        const points = await getHistoricalPrices(sym, '1d', { interval: '5m' });
        out[sym] = points
          .filter((p) => p.close > 0 && /T\d{2}:/.test(p.date))
          .map((p) => ({ date: p.date, close: p.close }));
      })
    );
  }
  return out;
}

/** 13F — 5y כדי לסמן לשוק בין רבעונים כמו אצל קתי ווד. */
export async function fetch13FDailyCloses(
  tickers: string[]
): Promise<Record<string, CongressBasketPricePoint[]>> {
  return fetchDailyClosesForTickers(tickers, '5y');
}
