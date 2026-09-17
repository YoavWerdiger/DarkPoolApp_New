import type { ChatMessage } from '../types/chat.types';
import { isOptimisticChatMessageId } from '../services/chat/chatOfflineQueue';

export type ChatMessageIdentity = {
  id: string;
  sender_id?: string;
  client_message_id?: string | null;
  local_id?: string | null;
  is_sending?: boolean;
  is_uploading?: boolean;
  message_type?: ChatMessage['message_type'] | string;
  content?: string | null;
  media_url?: string | null;
  reply_to_message_id?: string | null;
  created_at?: string;
};

/** מפתח רשימה יציב — לא משתנה כשהאופטימיסטי מתמזג להודעת שרת. */
export function chatMessageListKey(m: ChatMessageIdentity): string {
  return m.client_message_id || m.local_id || m.id;
}

export function isPendingOptimisticRow(m: ChatMessageIdentity): boolean {
  return isOptimisticChatMessageId(m.id) || !!m.is_sending || !!m.is_uploading;
}

function sameClientIdentity(a: ChatMessageIdentity, b: ChatMessageIdentity): boolean {
  if (a.client_message_id && a.client_message_id === b.client_message_id) return true;
  if (a.local_id && (a.local_id === b.local_id || a.local_id === b.id)) return true;
  if (b.local_id && (b.local_id === a.local_id || b.local_id === a.id)) return true;
  return false;
}

function trimmedContent(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function withinSendWindow(a: string | undefined, b: string | undefined, windowMs: number): boolean {
  if (!a || !b) return true;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return true;
  return Math.abs(da - db) < windowMs;
}

/**
 * מוצא את שורת האופטימיסטי שצריכה להתמזג עם הודעת שרת/realtime.
 * לא תופס הודעות שלי ממכשיר אחר — רק שורות pending.
 */
export function findMatchingOptimisticIndex(
  messages: ChatMessageIdentity[],
  incoming: ChatMessageIdentity,
  myUserId: string,
): number {
  if (!incoming?.id) return -1;

  const byId = messages.findIndex((m) => m.id === incoming.id);
  if (byId !== -1) return byId;

  for (let i = 0; i < messages.length; i++) {
    if (sameClientIdentity(messages[i], incoming)) return i;
  }

  if (incoming.sender_id !== myUserId) return -1;

  const incomingContent = trimmedContent(incoming.content);
  const incomingType = incoming.message_type;

  return messages.findIndex((m) => {
    if (!isPendingOptimisticRow(m) || m.sender_id !== myUserId) return false;
    if (incomingType && m.message_type && incomingType !== m.message_type) return false;
    if (!withinSendWindow(m.created_at, incoming.created_at, 15_000)) return false;

    if (incoming.reply_to_message_id && m.reply_to_message_id) {
      return incoming.reply_to_message_id === m.reply_to_message_id;
    }

    if (incoming.media_url && m.media_url && incoming.media_url === m.media_url) {
      return true;
    }

    const localContent = trimmedContent(m.content);
    if (incomingContent && localContent) {
      return incomingContent === localContent;
    }

    return !incomingContent && !localContent;
  });
}

export function morphOptimisticIntoServer(
  optimistic: ChatMessage,
  server: ChatMessage,
): ChatMessage {
  const clientMessageId = optimistic.client_message_id || server.client_message_id;
  const localId =
    optimistic.local_id ||
    (isOptimisticChatMessageId(optimistic.id) ? optimistic.id : undefined) ||
    server.local_id;

  const serverSenderUsable = Boolean(
    server.sender?.display_name && String(server.sender.display_name).trim(),
  );

  return {
    ...optimistic,
    ...server,
    id: server.id,
    client_message_id: clientMessageId,
    local_id: localId,
    sender: serverSenderUsable ? server.sender : optimistic.sender,
    reply_to: server.reply_to || optimistic.reply_to,
    reactions:
      server.reactions && server.reactions.length > 0
        ? server.reactions
        : optimistic.reactions,
    reactions_count:
      server.reactions_count ?? optimistic.reactions_count ?? 0,
    metadata: {
      ...(optimistic.metadata || {}),
      ...(server.metadata || {}),
    },
    content: server.content || optimistic.content,
    media_url: server.media_url || optimistic.media_url,
    media_thumbnail_url: server.media_thumbnail_url || optimistic.media_thumbnail_url,
    media_urls: server.media_urls || optimistic.media_urls,
    mentions: server.mentions?.length ? server.mentions : optimistic.mentions,
    mentioned_users: server.mentioned_users?.length
      ? server.mentioned_users
      : optimistic.mentioned_users,
    is_sending: false,
    is_uploading: false,
    send_error: undefined,
    local_media_uri: undefined,
    upload_progress: undefined,
  };
}

function identityKeys(m: ChatMessageIdentity): string[] {
  const keys = [m.id];
  if (m.client_message_id) keys.push(`cid:${m.client_message_id}`);
  if (m.local_id) keys.push(`lid:${m.local_id}`);
  return keys;
}

/** מסיר כפילות אופטימי+שרת אחרי מיזוג / race. */
export function dedupeOwnOutboundCopies(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length < 2) return messages;

  const result: ChatMessage[] = [];
  const indexByKey = new Map<string, number>();

  for (const msg of messages) {
    const keys = identityKeys(msg);
    let existingIdx = -1;
    for (const key of keys) {
      const idx = indexByKey.get(key);
      if (idx != null) {
        existingIdx = idx;
        break;
      }
    }

    if (existingIdx === -1) {
      const idx = result.length;
      result.push(msg);
      for (const key of keys) indexByKey.set(key, idx);
      continue;
    }

    const prev = result[existingIdx];
    const prevTemp = isOptimisticChatMessageId(prev.id);
    const nextTemp = isOptimisticChatMessageId(msg.id);
    const winner =
      prevTemp && !nextTemp
        ? morphOptimisticIntoServer(prev, msg)
        : !prevTemp && nextTemp
          ? morphOptimisticIntoServer(msg, prev)
          : morphOptimisticIntoServer(prev, { ...prev, ...msg });

    result[existingIdx] = winner;
    for (const key of identityKeys(winner)) indexByKey.set(key, existingIdx);
  }

  return result;
}

