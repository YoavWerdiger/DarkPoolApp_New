/**
 * ארכיטקטורת מסך טיקר — כמו InsiderWave (הדר / מחיר+שווי שוק / מחזיקים|פיד).
 * עברית RTL. בלי כוכב, בלי מניות STOCK Act מומצאות.
 */

import { formatFeedTickerDisplay } from './feedTradeDisplay';
import { isolateData } from './bidi';
import { formatUsdRaw } from './usdRawFormat';

export type TickerScreenTab = 'holders' | 'feed';

export function resolveTickerScreenTab(
  raw: string | null | undefined
): TickerScreenTab {
  if (raw === 'feed' || raw === 'insider' || raw === 'darkpool') return 'feed';
  return 'holders';
}

export function tickerScreenHoldersTabLabel(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return n > 0 ? `מחזיקים (${n})` : 'מחזיקים';
}

export function tickerScreenFeedTabLabel(): string {
  return 'פיד';
}

export function tickerMarketCapLabel(): string {
  return 'שווי שוק';
}

/** שווי שוק מלא עם פסיקים — לא M/K/B. null אם אין מספר. */
export function formatTickerMarketCap(
  marketCap: number | null | undefined
): string | null {
  return formatUsdRaw(marketCap);
}

export function tickerFeedEmptyCopy(ticker: string): {
  title: string;
  body: string;
} {
  const isolated = isolateData(formatFeedTickerDisplay(ticker));
  return {
    title: 'אין עסקאות מדווחות',
    body: `לא נמצאו דיווחי קונגרס או Form 4 ל-${isolated}. לא ממציאים שורות.`,
  };
}
