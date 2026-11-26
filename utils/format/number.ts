/**
 * עיצוב מספרים — מקור אחד לכל האפליקציה (פריט 34). במקום פונקציות מקומיות בכל מסך:
 *   מחיר:   formatPrice(187.4) → "187.40",  formatPrice(187.4, { currency: '$' }) → "$187.40"
 *   אחוז:   formatPercentChange(1.234) → "+1.23%"  (תמיד עם סימן ו-2 ספרות)
 *   קומפקטי: formatCompact(1_250_000) → "1.3M"   (K / M / B / T)
 *   ווליום: formatVolume(48_210) → "48K"
 * ערך חסר / NaN → "—".
 */
export const MISSING = '—';

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** מחיר: 2 ספרות; מתחת ל-1 — 4 ספרות (מניות פני); מעל 1,000 — מפריד אלפים */
export function formatPrice(n: number | null | undefined, opts: { currency?: '$' | '₪' | ''; digits?: number } = {}): string {
  if (!isNum(n)) return MISSING;
  const digits = opts.digits ?? (Math.abs(n) > 0 && Math.abs(n) < 1 ? 4 : 2);
  const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${n < 0 ? '−' : ''}${opts.currency ?? ''}${body}`;
}

/** מספר עם סימן: +1.25 / −0.40 */
export function formatSigned(n: number | null | undefined, digits = 2): string {
  if (!isNum(n)) return MISSING;
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(digits)}`;
}

/** שינוי באחוזים — תמיד עם סימן ו-2 ספרות. arrows=true מוסיף ▲ / ▼ (נגישות לעיוורי צבעים) */
export function formatPercentChange(n: number | null | undefined, opts: { digits?: number; arrows?: boolean } = {}): string {
  if (!isNum(n)) return MISSING;
  const digits = opts.digits ?? 2;
  const arrow = opts.arrows ? (n > 0 ? '▲ ' : n < 0 ? '▼ ' : '') : '';
  return `${arrow}${formatSigned(n, digits)}%`;
}

/** אחוז בלי סימן (משקל בתיק, הסתברות): 12.5% */
export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (!isNum(n)) return MISSING;
  return `${n.toFixed(digits)}%`;
}

/** קומפקטי: 1.3K / 4.2M / 1.1B / 2.0T */
export function formatCompact(n: number | null | undefined, opts: { currency?: '$' | '₪' | ''; digits?: number } = {}): string {
  if (!isNum(n)) return MISSING;
  const abs = Math.abs(n);
  const d = opts.digits ?? 1;
  const cur = opts.currency ?? '';
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e12) return `${sign}${cur}${(abs / 1e12).toFixed(d)}T`;
  if (abs >= 1e9) return `${sign}${cur}${(abs / 1e9).toFixed(d)}B`;
  if (abs >= 1e6) return `${sign}${cur}${(abs / 1e6).toFixed(d)}M`;
  if (abs >= 1e3) return `${sign}${cur}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : d)}K`;
  return `${sign}${cur}${Math.round(abs)}`;
}

/** ווליום — קומפקטי בלי מטבע */
export function formatVolume(n: number | null | undefined): string {
  return formatCompact(n);
}

/** שינוי באחוזים ממחיר קודם (null אם אין בסיס) */
export function percentChange(price: number | null | undefined, previous: number | null | undefined): number | null {
  if (!isNum(price) || !isNum(previous) || previous <= 0) return null;
  return ((price - previous) / previous) * 100;
}
