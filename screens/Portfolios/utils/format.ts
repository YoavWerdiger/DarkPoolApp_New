/**
 * עוזרי פורמט – מספרים, אחוזים, תאריכים, מטבעות.
 */

import { SUPPORTED_CURRENCIES } from '../portfolioConstants';

export function getCurrencySymbol(code: string): string {
  const cur = SUPPORTED_CURRENCIES.find((c) => c.code === code.toUpperCase());
  return cur?.symbol ?? code;
}

const NBSP = '\u00A0';

/** מציג מספר עם פסיקים: 1,234.56 */
export function formatNumber(
  n: number | null | undefined,
  decimals = 2
): string {
  if (n == null || !isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const fixed = abs.toFixed(decimals);
  const [intPart, fracPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${withCommas}${fracPart ? `.${fracPart}` : ''}`;
}

/** מציג סכום בפורמט מטבע: $1,234.56 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'USD',
  decimals = 2
): string {
  if (value == null || !isFinite(value)) return '—';
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${NBSP}${formatNumber(value, decimals)}`;
}

/** מציג אחוז: +12.34% / -5.67% */
export function formatPercent(
  value: number | null | undefined,
  decimals = 2,
  showSign = true
): string {
  if (value == null || !isFinite(value)) return '—';
  const sign = showSign ? (value > 0 ? '+' : '') : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/** מספר קומפקטי – 1.2K / 3.4M / 5.6B */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(2)}K`;
  return `${sign}${abs.toFixed(2)}`;
}

/** תאריך ל-dd/mm/yyyy */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** תאריך עם שעה (קצר) */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** עברית: לפני 3 ימים / אתמול / היום */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const now = Date.now();
  const diffDays = Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  if (diffDays < 30) return `לפני ${Math.floor(diffDays / 7)} שבועות`;
  if (diffDays < 365) return `לפני ${Math.floor(diffDays / 30)} חודשים`;
  return `לפני ${Math.floor(diffDays / 365)} שנים`;
}

/** מחזיר צבע לפי ערך חיובי/שלילי */
export function gainColor(
  value: number | null | undefined,
  positive: string,
  negative: string,
  neutral: string
): string {
  if (value == null) return neutral;
  if (value > 0) return positive;
  if (value < 0) return negative;
  return neutral;
}

/** צבע לאחוז הצלחה (מול 50%) */
export function winRateColor(
  winRatePct: number | null | undefined,
  positive: string,
  negative: string,
  neutral: string
): string {
  if (winRatePct == null || !isFinite(winRatePct)) return neutral;
  if (winRatePct > 50) return positive;
  if (winRatePct < 50) return negative;
  return neutral;
}
