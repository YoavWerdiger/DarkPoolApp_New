import { Platform } from 'react-native';

/** nativeID לקישור מחוות מקלדת (KeyboardGestureArea וכו') */
export const CHAT_COMPOSER_NATIVE_ID = 'darkpool-chat-composer';

/** מרווח מעל המקלדת כשהיא פתוחה */
export const CHAT_COMPOSER_KEYBOARD_OPENED_GAP = 8;

/**
 * באנדרואיד edge-to-edge לעיתים insets.bottom=0 למרות סרגל ניווט/מחוות.
 * אותו מינימום כמו BottomSheet / LongPressOverlay.
 */
export const CHAT_COMPOSER_ANDROID_MIN_BOTTOM = 24;

/** inset תחתון אמיתי לקומפוזר — מעל כפתורי מערכת / home indicator */
export function chatComposerSafeBottomInset(safeAreaBottom: number): number {
  const minBottom = Platform.OS === 'android' ? CHAT_COMPOSER_ANDROID_MIN_BOTTOM : 0;
  return Math.max(safeAreaBottom, minBottom);
}

/**
 * KeyboardStickyView: `closed` חייב להישאר 0 (ערך חיובי דוחף למטה!).
 * `opened` מפצה על אזור בטוח כשהמקלדת פתוחה — כמו בדוגמה הרשמית.
 */
export function chatComposerStickyOffset(safeAreaBottom: number): {
  closed: number;
  opened: number;
} {
  const safeBottom = chatComposerSafeBottomInset(safeAreaBottom);
  return {
    closed: 0,
    opened: Math.max(safeBottom - CHAT_COMPOSER_KEYBOARD_OPENED_GAP, 0),
  };
}

/** padding תחתון לשורת הקלט — safe area כשסגור, רווח קטן כשהמקלדת פתוחה */
export function chatComposerPaddingBottom(
  safeAreaBottom: number,
  keyboardVisible: boolean,
): number {
  const safeBottom = chatComposerSafeBottomInset(safeAreaBottom);
  return keyboardVisible ? CHAT_COMPOSER_KEYBOARD_OPENED_GAP : safeBottom;
}

/**
 * Bottom padding inside the composer row (פנימי, לא safe area).
 */
export function chatInputBottomPadding(
  _safeAreaBottom: number,
  _keyboardVisible: boolean,
  minMargin = 6,
): number {
  return minMargin;
}
