import { chatGroupDisplayName } from '../assets/chatGroups/groupChatIcons';
import { queryClient } from './queryClient';
import { appQueryKeys } from './appQueryKeys';
import { mergeChatMessages, readGroupMessagesCache, onlyGroupMessages } from './chatMessageCache';
import type { ChatGroup, ChatGroupWithDetails, ChatMessage } from '../types/chat.types';

/**
 * כניסה אופטימיסטית לצ'אט: כותרת + הודעות מהקאש / שורת הרשימה
 * בלי לחכות ל-selectGroup או ל-transitionEnd.
 */

export type ChatOpenHint = {
  name?: string;
  avatar_url?: string | null;
  unread_count?: number;
  last_read_message_id?: string | null;
  my_role?: ChatGroup['my_role'];
};

export type ChatGroupOpenParams = {
  groupId: string;
  groupName?: string;
  avatarUrl?: string;
  unreadCount?: number;
  lastReadMessageId?: string | null;
  scrollToMessageId?: string;
};

export function readCachedChatGroup(
  userId: string | null | undefined,
  groupId: string,
): ChatGroup | null {
  if (!userId || !groupId) return null;
  const groups = queryClient.getQueryData<ChatGroup[]>(appQueryKeys.chatGroups(userId));
  return groups?.find((g) => g.id === groupId) ?? null;
}

export function buildPrimedGroup(
  groupId: string,
  cached?: ChatGroup | null,
  hint?: ChatOpenHint | null,
): ChatGroupWithDetails {
  const myRole = cached?.my_role ?? hint?.my_role;
  return {
    id: groupId,
    name: (cached?.name || hint?.name || '').trim(),
    description: cached?.description,
    avatar_url: cached?.avatar_url || hint?.avatar_url || undefined,
    created_by: cached?.created_by ?? '',
    created_at: cached?.created_at ?? '',
    updated_at: cached?.updated_at ?? '',
    members_count: cached?.members_count ?? 0,
    messages_count: cached?.messages_count ?? 0,
    last_message_at: cached?.last_message_at,
    last_message_preview: cached?.last_message_preview,
    settings: cached?.settings ?? {},
    unread_count: cached?.unread_count ?? hint?.unread_count ?? 0,
    mentioned_count: cached?.mentioned_count,
    is_muted: cached?.is_muted,
    my_role: myRole,
    last_read_message_id:
      cached?.last_read_message_id ?? hint?.last_read_message_id ?? null,
    last_message_sender_name: cached?.last_message_sender_name,
    last_message_type: cached?.last_message_type,
    members: [],
    is_admin: String(myRole) === 'admin',
  };
}

/** רק הודעות של הקבוצה הנפתחת — לא thread של קבוצה ש־prime כבר החליף לה כותרת. */
export function filterThreadForOpenGroup(
  messages: ChatMessage[] | undefined | null,
  groupId: string,
): ChatMessage[] | null {
  if (!groupId || !messages?.length) return null;
  // רק הודעות של הקבוצה הפתוחה — לעולם לא «כל המערך אם יש התאמה אחת»
  // (זה מה שהציג הודעות של צ'אט אחר כשה-thread היה מעורב)
  if (!messages.some((m) => m.group_id === groupId)) return null;
  const own = onlyGroupMessages(messages, groupId);
  return own.length ? own : null;
}

export function seedMessagesForOpen(
  groupId: string,
  pendingOutbound: ChatMessage[] = [],
  existingForGroup: ChatMessage[] = [],
): ChatMessage[] {
  return mergeChatMessages(
    pendingOutbound,
    readGroupMessagesCache(groupId),
    existingForGroup,
  );
}

export function hasWarmChatMessages(groupId: string): boolean {
  return Boolean(groupId) && readGroupMessagesCache(groupId).length > 0;
}

export function chatMessagesCacheTip(messages: ChatMessage[] | undefined | null): string {
  if (!messages?.length) return '0';
  return `${messages.length}:${messages[0]?.id ?? ''}:${messages[messages.length - 1]?.id ?? ''}`;
}

/** מאזין לכתיבות לקאש הקבוצה (prefetch / disk) כדי לצבוע באמצע ה-slide. */
export function subscribeGroupMessagesCache(
  groupId: string,
  onChange: (messages: ChatMessage[]) => void,
): () => void {
  if (!groupId) return () => {};
  let lastTip = chatMessagesCacheTip(readGroupMessagesCache(groupId));
  return queryClient.getQueryCache().subscribe((event) => {
    const key = event.query.queryKey;
    if (key[0] !== 'chat' || key[1] !== 'messages' || key[2] !== groupId) return;
    const next = (event.query.state.data as ChatMessage[] | undefined) ?? [];
    const nextTip = chatMessagesCacheTip(next);
    if (nextTip === lastTip) return;
    lastTip = nextTip;
    onChange(next);
  });
}

export function chatGroupOpenParams(
  group: {
    id: string;
    name?: string;
    avatar_url?: string | null;
    unread_count?: number;
    last_read_message_id?: string | null;
  },
  extra?: { scrollToMessageId?: string },
): ChatGroupOpenParams {
  return {
    groupId: group.id,
    groupName: chatGroupDisplayName(group.name),
    avatarUrl: group.avatar_url ?? undefined,
    unreadCount: group.unread_count,
    lastReadMessageId: group.last_read_message_id,
    ...extra,
  };
}

export function chatOpenHintFromParams(params: {
  groupName?: string;
  avatarUrl?: string;
  unreadCount?: number;
  lastReadMessageId?: string | null;
}): ChatOpenHint {
  return {
    name: params.groupName,
    avatar_url: params.avatarUrl,
    unread_count: params.unreadCount,
    last_read_message_id: params.lastReadMessageId,
  };
}
