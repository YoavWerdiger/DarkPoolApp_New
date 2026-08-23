/**
 * darkPoolFormat.ts
 * -----------------------------------------------------------------------------
 * פורמטרים משותפים לקומפוננטות ה-Dark Pool.
 */

/** עטיפת LTR isolate — שומרת `$1.1K` אטומי ליד עברית (בידי RTL) */
export function ltrEmbed(s: string): string {
  return `\u2066${s}\u2069`;
}

export function formatUsdCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

/** כמות מניות קומפקטית — 2.6M / 12.5K (בלי פסיקים ארוכים) */
export function formatSharesCompact(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  const n = Math.abs(Math.round(v));
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Meta שורת אחזקה — שווי קודם (לא נחתך), מניות בסוגריים כשיש.
 * דוגמה: `שווי אחזקה $9.00B (2.6M מניות)` / בלי מניות: `שווי אחזקה $1.2M`
 */
export function formatHoldingsValueMeta(
  valueUsd: number | null | undefined,
  shares?: number | null
): string {
  const valueLabel =
    valueUsd != null && Number.isFinite(valueUsd)
      ? `שווי אחזקה ${ltrEmbed(formatUsdCompact(valueUsd))}`
      : null;
  const sharesLabel = formatSharesCompact(shares);
  if (valueLabel && sharesLabel) {
    return `${valueLabel} (${ltrEmbed(sharesLabel)} מניות)`;
  }
  if (valueLabel) return valueLabel;
  if (sharesLabel) return `${ltrEmbed(sharesLabel)} מניות`;
  return '';
}

/** מחיר ממוצע לכניסה (cost/qty) — דיוק סביר למניות, בלי להמציא ערך */
export function formatAvgEntryUsd(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  if (v >= 1000) return formatUsdCompact(v);
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

/** avg = cost_usd / qty רק כשבסיס העלות אמין (מניות מדווחות) */
export function avgEntryPriceFromCost(
  costUsd: number | null | undefined,
  qty: number | null | undefined,
  basisReliable?: boolean | null
): number | null {
  if (basisReliable === false) return null;
  if (costUsd == null || qty == null) return null;
  if (!(costUsd > 0) || !(qty > 0)) return null;
  return costUsd / qty;
}

/**
 * מחיר כניסה מוצר מ־13F (fallback לקוח בלבד): value_usd / shares.
 * השרת מעדיף Yahoo ב־first_added_date — כמו פוליטיקאים.
 */
export function impliedFilingPriceFrom13f(
  valueUsd: number | null | undefined,
  shares: number | null | undefined
): number | null {
  if (valueUsd == null || shares == null) return null;
  if (!(valueUsd > 0) || !(shares > 0)) return null;
  return valueUsd / shares;
}

/** תשואה באחוזים: (current - entry) / entry * 100 */
export function returnPctFromEntry(
  currentPrice: number | null | undefined,
  entryPrice: number | null | undefined
): number | null {
  if (currentPrice == null || entryPrice == null) return null;
  if (!(currentPrice > 0) || !(entryPrice > 0)) return null;
  return ((currentPrice - entryPrice) / entryPrice) * 100;
}

export function formatPercent(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatRatio(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `×${v.toFixed(1)}`;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const diffMs = Date.now() - ts;
  const min = Math.max(0, Math.floor(diffMs / 60_000));
  if (min < 1) return 'הרגע';
  if (min < 60) return `לפני ${min} ד'`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `לפני ${hr} ש'`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `לפני ${days} ימים`;
  return new Date(ts).toLocaleDateString('he-IL');
}

import type { DarkPoolSignalType } from '../../../types/darkpool.types';

export function signalTypeLabel(t: DarkPoolSignalType): string {
  switch (t) {
    case 'WHALE':
      return 'לווייתן';
    case 'UNUSUAL_VOLUME':
      return 'נפח חריג';
    case 'SWEEP':
      return 'סוויפ';
    case 'HIDDEN_ACCUMULATION':
      return 'צבירה מוסדית';
    case 'INSIDER_DARKPOOL_CONFLUENCE':
      return 'בכיר × דארק פול';
  }
}

export function signalTypeShortLabel(t: DarkPoolSignalType): string {
  switch (t) {
    case 'WHALE':
      return 'Whale';
    case 'UNUSUAL_VOLUME':
      return 'נפח';
    case 'SWEEP':
      return 'Sweep';
    case 'HIDDEN_ACCUMULATION':
      return 'צבירה';
    case 'INSIDER_DARKPOOL_CONFLUENCE':
      return 'קונפלוונס';
  }
}

export function signalTypeIcon(
  t: DarkPoolSignalType
):
  | 'water'
  | 'flash'
  | 'cube'
  | 'trending-up'
  | 'shield-checkmark' {
  switch (t) {
    case 'WHALE':
      return 'water';
    case 'UNUSUAL_VOLUME':
      return 'flash';
    case 'SWEEP':
      return 'cube';
    case 'HIDDEN_ACCUMULATION':
      return 'trending-up';
    case 'INSIDER_DARKPOOL_CONFLUENCE':
      return 'shield-checkmark';
  }
}

/** Score → color (red/yellow/green range), mapped to design tokens. */
export function scoreColor(
  score: number,
  tokens: {
    colors: {
      primary: { main: string };
      text: { warning: string; danger: string; secondary: string };
    };
  }
): string {
  if (!Number.isFinite(score)) return tokens.colors.text.secondary;
  if (score >= 75) return tokens.colors.primary.main;
  if (score >= 50) return tokens.colors.text.warning;
  return tokens.colors.text.danger;
}
