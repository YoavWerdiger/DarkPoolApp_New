/**
 * darkPoolScoring.ts
 * -----------------------------------------------------------------------------
 * סקורינג של סיגנלי Dark Pool — pure logic, ללא תלויות חיצוניות.
 *
 * משקלות (מתוך 100):
 *   - 40%  Premium      (גודל ההדפסה הכי משמעותי)
 *   - 20%  Repeat       (כמה פעמים זוהה אותו טיקר ב-3 ימים אחרונים)
 *   - 20%  Insider      (קיום רכישת insider קרובה בזמן)
 *   - 20%  Rel. Volume  (Dark-pool volume מול ממוצע 30 יום)
 *
 * הציון מנורמל ל-0..100 ו-clipped.
 */

import type {
  DarkPoolSignalType,
  ScoreBreakdown,
} from '../../types/darkpool.types';

export const SCORE_WEIGHTS = {
  premium: 40,
  repeat: 20,
  insider: 20,
  rel_volume: 20,
} as const;

export interface ScoreInputs {
  /** סך ה-premium של הסיגנל ב-USD. */
  premium: number;
  /** מספר סיגנלים על אותו טיקר ב-3 ימים אחרונים (כולל הנוכחי). */
  repeatCount: number;
  /** האם זוהה insider buy ב-30 הימים האחרונים. */
  hasRecentInsider: boolean;
  /** ערך ה-insider buy אם קיים (לסקור gradient). */
  insiderValue?: number | null;
  /** ימים שעברו מאז ה-insider buy (0..30). */
  insiderDaysAgo?: number | null;
  /** היחס בין DP volume של היום לממוצע 30 יום (=1.0 = ממוצע). */
  relativeVolume: number;
  /** סוג הסיגנל — משפיע על תקרת ה-score וקבועי הנירמול. */
  signalType: DarkPoolSignalType;
}

// ---------------------------------------------------------------------------
// Sub-scores
// ---------------------------------------------------------------------------

/** Premium: logistic-curve מ-$100K (~5) עד $25M (~95). */
export function premiumSubScore(premiumUsd: number): number {
  if (!Number.isFinite(premiumUsd) || premiumUsd <= 0) return 0;
  const k = 0.000_000_15;
  const mid = 5_000_000;
  const raw = 1 / (1 + Math.exp(-k * (premiumUsd - mid)));
  return clamp01(raw) * 100;
}

/** Repeat: 1→0, 2→30, 3→55, 5→80, 8+→100 (saturating). */
export function repeatSubScore(repeatCount: number): number {
  if (!Number.isFinite(repeatCount) || repeatCount <= 1) return 0;
  const n = Math.max(0, repeatCount - 1);
  return clamp01(1 - Math.exp(-n / 3.0)) * 100;
}

/** Insider: 0 ללא, 70 בסיס, +30 לפי טריות (יום=+30, 30 ימים=+0) ועוד גראדיינט לפי ערך. */
export function insiderSubScore(
  hasRecentInsider: boolean,
  insiderDaysAgo?: number | null,
  insiderValue?: number | null
): number {
  if (!hasRecentInsider) return 0;
  let score = 70;
  if (insiderDaysAgo != null) {
    const ageScore = clamp01(1 - insiderDaysAgo / 30) * 20;
    score += ageScore;
  }
  if (insiderValue != null && insiderValue > 0) {
    score += clamp01(Math.log10(insiderValue + 1) / 8) * 10;
  }
  return Math.min(100, score);
}

/** Relative-Volume: 1.0→0, 3.0→50, 5.0→75, 10.0+→100. */
export function relativeVolumeSubScore(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 1) return 0;
  return clamp01(Math.log(ratio) / Math.log(10)) * 100;
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export function scoreSignal(inputs: ScoreInputs): ScoreBreakdown {
  const premium_score = premiumSubScore(inputs.premium);
  const repeat_score = repeatSubScore(inputs.repeatCount);
  const insider_score = insiderSubScore(
    inputs.hasRecentInsider,
    inputs.insiderDaysAgo ?? null,
    inputs.insiderValue ?? null
  );
  const rel_volume_score = relativeVolumeSubScore(inputs.relativeVolume);

  let total =
    (premium_score * SCORE_WEIGHTS.premium +
      repeat_score * SCORE_WEIGHTS.repeat +
      insider_score * SCORE_WEIGHTS.insider +
      rel_volume_score * SCORE_WEIGHTS.rel_volume) /
    100;

  // Confluence bonus — INSIDER_DARKPOOL_CONFLUENCE מקבל boost של עד 10 נק' כשגם
  // ה-rel_volume וגם ה-premium גבוהים מ-50.
  if (
    inputs.signalType === 'INSIDER_DARKPOOL_CONFLUENCE' &&
    premium_score >= 50 &&
    rel_volume_score >= 50
  ) {
    total = Math.min(100, total + 10);
  }

  return {
    premium_score: round1(premium_score),
    repeat_score: round1(repeat_score),
    insider_score: round1(insider_score),
    rel_volume_score: round1(rel_volume_score),
    total: round1(Math.max(0, Math.min(100, total))),
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
