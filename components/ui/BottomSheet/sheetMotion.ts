/**
 * שפת תנועה אחידה ל־BottomSheet (סגנון וואטסאפ):
 * ease-out חלק, בלי overshoot/bounce.
 */
import { Easing, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

/** משך פתיחה/סגירה — מספיק רך, בלי תחושת קפיצה בסוף */
export const SHEET_MOTION_MS = 300;

/**
 * cubic-bezier קרוב ל־iOS / WhatsApp sheet:
 * האצה מהירה בהתחלה, נחיתה חלקה בלי overshoot.
 */
export const SHEET_EASE_OUT = Easing.bezier(0.32, 0.72, 0, 1);
export const SHEET_EASE_IN = Easing.bezier(0.32, 0, 0.67, 0);

export const SHEET_OPEN_TIMING: WithTimingConfig = {
  duration: SHEET_MOTION_MS,
  easing: SHEET_EASE_OUT,
};

export const SHEET_CLOSE_TIMING: WithTimingConfig = {
  duration: SHEET_MOTION_MS,
  easing: SHEET_EASE_IN,
};

/** התאמת גובה fitContent אחרי מדידה — קצרה ושקטה */
export const FIT_CONTENT_HEIGHT_TIMING: WithTimingConfig = {
  duration: 180,
  easing: SHEET_EASE_OUT,
};

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
