import { InteractionManager, Platform } from 'react-native';

const MODAL_DISMISS_MS = Platform.OS === 'ios' ? 120 : 50;

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
