import { queryClient } from './queryClient';
import { appQueryKeys } from './appQueryKeys';
import { scheduleChatMessagesPersist } from './chatMessagePersist';
import type { ChatMessage } from '../types/chat.types';

/**
 * Per-group message cache (React Query memory + disk persist).
 *
 * Open-path TTI expectations:
 * - Cache hit: ChatGroupScreen paints `readGroupMessagesCache(groupId)` on the first
 *   layout frame at opacity 1 (no skeleton). Network delta / unread scroll run after.
 * - Cache miss: brief skeleton until disk hydrate or network tip arrives.
 *
 * Keep memory writes via writeGroupMessagesCache so list→chat stays warm.
 */

/** תקרת הודעות בזיכרון לכל קבוצה (FlatList + queryClient) */
export const CHAT_MESSAGES_MEMORY_CAP = 400;
/** חלון ברירת מחדל בפתיחה קרה */
export const CHAT_OPEN_WINDOW_DEFAULT = 40;
/** מקסימום הודעות ב-fetch ראשוני (גם אם unread ענק) */
export const CHAT_OPEN_WINDOW_MAX = 120;
/** כמה הודעות חדשות למשוך ב-catch-up מאז הקאש */
export const CHAT_DELTA_PAGE = 50;
export const CHAT_DELTA_MAX = 200;
/** הקשר סביב last_read ב-prefetch / open */
export const CHAT_AROUND_BEFORE = 40;
export const CHAT_AROUND_AFTER = 80;

/** מיון newest-first (כמו FlatList inverted) */
export function sortMessagesNewestFirst(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => {
    const dt = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (dt !== 0) return dt;
    return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
  });
}

/** מיזוג לפי id — שומר newest-first, מעדיף עותק חדש יותר מהשרת */
export function mergeChatMessages(...batches: Array<ChatMessage[] | undefined | null>): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const batch of batches) {
    if (!batch?.length) continue;
    for (const msg of batch) {
      if (!msg?.id) continue;
      const prev = byId.get(msg.id);
      if (!prev) {
        byId.set(msg.id, msg);
        continue;
      }
      // העדפה: לא אופטימיסטי, ואז העותק שעודכן לאחרונה.
      // ל-chat_messages אין updated_at — edited_at הוא חותמת העדכון היחידה בסכמה.
      const prevTemp = prev.id.startsWith('temp-');
      const nextTemp = msg.id.startsWith('temp-');
      if (prevTemp && !nextTemp) {
        byId.set(msg.id, msg);
        continue;
      }
      if (!prevTemp && nextTemp) continue;
      const prevUp = new Date(prev.edited_at || prev.created_at).getTime();
      const nextUp = new Date(msg.edited_at || msg.created_at).getTime();
      if (nextUp >= prevUp) {
        const merged: ChatMessage = { ...prev, ...msg };
        // realtime UPDATE / lean embed ריק לא אמורים למחוק שם+אווטאר שכבר יש.
        if (!hasUsableSender(msg.sender) && hasUsableSender(prev.sender)) {
          merged.sender = prev.sender;
        }
        if (!msg.reply_to && prev.reply_to) {
          merged.reply_to = prev.reply_to;
        }
        if ((!msg.reactions || msg.reactions.length === 0) && prev.reactions?.length) {
          merged.reactions = prev.reactions;
        }
        byId.set(msg.id, merged);
      }
    }
  }
  return sortMessagesNewestFirst(Array.from(byId.values()));
}

function hasUsableSender(sender: ChatMessage['sender'] | undefined): boolean {
  return Boolean(sender?.display_name && String(sender.display_name).trim());
}

export function capChatMessages(
  messages: ChatMessage[],
  cap = CHAT_MESSAGES_MEMORY_CAP,
): ChatMessage[] {
  if (messages.length <= cap) return messages;
  const hasPendingOptimistic = messages.some(
    (m) => m.id.startsWith('temp-') && (m.is_sending || m.is_uploading),
  );
  if (hasPendingOptimistic) return messages;
  return messages.slice(0, cap);
}

export function getNewestPersistedCursor(
  messages: ChatMessage[] | undefined | null,
): { id: string; created_at: string } | null {
  if (!messages?.length) return null;
  for (const m of messages) {
    if (!m.id.startsWith('temp-') && m.created_at) {
      return { id: m.id, created_at: m.created_at };
    }
  }
  return null;
}

export function messageIdInCache(
  messages: ChatMessage[] | undefined | null,
  messageId: string | null | undefined,
): boolean {
  if (!messageId || !messages?.length) return false;
  return messages.some((m) => m.id === messageId);
}

/** כתיבה לקאש קבוצה + תזמון persist לדיסק */
export function writeGroupMessagesCache(
  groupId: string,
  messages: ChatMessage[],
  userId?: string | null,
): ChatMessage[] {
  const persistable = capChatMessages(
    messages.filter((m) => !m.id.startsWith('temp-')),
  );
  queryClient.setQueryData(appQueryKeys.chatMessages(groupId), persistable);
  if (userId) scheduleChatMessagesPersist(userId);
  return persistable;
}

/** הוספת הודעה בודדת לקאש של קבוצה (realtime מחוץ ל-thread הפעיל) */
export function appendMessageToGroupCache(
  groupId: string,
  message: ChatMessage,
  userId?: string | null,
): void {
  if (!groupId || !message?.id || message.id.startsWith('temp-')) return;
  if (message.is_silent || message.is_system_message) return;
  const existing =
    queryClient.getQueryData<ChatMessage[]>(appQueryKeys.chatMessages(groupId)) ?? [];
  writeGroupMessagesCache(groupId, mergeChatMessages([message], existing), userId);
}

export function readGroupMessagesCache(groupId: string): ChatMessage[] {
  return queryClient.getQueryData<ChatMessage[]>(appQueryKeys.chatMessages(groupId)) ?? [];
}
