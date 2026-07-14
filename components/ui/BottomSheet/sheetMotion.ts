/**
 * שפת תנועה אחידה ל־BottomSheet (סגנון וואטסאפ):
 * ease חלק, בלי overshoot/bounce.
 * פתיחה ≈ סגירה בתחושה (open מעט ארוך יותר כי ease-out נתפס כמהיר).
 */
import { Easing, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

/** משך סגירה — הבסיס שמרגיש נכון */
export const SHEET_CLOSE_MS = 300;
/**
 * משך פתיחה — מעט ארוך יותר מהסגירה כדי לאזן את ease-out
 * (שכולס מרחק מוקדם יותר מאשר ease-in בסגירה).
 */
export const SHEET_OPEN_MS = 360;

/** @deprecated — alias ל־close; העדף SHEET_OPEN_MS / SHEET_CLOSE_MS */
export const SHEET_MOTION_MS = SHEET_CLOSE_MS;

/**
 * פתיחה: ease-out רך (לא ה־bezier האגרסיבי שדוהר בהתחלה).
 * cubic-bezier קרוב ל־CSS ease — נחיתה חלקה בלי overshoot.
 */
export const SHEET_EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);
/** סגירה: ease-in מראה — יציאה מדודה */
export const SHEET_EASE_IN = Easing.bezier(0.32, 0, 0.67, 0);

export const SHEET_OPEN_TIMING: WithTimingConfig = {
  duration: SHEET_OPEN_MS,
  easing: SHEET_EASE_OUT,
};

export const SHEET_CLOSE_TIMING: WithTimingConfig = {
  duration: SHEET_CLOSE_MS,
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
