import { Dimensions, Platform } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

/**
 * חלון המצלמה (צ'אט + סטורי) — כמו וואטסאפ: לא מסך מלא, ברוחב מלא מתחת לפס העליון,
 * והכפתורים על השחור מתחתיו. גבוה ככל שיש מקום עד 2:3; לפחות 3:4 (במסך קטן הכפתורים
 * יושבים על תחתית החלון).
 */
export const CAMERA_TOP_BAR_H = 64; // paddingTop 10 + כפתור 48 + מרווח
/** שורת הצילום (84 + 16) + בורר תמונה/וידאו */
export const CAMERA_CONTROLS_H = 152;

export function cameraPreviewFrame(
  screenW: number,
  screenH: number,
  insets: { top: number; bottom: number },
): { top: number; width: number; height: number } {
  const top = insets.top + CAMERA_TOP_BAR_H;
  const minH = Math.round((screenW * 4) / 3);
  const maxH = Math.round((screenW * 3) / 2);
  const room = screenH - top - CAMERA_CONTROLS_H - Math.max(insets.bottom, 8);
  const height = Math.max(minH, Math.min(maxH, Math.floor(room)));
  return { top, width: screenW, height };
}

/**
 * מסגרת יציבה — מחושבת פעם אחת ממידות החלון ו-initialWindowMetrics (לא מ-useSafeAreaInsets,
 * שמגיע 0 ואז הערך האמיתי). שינוי גודל של מיכל CameraView אחרי שהתצוגה התחילה מקפיא אותה
 * ב-iOS על הפריים הראשון.
 */
let stableFrame: { top: number; width: number; height: number } | null = null;
export function stableCameraPreviewFrame(): { top: number; width: number; height: number } {
  if (stableFrame) return stableFrame;
  const { width, height } = Dimensions.get('window');
  const insets = initialWindowMetrics?.insets;
  // בלי מדדים התחלתיים — ברירת מחדל סבירה במקום 0 (שהיה שם את החלון מתחת לנוץ')
  const top = insets?.top || (Platform.OS === 'ios' ? 47 : 24);
  const bottom = insets?.bottom ?? (Platform.OS === 'ios' ? 34 : 0);
  stableFrame = cameraPreviewFrame(width, height, { top, bottom });
  return stableFrame;
}
