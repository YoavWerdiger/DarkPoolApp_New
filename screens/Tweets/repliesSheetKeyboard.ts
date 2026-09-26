import { CHAT_COMPOSER_KEYBOARD_GAP } from '../../components/chat/chatInputLayout';

/**
 * כמה לכווץ את עמוד התגובות כשהמקלדת פתוחה.
 * זה |chatComposerKeyboardTranslate| — הקומפוזר עולה באותו שיעור,
 * והשיט עצמו נשאר מעוגן (בלי translateY על התצוגה המקדימה / הרשימה).
 */
export function repliesSheetKeyboardShrink(
  keyboardHeight: number,
  bottomInset: number,
  gap = CHAT_COMPOSER_KEYBOARD_GAP,
): number {
  'worklet';
  if (keyboardHeight <= 0) return 0;
  return Math.max(0, keyboardHeight - bottomInset + gap);
}
