import i18n from '../../../lib/i18n';
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
  return n > 0 ? i18n.t('auto.screens__DarkPool__utils__tickerScreenIa.s1', { v0: n }) : i18n.t('auto.screens__DarkPool__utils__tickerScreenIa.s2');
}

export function tickerScreenFeedTabLabel(): string {
  return i18n.t('auto.screens__DarkPool__utils__tickerScreenIa.s3');
}

export function tickerMarketCapLabel(): string {
  return i18n.t('auto.screens__DarkPool__utils__tickerScreenIa.s4');
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
    title: i18n.t('auto.screens__DarkPool__utils__tickerScreenIa.s5'),
    body: i18n.t('auto.screens__DarkPool__utils__tickerScreenIa.s6', { v0: isolated }),
  };
}