export function collapseMessagesByClientIdentity(messages: ChatMessage[]): ChatMessage[] {
  return dedupeOwnOutboundCopies(messages);
}

/** שם אמיתי בלבד — לא מציגים את ה-placeholder "משתמש". */
export function isUsableChatDisplayName(name: string | null | undefined): boolean {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 && trimmed !== 'משתמש';
}

/** שם+אווטאר מקומיים מה-thread — בלי רשת, כדי לצייר הודעה נכנסת מיד. */
export function seedSenderFromThread(
  message: ChatMessage,
  thread: ChatMessage[],
): ChatMessage {
  if (message.sender?.display_name && String(message.sender.display_name).trim()) {
    return message;
  }
  if (!message.sender_id || !thread.length) return message;
  const known = thread.find(
    (m) =>
      m.sender_id === message.sender_id &&
      Boolean(m.sender?.display_name && String(m.sender.display_name).trim()),
  );
  if (!known?.sender) return message;
  return { ...message, sender: known.sender };
}

/** reply preview מה-thread המקומי — בלי לחכות ל-fetch. */
export function seedReplyFromThread(
  message: ChatMessage,
  thread: ChatMessage[],
): ChatMessage {
  if (!message.reply_to_message_id || message.reply_to) return message;
  const original = thread.find((m) => m.id === message.reply_to_message_id);
  if (!original) return message;
  return {
    ...message,
    reply_to: {
      message_id: original.id,
      content: original.content,
      message_type: original.message_type,
      media_url: original.media_url,
      sender_id: original.sender_id,
      sender_name: isUsableChatDisplayName(original.sender?.display_name)
        ? String(original.sender?.display_name)
        : '',
    },
  };
}
