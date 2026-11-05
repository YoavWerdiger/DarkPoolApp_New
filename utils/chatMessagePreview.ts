import i18n from '../lib/i18n';
// ============================================
// תצוגת טקסט להודעה (רשימת צ'אטים, שיטים, reply preview)
// מסיר תוכן גולמי כמו JSON של הקלטה ומחזיר תווית קריאה.
// ============================================

import { ChatMessageType } from '../types/chat.types';
import { parseEntityAttachmentFromContent } from '../types/shareableEntity';

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
        return i18n.t('auto.utils__chatMessagePreview.s1', { v0: trade.symbol });
      }
      // שיתוף ישות (טרייד/חדשה/פרופיל) — מזוהה גם בלי message_type (last_message_preview מהשרת)
      const entity = parseEntityAttachmentFromContent(trimmed);
      if (entity) {
        const caption = typeof parsed.caption === 'string' ? parsed.caption.trim() : '';
        return caption || entity.preview.title;
      }
      if (isAudioWaveformPayload(parsed)) {
        const dur =
          typeof parsed.duration === 'number' && parsed.duration >= 0
            ? formatPreviewDuration(parsed.duration)
            : null;
        return dur ? i18n.t('auto.utils__chatMessagePreview.s2', { v0: dur }) : i18n.t('auto.utils__chatMessagePreview.s3');
      }
    } catch {
      // JSON חתוך (last_message_preview ישן נשמר כ-LEFT 100) — מזהים לפי מפתחות ולא מציגים גולמי
      if (trimmed.includes('"attachment"')) {
        const title = /"title"\s*:\s*"([^"]+)/.exec(trimmed)?.[1];
        return title || i18n.t('auto.utils__chatMessagePreview.s4');
      }
      if (trimmed.includes('"waveform"') || trimmed.includes('"waveformData"')) return i18n.t('auto.utils__chatMessagePreview.s3');
      if (trimmed.includes('"trade"')) return i18n.t('auto.utils__chatMessagePreview.s5');
    }
  }

  switch (messageType) {
    case ChatMessageType.IMAGE:
      return i18n.t('auto.utils__chatMessagePreview.s6');
    case ChatMessageType.VIDEO:
      return i18n.t('auto.utils__chatMessagePreview.s7');
    case ChatMessageType.AUDIO:
      return i18n.t('auto.utils__chatMessagePreview.s3');
    case ChatMessageType.DOCUMENT:
      return i18n.t('auto.utils__chatMessagePreview.s8');
    case ChatMessageType.POLL:
      return i18n.t('auto.utils__chatMessagePreview.s9');
    case ChatMessageType.TRADE:
      return i18n.t('auto.utils__chatMessagePreview.s5');
    case ChatMessageType.ENTITY: {
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed) as {
            attachment?: { preview?: { title?: string } };
          };
          const title = parsed.attachment?.preview?.title;
          if (title) return title;
        } catch {
          /* ignore */
        }
      }
      return i18n.t('auto.utils__chatMessagePreview.s4');
    }
    case ChatMessageType.MEDIA_GROUP:
      return i18n.t('auto.utils__chatMessagePreview.s10');
  }

  // זיהוי הקלטה גם כשאין message_type (תוכן JSON עם waveform)
  if (
    trimmed.startsWith('{') &&
    (trimmed.includes('waveformData') || trimmed.includes('"waveform"'))
  ) {
    return i18n.t('auto.utils__chatMessagePreview.s3');
  }

  return trimmed || i18n.t('auto.utils__chatMessagePreview.s11');
}
