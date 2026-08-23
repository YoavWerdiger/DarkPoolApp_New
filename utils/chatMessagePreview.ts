// ============================================
// תצוגת טקסט להודעה (רשימת צ'אטים, שיטים, reply preview)
// מסיר תוכן גולמי כמו JSON של הקלטה ומחזיר תווית קריאה.
// ============================================

import { ChatMessageType } from '../types/chat.types';

function formatPreviewDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function isAudioWaveformPayload(parsed: Record<string, unknown>): boolean {
  return parsed.waveform != null || parsed.waveformData != null;
}

/**
 * מחזיר תווית קריאה להודעה לפי הסוג/תוכן.
 * - מדיה (תמונה/וידאו/הקלטה/מסמך) → תווית קבועה
 * - הקלטת קול נשמרת כ-JSON עם waveform/waveformData — מזוהה גם ללא message_type
 * - טרייד ב-JSON → סמל אם זמין
 * - אחרת → התוכן עצמו
 */
export function getChatMessagePreview(
  messageType?: string | null,
  content?: string | null,
): string {
  const trimmed = (content ?? '').trim();

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const trade = parsed.trade as { symbol?: string } | undefined;
      if (trade && typeof trade.symbol === 'string' && trade.symbol) {
        return `טרייד · ${trade.symbol}`;
      }
      if (isAudioWaveformPayload(parsed)) {
        const dur =
          typeof parsed.duration === 'number' && parsed.duration >= 0
            ? formatPreviewDuration(parsed.duration)
            : null;
        return dur ? `הודעה קולית · ${dur}` : 'הודעה קולית';
      }
    } catch {
      /* לא JSON תקין */
    }
  }

  switch (messageType) {
    case ChatMessageType.IMAGE:
      return 'תמונה';
    case ChatMessageType.VIDEO:
      return 'וידאו';
    case ChatMessageType.AUDIO:
      return 'הודעה קולית';
    case ChatMessageType.DOCUMENT:
      return 'מסמך';
    case ChatMessageType.POLL:
      return 'סקר';
    case ChatMessageType.TRADE:
      return 'טרייד';
    case ChatMessageType.MEDIA_GROUP:
      return 'אלבום';
  }

  // זיהוי הקלטה גם כשאין message_type (תוכן JSON עם waveform)
  if (
    trimmed.startsWith('{') &&
    (trimmed.includes('waveformData') || trimmed.includes('"waveform"'))
  ) {
    return 'הודעה קולית';
  }

  return trimmed || 'הודעה';
}
