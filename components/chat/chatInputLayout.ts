import { Platform } from 'react-native';

/** nativeID לקישור מחוות מקלדת (KeyboardGestureArea וכו') */
export const CHAT_COMPOSER_NATIVE_ID = 'darkpool-chat-composer';

/** רווח קבוע בין שורת הקלט לראש המקלדת */
export const CHAT_COMPOSER_KEYBOARD_GAP = 3;

/**
 * באנדרואיד edge-to-edge לעיתים insets.bottom=0 למרות סרגל ניווט/מחוות.
 */
export const CHAT_COMPOSER_ANDROID_MIN_BOTTOM = 16;

/**
 * Yoga בפרודקשן הוא LTR (App.tsx) גם כש-I18nManager.forceRTL(true).
 * אסור להסתמך על isRTL ל-transform של מקלדת — Expo Go לפעמים עדיין RTL.
 */
export const CHAT_KEYBOARD_LTR_STYLE = { direction: 'ltr' as const };

/** inset תחתון קבוע לקומפוזר — לא משתנה עם המקלדת (מונע קפיצות) */
export function chatComposerSafeBottomInset(safeAreaBottom: number): number {
  const minBottom = Platform.OS === 'android' ? CHAT_COMPOSER_ANDROID_MIN_BOTTOM : 0;
  return Math.max(safeAreaBottom, minBottom);
}

/** padding פנימי בשורת הקלט (לא safe area) */
export function chatInputBottomPadding(minMargin = 6): number {
  return minMargin;
}

/**
 * KeyboardStickyView: translateY = -keyboardHeight + offset.
 * closed חייב 0 (חיובי דוחף למטה). opened מפצה על inset הקבוע + gap —
 * אותו חישוב כמו chatComposerKeyboardTranslate.
 */
export function chatComposerStickyOffset(
  safeAreaBottom: number,
  gap = CHAT_COMPOSER_KEYBOARD_GAP,
): { closed: number; opened: number } {
  const safeBottom = chatComposerSafeBottomInset(safeAreaBottom);
  return {
    closed: 0,
    opened: Math.max(safeBottom - gap, 0),
  };
}

/** translateY לקומפוזר (Android Reanimated): מפצה על inset קבוע + רווח מעל המקלדת */
export function chatComposerKeyboardTranslate(
  keyboardHeight: number,
  bottomInset: number,
  gap = CHAT_COMPOSER_KEYBOARD_GAP,
): number {
  'worklet';
  if (keyboardHeight <= 0) return 0;
  return -Math.max(0, keyboardHeight - bottomInset + gap);
}
