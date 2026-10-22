import { sendChatMessage } from '../services/chat';
import { ChatMessageType } from '../types/chat.types';
import {
  serializeEntityMessageContent,
  type ShareableAttachment,
} from '../types/shareableEntity';
import { makeClientMessageId } from '../services/chat/chatOfflineQueue';
import { logger } from '../utils/logger';

/**
 * שליחת כרטיס ישות (דוח, דיווח כלכלי, חדשה…) לקבוצות צ׳אט — מתוך «העבר» בלחיצה ארוכה.
 * זורק אם כל השליחות נכשלו (השיט מציג שגיאה); הצלחה חלקית נחשבת הצלחה.
 */
export async function shareAttachmentToGroups(
  attachment: ShareableAttachment,
  groupIds: string[],
  userId: string,
): Promise<{ sent: number; failed: number }> {
  const content = serializeEntityMessageContent(attachment);
  const results = await Promise.all(
    groupIds.map(async (groupId) => {
      try {
        const { error } = await sendChatMessage(
          {
            group_id: groupId,
            content,
            message_type: ChatMessageType.ENTITY,
            client_message_id: makeClientMessageId(),
          },
          userId,
        );
        if (error) logger.warn('shareAttachmentToGroups', `send to ${groupId} failed`, error);
        return !error;
      } catch (e) {
        logger.warn('shareAttachmentToGroups', `send to ${groupId} threw`, e);
        return false;
      }
    }),
  );
  const sent = results.filter(Boolean).length;
  const failed = results.length - sent;
  if (sent === 0 && failed > 0) throw new Error('השליחה נכשלה');
  return { sent, failed };
}
