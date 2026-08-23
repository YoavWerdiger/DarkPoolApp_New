/**
 * darkPoolFormat.ts
 * -----------------------------------------------------------------------------
 * פורמטרים משותפים לקומפוננטות ה-Dark Pool.
 */

export function formatUsdCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

/** מחיר ממוצע לכניסה (cost/qty) — דיוק סביר למניות, בלי להמציא ערך */
export function formatAvgEntryUsd(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  if (v >= 1000) return formatUsdCompact(v);
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

/** avg = cost_usd / qty כששניהם זמינים משחזור תיק */
export function avgEntryPriceFromCost(
  costUsd: number | null | undefined,
  qty: number | null | undefined
): number | null {
  if (costUsd == null || qty == null) return null;
  if (!(costUsd > 0) || !(qty > 0)) return null;
  return costUsd / qty;
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
