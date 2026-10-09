/**
 * דרגות ותק מנוי — סמל השור־ודוב של הלוגו, הצבע עולה עם הוותק (מתכות → צבעי המותג) — לפי ימי מנוי בתשלום מצטברים (paid_days מ-get_user_badges).
 * paid_days = null → מעולם לא שילם → אין דרגה.
 */

export type RankMetal = 'gray' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'brand';

export type UserRank = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  metal: RankMetal;
  /** ימים מינימליים לדרגה */
  minDays: number;
  /** תיאור טווח קצר לרשימת הסולם */
  rangeLabel: string;
};

export const USER_RANK_LADDER: readonly UserRank[] = [
  { level: 1, metal: 'gray', minDays: 0, rangeLabel: 'חודש ראשון' },
  { level: 2, metal: 'silver', minDays: 30, rangeLabel: '1–3 חודשים' },
  { level: 3, metal: 'gold', minDays: 90, rangeLabel: '3–6 חודשים' },
  { level: 4, metal: 'platinum', minDays: 180, rangeLabel: '6–12 חודשים' },
  { level: 5, metal: 'diamond', minDays: 365, rangeLabel: '1–2 שנים' },
  // הדרגה העליונה — הירוק של האפליקציה
  { level: 6, metal: 'brand', minDays: 730, rangeLabel: 'שנתיים ומעלה' },
] as const;

export function rankForPaidDays(days: number | null | undefined): UserRank | null {
  if (days == null || !Number.isFinite(days) || days < 0) return null;
  let current: UserRank = USER_RANK_LADDER[0];
  for (const r of USER_RANK_LADDER) {
    if (days >= r.minDays) current = r;
  }
  return current;
}

export function nextRank(rank: UserRank): UserRank | null {
  return USER_RANK_LADDER.find((r) => r.level === rank.level + 1) ?? null;
}

/** התקדמות לדרגה הבאה: 0..1 + ימים שנותרו (null בדרגה האחרונה) */
export function rankProgress(days: number): {
  rank: UserRank;
  next: UserRank | null;
  progress: number;
  daysToNext: number | null;
} | null {
  const rank = rankForPaidDays(days);
  if (!rank) return null;
  const next = nextRank(rank);
  if (!next) return { rank, next: null, progress: 1, daysToNext: null };
  const span = next.minDays - rank.minDays;
  const progress = Math.min(1, Math.max(0, (days - rank.minDays) / span));
  return { rank, next, progress, daysToNext: Math.max(0, next.minDays - days) };
}

/** «מנוי כבר 4 חודשים» */
export function formatPaidTenure(days: number): string {
  if (days < 1) return 'מנוי מהיום';
  if (days < 30) return days === 1 ? 'מנוי כבר יום אחד' : `מנוי כבר ${days} ימים`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'מנוי כבר חודש' : months === 2 ? 'מנוי כבר חודשיים' : `מנוי כבר ${months} חודשים`;
  const years = Math.floor(days / 365);
  const restMonths = Math.floor((days - years * 365) / 30);
  const y = years === 1 ? 'שנה' : years === 2 ? 'שנתיים' : `${years} שנים`;
  if (restMonths <= 0) return `מנוי כבר ${y}`;
  const m = restMonths === 1 ? 'חודש' : restMonths === 2 ? 'חודשיים' : `${restMonths} חודשים`;
  return `מנוי כבר ${y} ו${m}`;
}

export function formatDaysCount(days: number): string {
  return days === 1 ? 'יום אחד' : `${days} ימים`;
}

/** וי כחול — כחול «מאומת» סטנדרטי, קריא בבהיר ובכהה */
export const VERIFIED_BLUE = '#1D9BF0';

/** צבעי מתכת לדרגות — גוון בהיר לרקע כהה, גוון עמוק לרקע בהיר */
export const RANK_METAL_COLORS: Record<'silver' | 'gold' | 'platinum' | 'diamond', { dark: string; light: string }> = {
  silver: { dark: '#C9CED6', light: '#7D8692' },
  gold: { dark: '#F2C14E', light: '#B8860B' },
  platinum: { dark: '#9FD3E8', light: '#4F8FAD' },
  diamond: { dark: '#B79CFF', light: '#7B5BE0' },
};

/** הצבע הראשי של הדרגה (פס התקדמות וכו׳) */
export function rankColor(
  metal: RankMetal,
  isDarkMode: boolean,
  tokens: { grayToken: string; brandGreen: string }
): string {
  if (metal === 'gray') return tokens.grayToken;
  if (metal === 'brand') return tokens.brandGreen;
  return isDarkMode ? RANK_METAL_COLORS[metal].dark : RANK_METAL_COLORS[metal].light;
}
