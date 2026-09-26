/**
 * שפת תנועה אחידה ל־BottomSheet (סגנון וואטסאפ / iOS):
 * עלייה אחת החלטית, ease-out רך, בלי overshoot/bounce.
 * פתיחה ≈ סגירה בתחושה (open מעט ארוך יותר כי ease-out נתפס כמהיר).
 */
import { Easing, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

/** משך סגירה — הבסיס שמרגיש נכון */
export const SHEET_CLOSE_MS = 300;
/**
 * משך פתיחה — חלון 280–350ms (וואטסאפ / iOS system sheet).
 * קצר מ־360 הישן + בלי ease-in בהתחלה = עלייה החלטית בלי "היסוס".
 */
export const SHEET_OPEN_MS = 320;

/** @deprecated — alias ל־close; העדף SHEET_OPEN_MS / SHEET_CLOSE_MS */
export const SHEET_MOTION_MS = SHEET_CLOSE_MS;

/**
 * נקודות bezier לייצוא — Reanimated ו־RN Animated חייבים אותה עקומה.
 * iOS sheet: עלייה מהירה, נחיתה רכה, בלי overshoot (y2=1, לא מעל 1).
 */
export const SHEET_EASE_OUT_BEZIER = { x1: 0.32, y1: 0.72, x2: 0, y2: 1 } as const;
/** סגירה: ease-in מדוד — יציאה בלי משיכה אחורה */
export const SHEET_EASE_IN_BEZIER = { x1: 0.32, y1: 0, x2: 0.67, y2: 0 } as const;

export const SHEET_EASE_OUT = Easing.bezier(
  SHEET_EASE_OUT_BEZIER.x1,
  SHEET_EASE_OUT_BEZIER.y1,
  SHEET_EASE_OUT_BEZIER.x2,
  SHEET_EASE_OUT_BEZIER.y2,
);
export const SHEET_EASE_IN = Easing.bezier(
  SHEET_EASE_IN_BEZIER.x1,
  SHEET_EASE_IN_BEZIER.y1,
  SHEET_EASE_IN_BEZIER.x2,
  SHEET_EASE_IN_BEZIER.y2,
);

export const SHEET_OPEN_TIMING: WithTimingConfig = {
  duration: SHEET_OPEN_MS,
  easing: SHEET_EASE_OUT,
};

export const SHEET_CLOSE_TIMING: WithTimingConfig = {
  duration: SHEET_CLOSE_MS,
  easing: SHEET_EASE_IN,
};

/** התאמת גובה fitContent אחרי שהשיט כבר יושב — קצרה ושקטה, לא עלייה שנייה */
export const FIT_CONTENT_HEIGHT_TIMING: WithTimingConfig = {
  duration: 160,
  easing: SHEET_EASE_OUT,
};

/**
 * BlurView עולה רק אחרי שהעלייה נגמרה — פתיחה = translate + backdrop בלבד.
 * האורורה כבר מושהית בזמן שהשיט ממונט; לא מדליקים blur באמצע ה־320ms.
 */
export const SHEET_BLUR_DEFER_MS = SHEET_OPEN_MS;

/**
 * חזרה ל־snap אחרי גרירה — damping גבוה + overshootClamping
 * כדי שלא תהיה "קפיצה" בסוף המחווה.
 */
export const SHEET_SNAP_SPRING: WithSpringConfig = {
  damping: 42,
  stiffness: 380,
  mass: 0.7,
  overshootClamping: true,
};

/** @deprecated aliases — לתאימות import ישנים */
export const FIT_CONTENT_OPEN_TIMING = SHEET_OPEN_TIMING;
export const FIT_CONTENT_CLOSE_TIMING = SHEET_CLOSE_TIMING;
export const SPRING_CONFIG = SHEET_SNAP_SPRING;
export const SPRING_CONFIG_SNAP = SHEET_SNAP_SPRING;

export const SHEET_SNAP_MIN = 0.1;
export const SHEET_SNAP_MAX = 0.94;
/** handle + buffer ש־useChatFitContentSnap מוסיף מעל התוכן המדוד */
export const FIT_CONTENT_SNAP_EXTRA_PX = 4;

export function clampSheetSnapPoint(point: number): number {
  if (!Number.isFinite(point)) return 0.5;
  return Math.max(SHEET_SNAP_MIN, Math.min(SHEET_SNAP_MAX, point));
}

/**
 * גובה פריים ראשון ל־fitContent — אף פעם לא 0.
 * הערכת snap (או מדידה קודמת) כדי ש־translateY יידע כמה לנוע.
 */
export function resolveSheetVisibleHeightPx(
  snapPoints: readonly number[] | undefined,
  screenHeight: number,
): number {
  const raw = snapPoints?.[0] ?? 0.5;
  const h = Number.isFinite(screenHeight) && screenHeight > 0 ? screenHeight : 1;
  return Math.ceil(h * clampSheetSnapPoint(raw));
}

/**
 * בזמן עלייה — נשארים בגובה הנעול. אחרי הנחיתה — לוקחים את המדידה.
 * מונע שני springs מתחרים (translateY + height).
 */
export function resolveFitContentHeightForFrame(
  openInProgress: boolean,
  lockedPx: number,
  measuredPx: number,
): number {
  if (openInProgress && lockedPx > 0) return lockedPx;
  if (measuredPx > 0) return measuredPx;
  return lockedPx > 0 ? lockedPx : 0;
}

export function resolveFitContentSnapPoint(input: {
  contentHeight: number | null | undefined;
  screenHeight: number;
  handlePx: number;
  extraPx?: number;
  initialEstimate: number;
  maxSnap?: number;
  minSnap?: number;
}): number {
  const h = input.contentHeight;
  const screenH = input.screenHeight > 0 ? input.screenHeight : 1;
  const maxSnap = input.maxSnap ?? 0.92;
  const minSnap = input.minSnap ?? 0.12;
  if (h != null && h > 0) {
    const totalPx = h + input.handlePx + (input.extraPx ?? FIT_CONTENT_SNAP_EXTRA_PX);
    return Math.min(maxSnap, Math.max(minSnap, totalPx / screenH));
  }
  return input.initialEstimate;
}
