/**
 * מדדים כנים לעסקאות קונגרס — בלי שחזור מניות / expectancy / win-rate מזויף.
 */

export function medianNumber(values: number[]): number | null {
  const xs = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
}

/**
 * % מהעסקאות שבהן ExcessReturn > 0.
 * דורש לפחות `minSample` ערכים מספריים — אחרת null (לא 0).
 */
export function beatSpyRate(
  excessReturns: Array<number | null | undefined>,
  minSample = 3
): { pct: number; n: number } | null {
  const xs = excessReturns.filter((n): n is number => n != null && Number.isFinite(n));
  if (xs.length < minSample) return null;
  const wins = xs.filter((n) => n > 0).length;
  return { pct: (wins / xs.length) * 100, n: xs.length };
}

export function formatBeatSpyLabel(rate: { pct: number; n: number } | null): string | null {
  if (!rate) return null;
  const pct = Math.round(rate.pct);
  return `היכה את S&P ב-${pct}% מהעסקאות (${rate.n})`;
}

export function formatAvgDelayDays(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days) || days < 0) return null;
  const n = Math.round(days);
  if (n === 0) return 'אותו יום';
  if (n === 1) return 'יום אחד';
  if (n === 2) return 'יומיים';
  return `${n} ימים`;
}

/** Allocation של Quiver הוא שבר 0–1 (אומת חי). */
export function quiverAllocationToPct(raw: number | string | null | undefined): number | null {
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/%/g, ''));
  if (!Number.isFinite(n)) return null;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return pct >= 0 && pct <= 100 ? pct : null;
}

export function parseQuiverUsd(raw: number | string | null | undefined): number | null {
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[$,]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}
