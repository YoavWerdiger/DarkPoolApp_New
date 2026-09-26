import { InteractionManager, Platform } from 'react-native';
import { SHEET_CLOSE_MS } from '../ui/BottomSheet/sheetMotion';

/** ממתין לסיום אנימציית סגירת ChatBottomSheet (~300ms) לפני Modal/מצלמה. */
const MODAL_DISMISS_MS = SHEET_CLOSE_MS + (Platform.OS === 'ios' ? 60 : 30);

/**
 * מריץ פעולה רק אחרי ש-Modal / bottom sheet הספיק להיסגר.
 * ב-iOS חובה לפני פתיחת מצלמה / גלריה — אחרת הממשק נתקע.
 */
export function runAfterSheetDismiss(action: () => void): void {
  requestAnimationFrame(() => {
    setTimeout(() => {
      InteractionManager.runAfterInteractions(action);
    }, MODAL_DISMISS_MS);
  });
}
