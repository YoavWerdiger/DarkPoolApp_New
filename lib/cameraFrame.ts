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
