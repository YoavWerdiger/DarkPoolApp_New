// ============================================
// תצוגת טקסט להודעה האחרונה (רשימת צ'אטים, שיטים, התראות)
// מסיר תוכן גולמי כמו JSON של הקלטה ומחזיר תווית קריאה.
// ============================================

import { ChatMessageType } from '../types/chat.types';

/**
 * מחזיר תווית קריאה להודעה לפי הסוג/תוכן.
 * - מדיה (תמונה/וידאו/הקלטה/מסמך) → תווית קבועה
 * - הקלטת קול נשמרת כ-JSON עם waveformData — מזוהה גם ללא message_type
 * - אחרת → התוכן עצמו
 */
export function getChatMessagePreview(
  messageType?: string | null,
  content?: string | null,
): string {
  switch (messageType) {
    case ChatMessageType.IMAGE:
      return 'תמונה';
    case ChatMessageType.VIDEO:
      return 'וידאו';
    case ChatMessageType.AUDIO:
      return 'הקלטה';
    case ChatMessageType.DOCUMENT:
      return 'מסמך';
    case ChatMessageType.POLL:
      return 'סקר';
    case ChatMessageType.TRADE:
      return 'טרייד';
  }

  const trimmed = (content ?? '').trim();

  // זיהוי הקלטה גם כשאין message_type (תוכן JSON עם waveformData)
  if (trimmed.startsWith('{') && trimmed.includes('waveformData')) {
    return 'הקלטה';
  }

  return trimmed || 'הודעה';
}
