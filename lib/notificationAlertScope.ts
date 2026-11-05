import i18n from './i18n';
/**
 * היקף התראות דיווחי רווח / יומן כלכלי.
 * «הכול» כשהקטגוריה כבר דלוקה; אחרת «לפי הבחירה שלי» בלי לשלוח הכול.
 */

export type NotificationAlertScope = 'all' | 'selected';

export const ECONOMIC_ALERT_INDICATORS = [
  { key: 'cpi', title: 'מדד המחירים לצרכן' },
  { key: 'pce', title: 'מדד מחירי הצריכה' },
  { key: 'nfp', title: 'תעסוקה' },
  { key: 'fomc', title: 'ריבית הפד' },
  { key: 'gdp', title: 'תוצר' },
  { key: 'claims', title: 'תביעות אבטלה' },
  { key: 'ism', title: 'מדד מנהלי הרכש' },
  { key: 'retail', title: 'מכירות קמעונאיות' },
] as const;

export type EconomicAlertIndicatorKey = (typeof ECONOMIC_ALERT_INDICATORS)[number]['key'];

const ECONOMIC_KEY_NEEDLES: Record<EconomicAlertIndicatorKey, string[]> = {
  cpi: ['cpi', 'consumer price', i18n.t('auto.lib__notificationAlertScope.s1')],
  pce: ['pce', 'personal consumption', i18n.t('auto.lib__notificationAlertScope.s2')],
  nfp: ['nonfarm', 'non-farm', 'nfp', i18n.t('auto.lib__notificationAlertScope.s3')],
  fomc: ['fomc', 'fed funds', 'federal funds', i18n.t('auto.lib__notificationAlertScope.s4')],
  gdp: ['gdp', 'gross domestic', i18n.t('auto.lib__notificationAlertScope.s5')],
  claims: ['jobless', 'initial claims', i18n.t('auto.lib__notificationAlertScope.s6')],
  ism: ['ism', i18n.t('auto.lib__notificationAlertScope.s7')],
  retail: ['retail sales', i18n.t('auto.lib__notificationAlertScope.s8')],
};

export function resolveAlertScope(raw: unknown, categoryOn: boolean): NotificationAlertScope {
  if (raw === 'all' || raw === 'selected') return raw;
  return categoryOn ? 'all' : 'selected';
}

export function asSymbolList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const symbol = item.trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
  }
  return out;
}

export function asIndicatorKeys(raw: unknown): EconomicAlertIndicatorKey[] {
  const allowed = new Set<string>(ECONOMIC_ALERT_INDICATORS.map((item) => item.key));
  return asSymbolList(raw)
    .map((key) => key.toLowerCase())
    .filter((key): key is EconomicAlertIndicatorKey => allowed.has(key));
}

export function earningsUserWantsTicker(
  scope: NotificationAlertScope,
  symbols: string[],
  ticker: string,
): boolean {
  if (scope !== 'selected') return true;
  const want = ticker.trim().toUpperCase();
  if (!want) return false;
  return symbols.some((symbol) => symbol.trim().toUpperCase() === want);
}

/**
 * «הכול» משאיר את ההתראות על כל רשימת המעקב.
 * «לפי הבחירה שלי» עם null = כל הטיקרים דלוקים. מערך = רק המתגים שנשארו דלוקים.
 */
export function watchlistUserWantsSymbol(
  scope: NotificationAlertScope,
  picked: string[] | null,
  symbol: string,
): boolean {
  if (scope !== 'selected' || picked == null) return true;
  const want = symbol.trim().toUpperCase();
  if (!want) return false;
  return picked.some((item) => item.trim().toUpperCase() === want);
}

export function economicTitleMatchesKeys(title: string, keys: string[]): boolean {
  const haystack = title.toLowerCase();
  if (!haystack) return false;
  return keys.some((key) => {
    const needles = ECONOMIC_KEY_NEEDLES[key as EconomicAlertIndicatorKey];
    if (!needles) return false;
    return needles.some((needle) => haystack.includes(needle.toLowerCase()));
  });
}
