import { Platform } from 'react-native';

/** nativeID לקישור מחוות מקלדת (KeyboardGestureArea וכו') */
export const CHAT_COMPOSER_NATIVE_ID = 'darkpool-chat-composer';

/** רווח קבוע בין שורת הקלט לראש המקלדת */
export const CHAT_COMPOSER_KEYBOARD_GAP = 3;

/**
 * באנדרואיד edge-to-edge לעיתים insets.bottom=0 למרות סרגל ניווט/מחוות.
 */
export const CHAT_COMPOSER_ANDROID_MIN_BOTTOM = 16;

/** inset תחתון קבוע לקומפוזר — לא משתנה עם המקלדת (מונע קפיצות) */
export function chatComposerSafeBottomInset(safeAreaBottom: number): number {
  const minBottom = Platform.OS === 'android' ? CHAT_COMPOSER_ANDROID_MIN_BOTTOM : 0;
  return Math.max(safeAreaBottom, minBottom);
}

/** padding פנימי בשורת הקלט (לא safe area) */
export function chatInputBottomPadding(minMargin = 6): number {
  return minMargin;
}

/** translateY לקומפוזר: מפצה על inset קבוע + רווח מעל המקלדת */
export function chatComposerKeyboardTranslate(
  keyboardHeight: number,
  bottomInset: number,
  gap = CHAT_COMPOSER_KEYBOARD_GAP,
): number {
  'worklet';
  if (keyboardHeight <= 0) return 0;
  return -Math.max(0, keyboardHeight - bottomInset + gap);
}
