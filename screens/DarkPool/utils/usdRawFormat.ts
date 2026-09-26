/** דולרים שלמים עם פסיקים — בלי K/M/B. ללא imports (נמנע מעגל holdingEntryReturn ↔ investorHoldings). */

export function formatUsdRaw(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

export function formatUsdRawOrDash(v: number | null | undefined): string {
  return formatUsdRaw(v) ?? '—';
}

export function formatSignedUsdRaw(usd: number): string {
  const n = Math.round(usd);
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US')}`;
}
