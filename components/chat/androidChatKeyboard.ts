import { Platform } from 'react-native';
import {
  AndroidSoftInputModes,
  KeyboardController,
} from 'react-native-keyboard-controller';

/**
 * בעלים יחיד של soft-input בצ'אט: ADJUST_NOTHING נשאר כל עוד טאב הצ'אט מפוקס.
 * BottomSheet / ComposerDock לא קוראים setDefaultMode אם הנעילה פעילה —
 * אחרת adjustResize מה-Manifest נלחם ב-KeyboardStickyView באמצע מעבר list↔thread.
 */
let chatSoftInputLocked = false;

/**
 * נועל ADJUST_NOTHING לפני/במהלך פתיחת thread ובזמן שטאב הצ'אט מפוקס.
 * בלי זה adjustResize מה-Manifest דוחף את המסך 300–400ms בלחיצה (Keyboard.dismiss / מעבר).
 * no-op ב-iOS ובטסטים בלי native module.
 */
export function lockAndroidChatSoftInput(): void {
  if (Platform.OS !== 'android') return;
  chatSoftInputLocked = true;
  try {
    KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
  } catch {
    /* KeyboardController missing in tests / Expo Go edge */
  }
}

/** שחרור רק כשיוצאים מטאב הצ'אט (Drawer), לא במעבר list↔thread. */
export function releaseAndroidChatSoftInput(): void {
  if (Platform.OS !== 'android') return;
  chatSoftInputLocked = false;
  try {
    KeyboardController.setDefaultMode();
  } catch {
    /* noop */
  }
}

/**
 * Cleanup של שיט/קומפוזר: אם הצ'אט עדיין נועל — מחזירים ADJUST_NOTHING
 * במקום setDefaultMode שדורס את הנעילה באמצע אנימציית מקלדת.
 */
export function restoreAndroidSoftInputIfUnlocked(): void {
  if (Platform.OS !== 'android') return;
  if (chatSoftInputLocked) {
    try {
      KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
    } catch {
      /* noop */
    }
    return;
  }
  try {
    KeyboardController.setDefaultMode();
  } catch {
    /* noop */
  }
}
