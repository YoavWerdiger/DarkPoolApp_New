// ============================================
// Chat Context
// ============================================
// ניהול State גלובלי של מערכת הצ'אט
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';
import { getChatMessagePreview } from '../utils/chatMessagePreview';
import * as Clipboard from 'expo-clipboard';

import {
  ChatGroup,
  ChatMessage,
  ChatGroupWithDetails,
  ChatTypingIndicator,
  SendChatMessageInput,
  CreateChatGroupInput,
  UpdateChatGroupInput,
  ChatMessageType,
} from '../types/chat.types';
import {
  chatGroupService,
  chatMessageService,
  chatRealtimeService,
  chatMediaService,
  prefetchChatMediaForMessages,
} from '../services/chat';
import { stopRateLimitCleanup } from '../services/chat/chatValidation';
import {
  enqueue as enqueueOffline,
  remove as removeOffline,
  recordAttempt as recordOfflineAttempt,
  peek as peekOffline,
  makeLocalId,
  makeClientMessageId,
  getNewestPersistedMessageId,
  isPersistedChatMessageId,
  isOptimisticChatMessageId,
} from '../services/chat/chatOfflineQueue';
import {
  applyReactionInsert,
  applyReactionRemove,
  totalReactionCount,
} from '../utils/chatReactions';
import { supabase } from '../services/supabase';
import { queryClient } from '../lib/queryClient';
import { appQueryKeys } from '../lib/appQueryKeys';
import { readCachedMessagesForGroup } from '../lib/chatMessagePersist';
import {
  CHAT_AROUND_AFTER,
  CHAT_AROUND_BEFORE,
  CHAT_DELTA_MAX,
  CHAT_DELTA_PAGE,
  CHAT_MESSAGES_MEMORY_CAP,
  CHAT_OPEN_WINDOW_DEFAULT,
  CHAT_OPEN_WINDOW_MAX,
  appendMessageToGroupCache,
  capChatMessages,
  getNewestPersistedCursor,
  mergeChatMessages,
  messageIdInCache,
  readGroupMessagesCache,
  writeGroupMessagesCache,
} from '../lib/chatMessageCache';
import { persistQueryCache } from '../lib/queryPersist';
import { schedulePrefetchChatMessages } from '../services/appPrefetch';
import * as Haptics from 'expo-haptics';
// Audio import removed — notification sound is not yet implemented (no mp3 asset in repo)

const MAX_OFFLINE_RETRY_ATTEMPTS = 5;

function warmChatMediaCache(messages: ChatMessage[]): void {
  if (!messages.length) return;
  void prefetchChatMediaForMessages(messages).catch((e) =>
    logger.warn('ChatContext', 'prefetchChatMediaForMessages failed', e)
  );
}

/** הודעה שחזרה מהשרת — נקה דגלים אופטימיסטיים שלא אמורים להישאר */
function asServerMessage(
  message: ChatMessage,
  extras?: Partial<ChatMessage>,
  preserve?: Pick<ChatMessage, 'reactions' | 'reactions_count' | 'reply_to'>,
): ChatMessage {
  return {
    ...message,
    ...extras,
    reply_to: extras?.reply_to ?? preserve?.reply_to ?? message.reply_to,
    reactions: extras?.reactions ?? preserve?.reactions ?? message.reactions,
    reactions_count:
      extras?.reactions_count ?? preserve?.reactions_count ?? message.reactions_count,
    is_sending: false,
    is_uploading: false,
    local_media_uri: undefined,
    upload_progress: undefined,
  };
}

// ============================================
// Types
// ============================================

// מידע על הודעות לא נקראות כשנכנסים לצ'אט
interface InitialUnreadInfo {
  count: number;
  lastReadMessageId: string | null;
}

/** מצב חיבור Realtime לצ'אט — לבאנרים ו-SLA למשתמש */
export type ChatRealtimeConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';

interface ChatContextType {
  // State
  groups: ChatGroup[];
  currentGroup: ChatGroupWithDetails | null;
  messages: ChatMessage[];
  typingUsers: ChatTypingIndicator[];
  isLoadingGroups: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;

  /** true רק כשהערוץ הראשי מחובר (התנהגות קיימת) */
  isConnected: boolean;
  /** מפורט יותר מ-isConnected — לטקסטים שונים (מתחבר / מנסה שוב / אין חיבור) */
  realtimeConnectionState: ChatRealtimeConnectionState;

  // Unread info when entering chat
  initialUnreadInfo: InitialUnreadInfo | null;

  // Group Actions
  loadGroups: () => Promise<void>;
  selectGroup: (groupId: string) => Promise<void>;
  /** רענון פרטי הקבוצה והחברים מהמסד (בלי לטעון מחדש הודעות) */
  refreshCurrentGroupDetails: () => Promise<void>;
  createGroup: (input: CreateChatGroupInput) => Promise<{ success: boolean; groupId?: string; error?: string }>;
  updateGroup: (groupId: string, input: UpdateChatGroupInput) => Promise<{ success: boolean; error?: string }>;
  leaveGroup: (groupId: string) => Promise<{ success: boolean; error?: string }>;

  // Message Actions
  sendMessage: (input: SendChatMessageInput) => Promise<{ success: boolean; error?: string }>;
  loadMoreMessages: () => Promise<void>;
  loadMessagesAround: (messageId: string) => Promise<{ success: boolean; error?: string }>;
  editMessage: (messageId: string, content: string) => Promise<{ success: boolean; error?: string }>;
  deleteMessage: (messageId: string, deleteForEveryone: boolean) => Promise<{ success: boolean; error?: string }>;
  forwardMessage: (messageId: string, groupIds: string[]) => Promise<{ success: boolean; error?: string }>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  starMessage: (messageId: string, groupId: string) => Promise<void>;
  unstarMessage: (messageId: string) => Promise<void>;

  // Typing
  setTyping: (groupId: string, isTyping: boolean) => Promise<void>;

  // Optimistic Media
  addOptimisticMediaMessage: (message: ChatMessage) => void;
  updateOptimisticMessage: (tempId: string, updates: Partial<ChatMessage>) => void;
  removeOptimisticMessage: (tempId: string) => void;

  // Retry failed message
  retrySendMessage: (tempId: string) => Promise<void>;

  // Read Receipts
  markAsRead: (groupId: string, messageIds: string[]) => Promise<void>;
  /** סימון "נקרא" — גלילה לתחתית / יציאה מהצ'אט. אופציונלי: groupId ספציפי (ביציאה). */
  confirmChatReadAtBottom: (groupId?: string) => Promise<void>;
  /**
   * ביציאה ממסך הצ'אט — מפסיק active-viewer על השרת כדי ש־unread fan-out
   * לא יידלג על המשתמש אחרי שהוא כבר ברשימת הקבוצות.
   */
  leaveChatScreen: (groupId: string) => void;

  // Unread
  totalUnreadCount: number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

type ChatActionsType = Pick<
  ChatContextType,
  | 'loadGroups'
  | 'selectGroup'
  | 'refreshCurrentGroupDetails'
  | 'createGroup'
  | 'updateGroup'
  | 'leaveGroup'
  | 'sendMessage'
  | 'loadMoreMessages'
  | 'loadMessagesAround'
  | 'editMessage'
  | 'deleteMessage'
  | 'forwardMessage'
  | 'addReaction'
  | 'removeReaction'
  | 'starMessage'
  | 'unstarMessage'
  | 'setTyping'
  | 'markAsRead'
  | 'confirmChatReadAtBottom'
  | 'leaveChatScreen'
  | 'addOptimisticMediaMessage'
  | 'updateOptimisticMessage'
  | 'removeOptimisticMessage'
  | 'retrySendMessage'
>;

const ChatActionsContext = createContext<ChatActionsType | undefined>(undefined);

// ============================================
// Provider
// ============================================

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // State
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [currentGroup, setCurrentGroup] = useState<ChatGroupWithDetails | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<ChatTypingIndicator[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [realtimeConnectionState, setRealtimeConnectionState] =
    useState<ChatRealtimeConnectionState>('connecting');
  const isConnected = realtimeConnectionState === 'connected';
  const [initialUnreadInfo, setInitialUnreadInfo] = useState<InitialUnreadInfo | null>(null);

  // Refs
  const messagesRef = useRef<ChatMessage[]>([]);
  const messagesOffset = useRef(0);
  const hasMoreMessages = useRef(true);
  const currentGroupId = useRef<string | null>(null);
  const resubscribeActiveGroupRef = useRef<(() => Promise<void>) | null>(null);
  const personalDeletedIds = useRef<Set<string>>(new Set());
  // C1: version counter to abort stale selectGroup calls
  const selectVersion = useRef(0);
  /** מונע selectGroup:fetch בלולאה על אותה קבוצה (Android thrashing). */
  const selectInFlightRef = useRef<string | null>(null);
  const lastSelectCompletedRef = useRef<{ groupId: string; at: number } | null>(null);
  /** Groups the user already confirmed-read this session — blocks stale group-details/realtime from resurrecting the badge */
  const sessionReadConfirmedRef = useRef<Set<string>>(new Set());
  /** Active chat viewing presence — server skips unread fan-out while fresh */
  const viewingGroupRef = useRef<string | null>(null);
  const viewingHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // C3: track IDs already processed to prevent triple-source duplicates
  const processedMessageIds = useRef<Set<string>>(new Set());
  // C4: ref-based lock to prevent concurrent loadMoreMessages calls
  const isLoadingMoreRef = useRef(false);
  const isLoadingAroundRef = useRef(false);
  // L4: outbound queue is persisted to AsyncStorage (chatOfflineQueue).
  // A single in-flight guard prevents two flushers running concurrently.
  const isFlushing = useRef(false);

  // Typing indicators: client-side staleness guard. Realtime DELETE events can
  // be dropped (reconnects, backgrounding), which would otherwise leave a
  // "מקליד..." indicator stuck forever. The sender refreshes started_typing_at
  // every ~1.5s while typing, so anything older than TYPING_STALE_MS is treated
  // as gone and auto-cleared even without a DELETE event.
  const TYPING_STALE_MS = 6000;
  const typingStaleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingRef = useRef<ChatTypingIndicator[]>([]);

  const applyTypingIndicators = useCallback((indicators: ChatTypingIndicator[]) => {
    lastTypingRef.current = indicators;
    if (typingStaleTimerRef.current) {
      clearTimeout(typingStaleTimerRef.current);
      typingStaleTimerRef.current = null;
    }
    const now = Date.now();
    const ageOf = (i: ChatTypingIndicator) =>
      i.started_typing_at ? now - new Date(i.started_typing_at).getTime() : 0;
    const fresh = indicators.filter((i) => ageOf(i) < TYPING_STALE_MS);
    setTypingUsers(fresh.map((i) => ({ ...i, userName: i.user?.display_name })));
    if (fresh.length > 0) {
      const soonestExpiryIn = Math.min(...fresh.map((i) => TYPING_STALE_MS - ageOf(i)));
      typingStaleTimerRef.current = setTimeout(() => {
        typingStaleTimerRef.current = null;
        // Re-filter the last known set: drops whatever expired, keeps and
        // re-arms for anyone still actively typing.
        applyTypingIndicators(lastTypingRef.current);
      }, Math.max(250, soonestExpiryIn + 100));
    }
  }, []);

  const clearTypingIndicators = useCallback(() => {
    if (typingStaleTimerRef.current) {
      clearTimeout(typingStaleTimerRef.current);
      typingStaleTimerRef.current = null;
    }
    lastTypingRef.current = [];
    setTypingUsers([]);
  }, []);

  const stopGroupViewing = useCallback((groupId?: string | null) => {
    if (viewingHeartbeatRef.current) {
      clearInterval(viewingHeartbeatRef.current);
      viewingHeartbeatRef.current = null;
    }
    const gid = groupId ?? viewingGroupRef.current;
    viewingGroupRef.current = null;
    if (gid) {
      void chatMessageService.setChatGroupViewing(gid, false);
    }
  }, []);

  const startGroupViewing = useCallback((groupId: string) => {
    if (!groupId) return;
    if (viewingGroupRef.current && viewingGroupRef.current !== groupId) {
      void chatMessageService.setChatGroupViewing(viewingGroupRef.current, false);
    }
    viewingGroupRef.current = groupId;
    void chatMessageService.setChatGroupViewing(groupId, true);
    if (viewingHeartbeatRef.current) {
      clearInterval(viewingHeartbeatRef.current);
    }
    viewingHeartbeatRef.current = setInterval(() => {
      if (
        viewingGroupRef.current === groupId &&
        AppState.currentState === 'active'
      ) {
        void chatMessageService.setChatGroupViewing(groupId, true);
      }
    }, 55_000);
  }, []);

  // Keep messagesRef in sync with state
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // סנכרון cache ההודעות (כולל realtime) + גיבוי לדיסק — לכניסה מיידית בפעם הבאה
  useEffect(() => {
    const gid = currentGroupId.current;
    if (!gid || !user?.id || messages.length === 0) return;
    writeGroupMessagesCache(gid, messages, user.id);
  }, [messages, user?.id]);

  // Clear pending read timer when user logs out to avoid stale API calls
  useEffect(() => {
    if (!user) {
      if (readTimerRef.current) {
        clearTimeout(readTimerRef.current);
        readTimerRef.current = null;
      }
      pendingReadRef.current = null;
    }
  }, [user?.id]);

  // Read Receipts (debounced - batches calls within 500ms)
  const pendingReadRef = useRef<{ groupId: string; messageIds: Set<string> } | null>(null);
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memberDetailsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushMarkAsRead = useCallback(async () => {
    const pending = pendingReadRef.current;
    pendingReadRef.current = null;
    if (!user || !pending || pending.messageIds.size === 0) return;
    // Optimistic badge clear — don't wait for network (Android feels stuck otherwise)
    setGroups((prev) =>
      prev.map((g) =>
        g.id === pending.groupId ? { ...g, unread_count: 0, mentioned_count: 0 } : g,
      ),
    );
    try {
      await chatMessageService.markMessagesAsRead(
        { group_id: pending.groupId, message_ids: Array.from(pending.messageIds) },
        user.id
      );
    } catch (error) {
      logger.error('ChatContext', 'Error marking as read', error);
    }
  }, [user]);

  const markAsRead = useCallback(async (groupId: string, messageIds: string[]) => {
    const persistedIds = messageIds.filter(isPersistedChatMessageId);
    if (!user || persistedIds.length === 0) return;

    if (pendingReadRef.current?.groupId === groupId) {
      persistedIds.forEach((id) => pendingReadRef.current!.messageIds.add(id));
    } else {
      if (pendingReadRef.current) {
        await flushMarkAsRead();
      }
      pendingReadRef.current = { groupId, messageIds: new Set(persistedIds) };
    }

    if (readTimerRef.current) clearTimeout(readTimerRef.current);
    readTimerRef.current = setTimeout(flushMarkAsRead, 500);
  }, [user, flushMarkAsRead]);

  const confirmChatReadAtBottom = useCallback(async (groupId?: string) => {
    if (!user) return;
    const gid = groupId ?? currentGroupId.current;
    if (!gid) return;

    // Only clear session unread divider when confirming the active thread
    const isActiveThread = currentGroupId.current === gid;
    const newestPersistedId = isActiveThread
      ? getNewestPersistedMessageId(messagesRef.current)
      : undefined;

    sessionReadConfirmedRef.current.add(gid);

    // Optimistic: badge (+ divider for active thread) clear immediately
    if (isActiveThread) {
      setInitialUnreadInfo(null);
    }
    setGroups((prev) =>
      prev.map((g) =>
        g.id === gid ? { ...g, unread_count: 0, mentioned_count: 0 } : g,
      ),
    );
    // Keep query-cache groups in sync so list badges don't resurrect from stale cache
    const cacheKey = appQueryKeys.chatGroups(user.id);
    const cached = queryClient.getQueryData<ChatGroup[]>(cacheKey);
    if (cached?.length) {
      queryClient.setQueryData(
        cacheKey,
        cached.map((g) =>
          g.id === gid ? { ...g, unread_count: 0, mentioned_count: 0 } : g,
        ),
      );
    }

    try {
      await chatMessageService.markChatAsRead(gid, user.id, newestPersistedId);
    } catch (error) {
      logger.error('ChatContext', 'confirmChatReadAtBottom failed', error);
    }
  }, [user]);

  /** ביציאה ממסך הצ'אט — מפסיק chat_active_viewers כדי ש־unread יתעדכן ברשימה. */
  const leaveChatScreen = useCallback((groupId: string) => {
    if (!groupId) return;
    stopGroupViewing(groupId);
  }, [stopGroupViewing]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Typing
  const setTyping = useCallback(async (groupId: string, isTyping: boolean) => {
    if (!user) return;
    try {
      await chatRealtimeService.setTypingStatus({ group_id: groupId, is_typing: isTyping }, user.id);
    } catch (error) {
      logger.error('ChatContext', 'Error sending typing status', error);
    }
  }, [user]);


  // ============================================
  // Load groups
  // ============================================

  const loadGroups = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;

    const cacheKey = appQueryKeys.chatGroups(userId);
    const cached = queryClient.getQueryData<ChatGroup[]>(cacheKey);
    if (cached?.length) {
      setGroups(cached);
      setIsLoadingGroups(false);
    } else {
      setIsLoadingGroups(true);
    }

    try {
      // staleTime:0 — תמיד מרעננים אחרי hydrate (שנחשב "טרי"); אם warm כבר בטיסה — RQ ממזג
      const data = await queryClient.fetchQuery({
        queryKey: cacheKey,
        queryFn: async () => {
          const { data: groups, error } = await chatGroupService.getChatGroups(userId);
          if (error) throw error;
          return groups ?? [];
        },
        staleTime: 0,
      });
      setGroups(data);
      void persistQueryCache(userId);
      // עדיפות unread בלבד — warmAppCache כבר מריץ warm מלא; התור ממזג אם שניהם רצים
      const unreadIds = data
        .filter((g) => (g.unread_count || 0) > 0)
        .map((g) => g.id);
      if (unreadIds.length > 0) {
        schedulePrefetchChatMessages(userId, { groupIds: unreadIds });
      }
    } catch (error) {
      logger.error('ChatContext', 'Error loading groups', error);
    } finally {
      setIsLoadingGroups(false);
    }
    // חשוב: user?.id ולא [user] — TOKEN_REFRESHED יוצר אובייקט user חדש ומפעיל לולאת load/realtime
  }, [user?.id]);

  // ============================================
  // Shared helper: fetch reply_to data for a message (cached)
  // ============================================
  const replyToCacheRef = useRef<Map<string, ChatMessage['reply_to']>>(new Map());

  const fetchReplyToData = useCallback(async (replyToMessageId: string): Promise<ChatMessage['reply_to'] | undefined> => {
    const cached = replyToCacheRef.current.get(replyToMessageId);
    if (cached) return cached;

    try {
      const { data: replyToMessage } = await supabase
        .from('chat_messages')
        .select(`
          id,
          content,
          message_type,
          media_url,
          sender_id,
          sender:users!chat_messages_sender_id_fkey (
            id,
            display_name
          )
        `)
        .eq('id', replyToMessageId)
        .single();

      if (replyToMessage) {
        const sender = Array.isArray(replyToMessage.sender)
          ? replyToMessage.sender[0]
          : replyToMessage.sender;
        const result = {
          message_id: replyToMessage.id,
          content: replyToMessage.content,
          message_type: replyToMessage.message_type,
          media_url: replyToMessage.media_url,
          sender_id: replyToMessage.sender_id,
          sender_name: sender?.display_name || 'משתמש',
        };
        replyToCacheRef.current.set(replyToMessageId, result);
        if (replyToCacheRef.current.size > 500) {
          const firstKey = replyToCacheRef.current.keys().next().value;
          if (firstKey) replyToCacheRef.current.delete(firstKey);
        }
        return result;
      }
    } catch (error) {
      logger.error('ChatContext', 'Error loading reply_to message', error);
    }
    return undefined;
  }, []);

  /** מוסיף הודעה חדשה ל-thread הפעיל (realtime קבוצה + גיבוי membership). */
  const ingestIncomingInsert = useCallback(async (rawMessage: ChatMessage) => {
    const me = userRef.current;
    if (!me || rawMessage.group_id !== currentGroupId.current) return;
    if (rawMessage.is_silent || rawMessage.is_system_message) return;

    let enrichedMessage = rawMessage;
    if (enrichedMessage.reply_to_message_id && !enrichedMessage.reply_to) {
      const replyTo = await fetchReplyToData(enrichedMessage.reply_to_message_id);
      if (replyTo) {
        enrichedMessage = { ...enrichedMessage, reply_to: replyTo };
      }
    }
    enrichedMessage = await chatRealtimeService.enrichChatMessageSender(enrichedMessage);

    if (processedMessageIds.current.has(enrichedMessage.id)) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === enrichedMessage.id ? asServerMessage(m, enrichedMessage) : m
        )
      );
      return;
    }

    if (enrichedMessage.sender_id === me.id) {
      processedMessageIds.current.add(enrichedMessage.id);
      setMessages((prev) => {
        const optimisticIndex = prev.findIndex((m) => {
          if (!m.id.startsWith('temp-') || m.sender_id !== me.id) return false;
          if (enrichedMessage.reply_to_message_id && m.reply_to_message_id) {
            return (
              m.reply_to_message_id === enrichedMessage.reply_to_message_id &&
              Math.abs(
                new Date(m.created_at).getTime() -
                  new Date(enrichedMessage.created_at).getTime()
              ) < 10000
            );
          }
          return (
            m.message_type === enrichedMessage.message_type &&
            m.content === enrichedMessage.content &&
            Math.abs(
              new Date(m.created_at).getTime() -
                new Date(enrichedMessage.created_at).getTime()
            ) < 10000
          );
        });

        if (optimisticIndex !== -1) {
          const optimisticMsg = prev[optimisticIndex];
          const finalMessage = asServerMessage(
            enrichedMessage,
            { reply_to: optimisticMsg.reply_to || enrichedMessage.reply_to },
            {
              reactions: optimisticMsg.reactions,
              reactions_count: optimisticMsg.reactions_count,
              reply_to: optimisticMsg.reply_to,
            },
          );
          return prev.map((m, idx) => (idx === optimisticIndex ? finalMessage : m));
        }

        const existingIndex = prev.findIndex((m) => m.id === enrichedMessage.id);
        if (existingIndex !== -1) {
          return prev.map((m, idx) =>
            idx === existingIndex ? asServerMessage(m, enrichedMessage) : m
          );
        }
        return [asServerMessage(enrichedMessage), ...prev];
      });
    } else {
      processedMessageIds.current.add(enrichedMessage.id);
      setMessages((prev) => {
        const existingIndex = prev.findIndex((m) => m.id === enrichedMessage.id);
        if (existingIndex !== -1) {
          return prev.map((m, idx) => (idx === existingIndex ? enrichedMessage : m));
        }
        return [enrichedMessage, ...prev];
      });
      Haptics.selectionAsync().catch(() => {});
    }

    if (currentGroupId.current === enrichedMessage.group_id) {
      markAsRead(enrichedMessage.group_id, [enrichedMessage.id]);
    }
    warmChatMediaCache([enrichedMessage]);
  }, [fetchReplyToData, markAsRead]);

  const ingestIncomingInsertRef = useRef(ingestIncomingInsert);
  useEffect(() => {
    ingestIncomingInsertRef.current = ingestIncomingInsert;
  }, [ingestIncomingInsert]);

  /** משלים שם+אווטאר ברקע להודעות שכבר על המסך (קאש / אחרי UPDATE) בלי לחסום TTI. */
  const hydrateMissingSenders = useCallback(
    (groupId: string, version: number, snapshot?: ChatMessage[]) => {
      const source = snapshot ?? messagesRef.current;
      if (!source.length) return;
      const needsEnrich = source.some(
        (m) => m.sender_id && !chatRealtimeService.hasUsableSender(m.sender),
      );
      if (!needsEnrich) return;

      void chatRealtimeService.enrichChatMessagesSenders(source).then((enriched) => {
        if (selectVersion.current !== version) return;
        if (currentGroupId.current !== groupId) return;

        const byId = new Map(enriched.map((m) => [m.id, m]));
        setMessages((prev) => {
          let changed = false;
          const next = prev.map((m) => {
            if (chatRealtimeService.hasUsableSender(m.sender)) return m;
            const e = byId.get(m.id);
            if (!e?.sender || !chatRealtimeService.hasUsableSender(e.sender)) return m;
            changed = true;
            return { ...m, sender: e.sender };
          });
          return changed ? next : prev;
        });
      });
    },
    [],
  );

  // ============================================
  // Select group
  // ============================================

  const selectGroup = useCallback(async (groupId: string) => {
    if (!user) return;

    // P0: עצירת thrashing — אותה קבוצה כבר ב-fetch / נטענה זה עתה עם subscription חי
    if (selectInFlightRef.current === groupId) {
      logger.debug('ChatContext', `selectGroup:skip in-flight groupId=${groupId}`);
      return;
    }
    const isSameGroupEarly = currentGroupId.current === groupId;
    const lastDone = lastSelectCompletedRef.current;
    if (
      isSameGroupEarly &&
      messagesRef.current.length > 0 &&
      chatRealtimeService.isGroupRealtimeSubscribed(groupId) &&
      lastDone?.groupId === groupId &&
      Date.now() - lastDone.at < 4000
    ) {
      logger.debug('ChatContext', `selectGroup:skip fresh groupId=${groupId}`);
      return;
    }

    const isSameGroup = currentGroupId.current === groupId;
    const keepVisibleThread = isSameGroup && messagesRef.current.length > 0;

    const groupAlreadySubscribed =
      isSameGroup && chatRealtimeService.isGroupRealtimeSubscribed(groupId);

    if (!isSameGroup && currentGroupId.current) {
      stopGroupViewing(currentGroupId.current);
      void chatRealtimeService.unsubscribeFromGroup(currentGroupId.current);
    } else if (isSameGroup && !groupAlreadySubscribed && !keepVisibleThread) {
      void chatRealtimeService.unsubscribeFromGroup(groupId);
    }

    // C2: bump version so any prior in-flight selectGroup call detects it's stale
    const version = ++selectVersion.current;
    selectInFlightRef.current = groupId;
    if (!isSameGroup) {
      processedMessageIds.current.clear();
    }

    // שימור הודעות אופטימיסטיות (בשליחה) לפני איפוס – מונע "היעלמות" כשחוזרים למסך
    const optimisticsToKeep =
      isSameGroup
        ? messagesRef.current.filter(
            (m) =>
              m.id.startsWith('temp-') &&
              m.sender_id === user.id &&
              (m.is_sending || m.is_uploading)
          )
        : [];

    currentGroupId.current = groupId;
    startGroupViewing(groupId);
    if (!isSameGroup) {
      // כניסה מחדש לקבוצה — אפשר שוב להציג unread מהשרת/cache
      sessionReadConfirmedRef.current.delete(groupId);
    }

    // אופטימי: זריעת currentGroup מיידית מה-cache של רשימת הקבוצות.
    // מונע את ה-skeleton המלא ("מסך תקוע") ומציג כותרת/שם הקבוצה מיד בכניסה,
    // בזמן שפרטי הקבוצה המלאים וההודעות נטענים ברקע.
    if (!isSameGroup) {
      const cachedGroups = queryClient.getQueryData<ChatGroup[]>(
        appQueryKeys.chatGroups(user.id),
      );
      const cachedGroup = cachedGroups?.find((g) => g.id === groupId);
      if (cachedGroup) {
        setCurrentGroup({
          ...cachedGroup,
          members: [],
          is_admin: String(cachedGroup.my_role) === 'admin',
          last_read_message_id: cachedGroup.last_read_message_id ?? null,
        });
      }
    }

    if (!keepVisibleThread) {
      // אופטימי: זריעת הודעות מיידית מה-cache (stale-while-revalidate).
      // Memory hit → setState סינכרוני לפני כל await (TTI = 1 frame עם ChatGroupScreen seed).
      // Disk miss בזיכרון → לא חוסמים רשת: hydrate/disk רצים במקביל ל-fetch.
      const cachedMessages = queryClient.getQueryData<ChatMessage[]>(
        appQueryKeys.chatMessages(groupId),
      );
      if (cachedMessages?.length) {
        setMessages(cachedMessages);
        messagesOffset.current = cachedMessages.length;
        hasMoreMessages.current = true;
        setIsLoadingMessages(false);
        warmChatMediaCache(cachedMessages);
        hydrateMissingSenders(groupId, version, cachedMessages);
      } else {
        setIsLoadingMessages(true);
        if (!isSameGroup) {
          // לא להציג thread של קבוצה אחרת; מסך יציג skeleton עד disk/network
          setMessages([]);
        }
        messagesOffset.current = isSameGroup ? messagesRef.current.length : 0;
        hasMoreMessages.current = true;
        // Disk/hydrate במקביל — לא await לפני fetch (רגרסיית iOS: serial await על open path)
        void readCachedMessagesForGroup(user.id, groupId).then((diskMessages) => {
          if (selectVersion.current !== version) return;
          if (!diskMessages?.length) return;
          const cur = messagesRef.current;
          const alreadyForGroup =
            cur.length > 0 &&
            cur.some((m) => m.group_id === groupId && !m.id.startsWith('temp-'));
          if (alreadyForGroup) return;
          setMessages(diskMessages);
          messagesOffset.current = diskMessages.length;
          hasMoreMessages.current = true;
          setIsLoadingMessages(false);
          warmChatMediaCache(diskMessages);
          hydrateMissingSenders(groupId, version, diskMessages);
        });
      }
      clearTypingIndicators();
    }

    // כבר בצ'אט עם הודעות טעונות — בלי reload/markAsRead (מונע קפיצות גלילה)
    const skipMessageReload = isSameGroup && keepVisibleThread;

    // unread meta — מתעדכן כש־group details חוזר; נזרע גם מ־cache הרשימה ל־first paint.
    // חשוב: לא לאפס ל-null ואז לכתוב שוב באותו select — זה גרם ל-divider/badge
    // להבהב (value→null→value) ולשבור גלילה ראשונית ב-Android.
    const unreadMeta = {
      ready: false,
      count: 0,
      lastReadMessageId: null as string | null,
      markedRead: false,
    };
    if (!keepVisibleThread && !skipMessageReload) {
      const cachedGroups = queryClient.getQueryData<ChatGroup[]>(
        appQueryKeys.chatGroups(user.id),
      );
      const cachedGroup = cachedGroups?.find((g) => g.id === groupId);
      if (cachedGroup) {
        unreadMeta.ready = true;
        unreadMeta.count = cachedGroup.unread_count || 0;
        unreadMeta.lastReadMessageId = cachedGroup.last_read_message_id ?? null;
        // count=0 חייב להיות אובייקט (לא null) — null = "עדיין לא ידוע",
        // ואז ChatGroupScreen נתקע ב-bottom-lite לנצח בלי לסיים גלילה לתחתית.
        logger.debug(
          'ChatContext',
          `setInitialUnreadInfo source=cache-group groupId=${groupId} count=${unreadMeta.count} lastReadId=${unreadMeta.lastReadMessageId ?? 'null'}`,
        );
        setInitialUnreadInfo({
          count: unreadMeta.count,
          lastReadMessageId: unreadMeta.lastReadMessageId,
        });
      } else {
        logger.debug(
          'ChatContext',
          `setInitialUnreadInfo(null) no-cache groupId=${groupId}`,
        );
        setInitialUnreadInfo(null);
      }
    }

    const markReadIfNeeded = (newestMessageId: string | undefined) => {
      if (skipMessageReload || unreadMeta.markedRead) return;
      if (!unreadMeta.ready || unreadMeta.count > 0 || !newestMessageId) return;
      unreadMeta.markedRead = true;
      void chatMessageService.markChatAsRead(groupId, user.id, newestMessageId).then(() => {
        if (selectVersion.current !== version) return;
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId ? { ...g, unread_count: 0, mentioned_count: 0 } : g,
          ),
        );
      });
    };

    const applyUnreadCorrection = (apiMessages: ChatMessage[]) => {
      if (!unreadMeta.ready || !unreadMeta.lastReadMessageId || apiMessages.length === 0) return;
      const lastReadIndex = apiMessages.findIndex((m) => m.id === unreadMeta.lastReadMessageId);
      if (lastReadIndex === -1) return;
      // newest-first: indices before lastRead are unread; never count UI dividers
      const actualUnreadCount = apiMessages
        .slice(0, lastReadIndex)
        .filter(
          (m) =>
            m.sender_id !== user.id &&
            !m.is_silent &&
            !m.is_system_message &&
            !m.id.startsWith('temp-'),
        ).length;
      if (actualUnreadCount === unreadMeta.count) return;

      logger.debug(
        'ChatContext',
        `Correcting unread count: server=${unreadMeta.count}, actual=${actualUnreadCount}`,
      );
      unreadMeta.count = actualUnreadCount;
      logger.debug(
        'ChatContext',
        `setInitialUnreadInfo source=correction groupId=${groupId} count=${actualUnreadCount} lastReadId=${unreadMeta.lastReadMessageId ?? 'null'}`,
      );
      setInitialUnreadInfo({
        count: actualUnreadCount,
        lastReadMessageId: unreadMeta.lastReadMessageId,
      });
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, unread_count: actualUnreadCount } : g,
        ),
      );
    };

    try {
      // פרטי קבוצה (כולל members) איטיים — לא חוסמים first paint / הודעות.
      const groupDetailsPromise = chatGroupService.getChatGroupDetails(groupId, user.id);

      // אסטרטגיית fetch: לא טוענים היסטוריה מלאה.
      // - יש קאש + last_read בתוכו / אין unread → רק הודעות חדשות מאז הקאש (delta)
      // - יש unread ו-last_read מחוץ לקאש → חלון מוגבל סביב last_read
      // - אין קאש → חלון אחרון קטן (עם תקרה גם אם unread ענק)
      type FetchMode = 'skip' | 'delta' | 'around' | 'fresh';
      let fetchMode: FetchMode = 'skip';
      const cachedSnapshot = skipMessageReload ? [] : readGroupMessagesCache(groupId);
      const cachedForFetch = skipMessageReload
        ? []
        : cachedSnapshot.length > 0
          ? cachedSnapshot
          : messagesRef.current;
      const newestCached = getNewestPersistedCursor(cachedForFetch);
      const lastReadInCache = messageIdInCache(
        cachedForFetch,
        unreadMeta.lastReadMessageId,
      );
      const unreadCount = unreadMeta.count || 0;

      let messagesPromise: Promise<{
        messages: ChatMessage[];
        has_more: boolean;
        mode: FetchMode;
      } | null> | null = null;

      if (skipMessageReload) {
        fetchMode = 'skip';
        messagesPromise = null;
      } else if (
        newestCached &&
        cachedForFetch.length > 0 &&
        (unreadCount === 0 || lastReadInCache || !unreadMeta.lastReadMessageId)
      ) {
        fetchMode = 'delta';
        // lean: בלי reactions/starred/reads/reply enrichment — חוסך 4 שאילתות לכל עמוד.
        // קריטי כשיש catch-up אחרי יום "חופר" (מאות הודעות); UI מתעשר ברקע/realtime.
        // אם הפער גדול מ-CHAT_DELTA_MAX — ה-delta לבד מחזיר את *תחילת* הפער (ישן),
        // לא את הטיפ העדכני. לכן ממזגים גם חלון אחרון (tip) כדי שהמסך לא יישאר על הודעות מיושנות.
        messagesPromise = chatMessageService
          .fetchMessagesSince(groupId, user.id, newestCached.created_at, {
            pageSize: CHAT_DELTA_PAGE,
            maxTotal: CHAT_DELTA_MAX,
            lean: true,
          })
          .then(async ({ data, error, has_more }) => {
            if (error) {
              logger.warn('ChatContext', 'selectGroup delta fetch failed', error);
              return null;
            }
            let messages = data ?? [];
            if (has_more) {
              const tipRes = await chatMessageService.getChatMessages(
                groupId,
                user.id,
                { limit: CHAT_OPEN_WINDOW_DEFAULT, offset: 0 },
                undefined,
                { lean: true },
              );
              if (tipRes.data?.messages?.length) {
                messages = mergeChatMessages(tipRes.data.messages, messages);
              }
            }
            return { messages, has_more, mode: 'delta' as const };
          });
      } else if (unreadCount > 0 && unreadMeta.lastReadMessageId && !lastReadInCache) {
        // אם ה-unread נכנס בחלון מוגבל של ההודעות האחרונות — מספיק fresh (tip + divider).
        // אחרת: around ל-last_read + tip אחרון (בלי למשוך אלפי הודעות).
        const fitsInLatestWindow = unreadCount + 15 <= CHAT_OPEN_WINDOW_MAX;
        if (fitsInLatestWindow) {
          fetchMode = 'fresh';
          messagesPromise = chatMessageService
            .getChatMessages(
              groupId,
              user.id,
              {
                limit: Math.min(CHAT_OPEN_WINDOW_MAX, unreadCount + 15),
                offset: 0,
              },
              undefined,
              { lean: true },
            )
            .then((res) =>
              res.data
                ? {
                    messages: res.data.messages,
                    has_more: res.data.has_more,
                    mode: 'fresh' as const,
                  }
                : null,
            );
        } else {
          fetchMode = 'around';
          messagesPromise = Promise.all([
            chatMessageService.fetchMessagesAround(
              groupId,
              user.id,
              unreadMeta.lastReadMessageId,
              { before: CHAT_AROUND_BEFORE, after: CHAT_AROUND_AFTER, lean: true },
            ),
            chatMessageService.getChatMessages(
              groupId,
              user.id,
              {
                limit: CHAT_OPEN_WINDOW_DEFAULT,
                offset: 0,
              },
              undefined,
              { lean: true },
            ),
          ]).then(([aroundRes, tipRes]) => {
            const merged = mergeChatMessages(
              aroundRes.data,
              tipRes.data?.messages,
            );
            if (!merged.length) {
              logger.warn('ChatContext', 'selectGroup around+tip fetch empty', aroundRes.error);
              return null;
            }
            return { messages: merged, has_more: true, mode: 'around' as const };
          });
        }
      } else {
        fetchMode = 'fresh';
        const initialLimit = Math.min(
          CHAT_OPEN_WINDOW_MAX,
          Math.max(CHAT_OPEN_WINDOW_DEFAULT, unreadCount > 0 ? unreadCount + 15 : CHAT_OPEN_WINDOW_DEFAULT),
        );
        messagesPromise = chatMessageService
          .getChatMessages(
            groupId,
            user.id,
            { limit: initialLimit, offset: 0 },
            undefined,
            { lean: true },
          )
          .then((res) =>
            res.data
              ? {
                  messages: res.data.messages,
                  has_more: res.data.has_more,
                  mode: 'fresh' as const,
                }
              : null,
          );
      }

      logger.debug(
        'ChatContext',
        `selectGroup:fetch groupId=${groupId} mode=${fetchMode} cached=${cachedForFetch.length} cachedUnread=${unreadCount} lastReadId=${unreadMeta.lastReadMessageId ?? 'null'} lastReadInCache=${lastReadInCache}`,
      );

      void groupDetailsPromise.then((groupResult) => {
        if (selectVersion.current !== version) return;
        const { data: groupData, error: groupError } = groupResult;
        if (groupError) {
          logger.error('ChatContext', 'Failed to load group details', groupError);
          return;
        }
        if (!groupData) return;

        const detailsAlreadyRead = sessionReadConfirmedRef.current.has(groupId);
        setCurrentGroup(
          detailsAlreadyRead
            ? { ...groupData, unread_count: 0, mentioned_count: 0 }
            : groupData,
        );

        if (skipMessageReload) return;

        // Stale details that raced after confirm-read must not bring the badge back
        if (detailsAlreadyRead) {
          unreadMeta.ready = true;
          unreadMeta.count = 0;
          unreadMeta.lastReadMessageId = groupData.last_read_message_id || null;
          setInitialUnreadInfo({
            count: 0,
            lastReadMessageId: unreadMeta.lastReadMessageId,
          });
          setGroups((prev) =>
            prev.map((g) =>
              g.id === groupId ? { ...g, unread_count: 0, mentioned_count: 0 } : g,
            ),
          );
          markReadIfNeeded(
            messagesRef.current.find((m) => !m.id.startsWith('temp-'))?.id,
          );
          return;
        }

        unreadMeta.ready = true;
        unreadMeta.count = groupData.unread_count || 0;
        unreadMeta.lastReadMessageId = groupData.last_read_message_id || null;

        logger.debug(
          'ChatContext',
          `setInitialUnreadInfo source=group-details groupId=${groupId} count=${unreadMeta.count} lastReadId=${unreadMeta.lastReadMessageId ?? 'null'}`,
        );
        setInitialUnreadInfo({
          count: unreadMeta.count,
          lastReadMessageId: unreadMeta.lastReadMessageId,
        });
        if (unreadMeta.count === 0) {
          setGroups((prev) =>
            prev.map((g) =>
              g.id === groupId ? { ...g, unread_count: 0, mentioned_count: 0 } : g,
            ),
          );
        }

        applyUnreadCorrection(messagesRef.current);
        const newest = messagesRef.current.find((m) => !m.id.startsWith('temp-'));
        markReadIfNeeded(newest?.id);
      });

      if (!skipMessageReload && messagesPromise) {
        const fetchResult = await messagesPromise;

        if (selectVersion.current !== version) return;
        if (fetchResult) {
          const apiMessages = fetchResult.messages;
          const mode = fetchResult.mode;
          const usedApiIndices = new Set<number>();
          const stillPending = optimisticsToKeep.filter((opt) => {
            const optTime = new Date(opt.created_at).getTime();
            const matchIdx = apiMessages.findIndex((api, idx) => {
              if (usedApiIndices.has(idx)) return false;
              if (api.sender_id !== user.id) return false;
              if (Math.abs(new Date(api.created_at).getTime() - optTime) >= 15000) return false;
              const contentMatch = api.content === opt.content;
              const emptyContent = !(api.content || '').trim() && !(opt.content || '').trim();
              const typeMatch = api.message_type === opt.message_type && emptyContent;
              return contentMatch || typeMatch;
            });
            if (matchIdx !== -1) {
              usedApiIndices.add(matchIdx);
              return false;
            }
            return true;
          });

          // delta/around: ממזגים עם קאש קיים. fresh: מחליפים (או ממזגים אם כבר זרענו מקאש).
          const baseForMerge =
            mode === 'fresh' && cachedForFetch.length === 0
              ? []
              : (messagesRef.current.length > 0 ? messagesRef.current : cachedForFetch);

          if (mode === 'delta' && apiMessages.length === 0) {
            // אין חדשות — משאירים קאש, רק סוגרים טעינה (+ השלמת שולחים חסרים)
            setIsLoadingMessages(false);
            hasMoreMessages.current = true;
            const newest = getNewestPersistedCursor(messagesRef.current);
            markReadIfNeeded(newest?.id);
            hydrateMissingSenders(groupId, version, messagesRef.current);
          } else {
            const merged = capChatMessages(
              mergeChatMessages(stillPending, apiMessages, baseForMerge),
              CHAT_MESSAGES_MEMORY_CAP,
            );

            setMessages(merged);
            messagesOffset.current = merged.length;
            hasMoreMessages.current = mode === 'fresh' ? fetchResult.has_more : true;
            setIsLoadingMessages(false);
            warmChatMediaCache(mode === 'delta' ? apiMessages : merged);
            writeGroupMessagesCache(groupId, merged, user.id);
            hydrateMissingSenders(groupId, version, merged);

            try {
              const requiredUnread = unreadMeta.count || 0;
              const lastReadIdxLog = unreadMeta.lastReadMessageId
                ? merged.findIndex((m) => m.id === unreadMeta.lastReadMessageId)
                : -1;
              const unreadInWindow = lastReadIdxLog === -1 ? 0 : lastReadIdxLog;
              logger.debug(
                'ChatContext',
                `messagesLoaded groupId=${groupId} mode=${mode} fetched=${apiMessages.length} total=${merged.length} unreadInWindow=${unreadInWindow} requiredUnread=${requiredUnread} lastReadIdxInWindow=${lastReadIdxLog}`,
              );
            } catch {
              /* ignore */
            }

            applyUnreadCorrection(merged);
            markReadIfNeeded(merged.find((m) => !m.id.startsWith('temp-'))?.id);
          }
        } else {
          setIsLoadingMessages(false);
        }
      }

      if (selectVersion.current !== version) return;

      if (skipMessageReload && groupAlreadySubscribed) {
        chatRealtimeService.startTypingCleanup();
        lastSelectCompletedRef.current = { groupId, at: Date.now() };
        return;
      }

      // M5: start typing cleanup only when actively in a chat room
      chatRealtimeService.startTypingCleanup();

      // Subscribe to realtime updates
      const groupRealtimeListeners: Parameters<typeof chatRealtimeService.subscribeToGroup>[2] = {
        onMessage: async (message, eventType) => {
          if (eventType === 'INSERT') {
            await ingestIncomingInsertRef.current(message);
          } else if (eventType === 'UPDATE') {
            // postgres_changes UPDATE מגיע בלי join ל-users — אסור לדרוס sender קיים
            // (read_by_count / reactions_count גורמים ל-UPDATE תכופים).
            const existing = messagesRef.current.find((m) => m.id === message.id);
            let enrichedMessage: ChatMessage = {
              ...message,
              sender: chatRealtimeService.hasUsableSender(message.sender)
                ? chatRealtimeService.normalizeChatSender(message.sender)
                : existing?.sender,
              reply_to: message.reply_to || existing?.reply_to,
            };

            if (enrichedMessage.reply_to_message_id && !enrichedMessage.reply_to) {
              const replyTo = await fetchReplyToData(enrichedMessage.reply_to_message_id);
              if (replyTo) {
                enrichedMessage = { ...enrichedMessage, reply_to: replyTo };
              }
            }
            if (!chatRealtimeService.hasUsableSender(enrichedMessage.sender)) {
              enrichedMessage =
                await chatRealtimeService.enrichChatMessageSender(enrichedMessage);
            }

            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== enrichedMessage.id) return m;
                return {
                  ...enrichedMessage,
                  reactions: m.reactions,
                  reactions_count:
                    enrichedMessage.reactions_count ?? m.reactions_count,
                  reply_to: enrichedMessage.reply_to || m.reply_to,
                  sender: chatRealtimeService.hasUsableSender(enrichedMessage.sender)
                    ? enrichedMessage.sender
                    : m.sender,
                };
              }),
            );
          } else if (eventType === 'DELETE') {
            // Deleted message
            setMessages(prev => prev.filter(m => m.id !== message.id));
          }
        },
        onReaction: async (reaction, eventType) => {
          if (reaction.user_id === user.id) return;
          if (
            typeof reaction.emoji !== 'string' ||
            reaction.emoji.length === 0 ||
            reaction.emoji.length > 20
          ) {
            return;
          }

          const actor = {
            id: reaction.user_id,
            name: reaction.user?.display_name || 'משתמש',
            profile_picture: reaction.user?.profile_picture,
          };

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== reaction.message_id) return m;
              const reactions =
                eventType === 'INSERT'
                  ? applyReactionInsert(m.reactions, reaction.emoji, actor, {
                      isActorMe: false,
                    })
                  : applyReactionRemove(m.reactions, reaction.emoji, reaction.user_id, user.id);
              if (reactions === m.reactions) return m;
              return { ...m, reactions, reactions_count: totalReactionCount(reactions) };
            }),
          );
        },
        onTyping: (indicators) => {
          applyTypingIndicators(indicators as ChatTypingIndicator[]);
        },
        onMember: (_data, _eventType) => {
          if (memberDetailsRefreshTimerRef.current) {
            clearTimeout(memberDetailsRefreshTimerRef.current);
          }
          memberDetailsRefreshTimerRef.current = setTimeout(() => {
            memberDetailsRefreshTimerRef.current = null;
            const gid = currentGroupId.current;
            if (!gid || !userRef.current) return;
            void chatGroupService.getChatGroupDetails(gid, userRef.current.id).then(
              ({ data: groupDetails, error: detailsError }) => {
                if (detailsError) {
                  logger.error('ChatContext', 'onMember: failed to reload group details', detailsError);
                }
                if (groupDetails && currentGroupId.current === gid) {
                  setCurrentGroup(groupDetails);
                }
              },
            );
          }, 500);
        },
        onReadReceipt: (read) => {
          if (read.user_id === user.id) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === read.message_id && m.sender_id === user.id
                ? { ...m, read_by_count: (m.read_by_count || 0) + 1 }
                : m
            )
          );
        },
        onGroup: (data) => {
          // Use functional update to avoid stale closure on currentGroup
          setCurrentGroup(prev => prev ? { ...prev, ...data } : prev);
        },
      };
      resubscribeActiveGroupRef.current = async () => {
        const gid = currentGroupId.current;
        const uid = userRef.current?.id;
        if (!uid || !gid) return;
        // רק אם הערוץ מת — לא לפרק subscription בריא (מונע CLOSED thrash)
        if (chatRealtimeService.isGroupRealtimeSubscribed(gid)) {
          // רענון listeners בלבד (subscribeToGroup early-return מעדכן את ה-map)
          await chatRealtimeService.subscribeToGroup(gid, uid, groupRealtimeListeners);
          return;
        }
        chatRealtimeService.clearFailedChannel(gid);
        await chatRealtimeService.unsubscribeFromGroup(gid);
        await chatRealtimeService.subscribeToGroup(gid, uid, groupRealtimeListeners);
      };
      void chatRealtimeService.subscribeToGroup(groupId, user.id, groupRealtimeListeners);
      if (selectVersion.current === version) {
        lastSelectCompletedRef.current = { groupId, at: Date.now() };
      }
    } catch (error) {
      logger.error('ChatContext', 'Error selecting group', error);
    } finally {
      if (selectInFlightRef.current === groupId) {
        selectInFlightRef.current = null;
      }
      setIsLoadingMessages(false);
    }
  }, [user?.id, startGroupViewing, stopGroupViewing, hydrateMissingSenders]);

  const refreshCurrentGroupDetails = useCallback(async () => {
    if (!user || !currentGroupId.current) return;
    const gid = currentGroupId.current;
    const { data, error } = await chatGroupService.getChatGroupDetails(gid, user.id);
    if (error) {
      logger.error('ChatContext', 'refreshCurrentGroupDetails failed', error);
      return;
    }
    if (!data || currentGroupId.current !== gid) return;
    setCurrentGroup(data);
    setGroups((prev) =>
      prev.map((g) =>
        g.id === gid
          ? {
              ...g,
              name: data.name,
              description: data.description,
              avatar_url: data.avatar_url,
              members_count: data.members_count,
              messages_count: data.messages_count,
              updated_at: data.updated_at,
              is_muted: data.is_muted,
            }
          : g
      )
    );
  }, [user]);

  // ============================================
  // Load more messages
  // ============================================

  const loadMoreMessages = useCallback(async () => {
    // C4: ref-based lock prevents concurrent calls (state updates are async)
    if (!user || !currentGroupId.current || !hasMoreMessages.current || isLoadingMoreRef.current) {
      return;
    }

    // Hard memory cap — stop loading history when we have enough in RAM
    if (messagesRef.current.length >= CHAT_MESSAGES_MEMORY_CAP) {
      hasMoreMessages.current = false;
      return;
    }

    isLoadingMoreRef.current = true;
    logger.info('ChatContext', `loadMoreMessages start (have ${messagesRef.current.length})`);
    try {
      const oldestMessage = messagesRef.current[messagesRef.current.length - 1];
      const cursor = oldestMessage?.created_at;

      const { data } = await chatMessageService.getChatMessages(
        currentGroupId.current,
        user.id,
        { limit: 50, before: cursor }
      );

      if (data) {
        const existingIds = new Set(messagesRef.current.map(m => m.id));
        const newMessages = data.messages.filter(m => !existingIds.has(m.id));
        warmChatMediaCache(newMessages);

        setMessages(prev => {
          const combined = mergeChatMessages(prev, data.messages);
          return capChatMessages(combined, CHAT_MESSAGES_MEMORY_CAP);
        });
        hasMoreMessages.current = data.has_more;
        logger.info(
          'ChatContext',
          `loadMoreMessages +${newMessages.length} total=${messagesRef.current.length + newMessages.length} hasMore=${data.has_more}`,
        );
      }
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [user]);

  const loadMessagesAround = useCallback(async (messageId: string) => {
    if (!user || !currentGroupId.current) {
      return { success: false, error: 'לא מחובר או אין קבוצה נבחרת' };
    }

    if (messagesRef.current.some((m) => m.id === messageId)) {
      return { success: true };
    }

    if (isLoadingAroundRef.current) {
      // Allow a second jump target while load is in flight — don't block scroll-to-reply
      await new Promise((r) => setTimeout(r, 150));
      if (messagesRef.current.some((m) => m.id === messageId)) {
        return { success: true };
      }
    }

    isLoadingAroundRef.current = true;

    try {
      const { data: combined, error } = await chatMessageService.fetchMessagesAround(
        currentGroupId.current,
        user.id,
        messageId,
        { before: 50, after: 50 },
      );

      if (error || !combined?.length) {
        return { success: false, error: error?.message || 'לא נמצאו הודעות' };
      }

      const all = capChatMessages(
        mergeChatMessages(messagesRef.current, combined),
        CHAT_MESSAGES_MEMORY_CAP,
      );
      setMessages(all);
      messagesOffset.current = all.length;
      warmChatMediaCache(combined);
      writeGroupMessagesCache(currentGroupId.current, all, user.id);
      return { success: true };
    } catch (error: any) {
      logger.error('ChatContext', 'Error loading messages around', error);
      return { success: false, error: error.message };
    } finally {
      isLoadingAroundRef.current = false;
    }
  }, [user]);

  // ============================================
  // Create group
  // ============================================

  const createGroup = useCallback(async (input: CreateChatGroupInput) => {
    if (!user) return { success: false, error: 'לא מחובר' };

    const { data, error } = await chatGroupService.createChatGroup(input, user.id);

    if (data) {
      // Add to groups list
      setGroups(prev => [data, ...prev]);
      return { success: true, groupId: data.id };
    }

    return { success: false, error: error?.message };
  }, [user]);

  // ============================================
  // Update group
  // ============================================

  const updateGroup = useCallback(async (groupId: string, input: UpdateChatGroupInput) => {
    if (!user) return { success: false, error: 'לא מחובר' };

    const { data, error } = await chatGroupService.updateChatGroup(groupId, input, user.id);

    if (data) {
      // Update in groups list
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...data } : g));

      // Update current group if selected
      if (currentGroup?.id === groupId) {
        setCurrentGroup({ ...currentGroup, ...data });
      }

      return { success: true };
    }

    return { success: false, error: error?.message };
  }, [user, currentGroup]);



  const leaveGroup = useCallback(async (groupId: string) => {
    if (!user) return { success: false, error: 'לא מחובר' };

    const { error } = await chatGroupService.removeGroupMember(groupId, user.id, user.id);

    if (!error) {
      // Always unsubscribe — don't rely on currentGroup state which may be stale
      // when the user is on a nested screen (e.g. ChatGroupInfoScreen)
      chatRealtimeService.unsubscribeFromGroup(groupId);

      // The global `user-membership:{userId}:messages` channel filters incoming
      // chat_messages by `userGroupsCache`. The cache is normally invalidated
      // by a Realtime DELETE event on chat_group_members, but Postgres only
      // emits the PRIMARY KEY (`id`) on DELETE unless REPLICA IDENTITY FULL is
      // set, so neither the filter nor `payload.old.group_id` are reliable.
      // Update the cache explicitly to make sure the user stops receiving
      // realtime updates for the group they just left.
      chatRealtimeService.updateUserGroupsCache(user.id, groupId, 'remove');

      // Remove from groups list
      setGroups(prev => prev.filter(g => g.id !== groupId));

      // Clear current group using the ref (always up-to-date) instead of state
      if (currentGroupId.current === groupId) {
        stopGroupViewing(groupId);
        currentGroupId.current = null;
        setCurrentGroup(null);
        setMessages([]);
        clearTypingIndicators();
      }

      return { success: true };
    }

    logger.error('ChatContext', 'leaveGroup failed', error);
    return { success: false, error: error.message };
  }, [user, stopGroupViewing, clearTypingIndicators]);

  // ============================================
  // Send message
  // ============================================

  const sendMessage = useCallback(async (input: SendChatMessageInput) => {
    if (!user) return { success: false, error: 'לא מחובר' };

    setIsSendingMessage(true);

    let replyToData: ChatMessage['reply_to'] | undefined;
    if (input.reply_to_message_id) {
      const originalMessage = messagesRef.current.find(m => m.id === input.reply_to_message_id);
      if (originalMessage) {
        replyToData = {
          message_id: originalMessage.id,
          content: originalMessage.content,
          message_type: originalMessage.message_type,
          media_url: originalMessage.media_url,
          sender_id: originalMessage.sender_id,
          sender_name: originalMessage.sender?.display_name || 'משתמש',
        };
      } else {
        replyToData = await fetchReplyToData(input.reply_to_message_id);
      }
    }

    // הודעה אופטימיסטית – או חדשה או עדכון לקיימת (מדיה - כבר נוספה ב-ChatInput)
    const tempId = input.existing_optimistic_id ?? makeLocalId();
    // Stable client-generated id. Travels with every retry so the server (once
    // the chat_messages.client_message_id unique index ships) can dedupe.
    const clientMessageId =
      (input as SendChatMessageInput & { client_message_id?: string }).client_message_id ??
      makeClientMessageId();
    const enrichedInput: SendChatMessageInput & { client_message_id: string } = {
      ...input,
      client_message_id: clientMessageId,
    };
    const optimisticMessage: ChatMessage = {
      id: tempId,
      group_id: input.group_id,
      sender_id: user.id,
      content: input.content || '',
      message_type: input.message_type,
      media_url: input.media_url,
      media_thumbnail_url: input.media_thumbnail_url || input.metadata?.media_thumbnail_url,
      media_type: input.media_type,
      media_file_name: input.media_file_name || input.metadata?.media_file_name,
      media_size: input.media_size || input.metadata?.media_size,
      media_duration: input.media_duration || input.metadata?.media_duration,
      media_urls: input.media_urls || input.metadata?.media_urls,
      reply_to_message_id: input.reply_to_message_id,
      reply_to: replyToData,
      is_forwarded: false,
      mentioned_users: input.mentioned_users || [],
      is_edited: false,
      is_deleted: false,
      deleted_for_everyone: false,
      is_silent: input.is_silent || false,
      is_system_message: false,
      created_at: new Date().toISOString(),
      reactions_count: 0,
      read_by_count: 0,
      sender: {
        id: user.id,
        display_name: user?.display_name || 'אני',
        profile_picture: user?.profile_picture,
        is_online: true,
      },
      is_sending: true,
      is_uploading: false,
      local_media_uri: undefined,
      metadata: input.metadata,
    };

    if (input.existing_optimistic_id) {
      // מדיה – עדכן את ההודעה הקיימת (לא להסיר ולהוסיף – מונע flicker)
      // שמירה על content/metadata.waveform מהאופטימיסטי כששולחים content ריק
      setMessages(prev => prev.map(m => {
        if (m.id !== tempId) return m;
        const next = { ...m, ...optimisticMessage };
        if (!optimisticMessage.content && m.content) {
          next.content = m.content;
        }
        if (m.metadata?.waveformData && !optimisticMessage.metadata?.waveformData) {
          next.metadata = { ...optimisticMessage.metadata, ...m.metadata };
        } else if (m.metadata?.waveformData || optimisticMessage.metadata?.waveformData) {
          next.metadata = {
            ...m.metadata,
            ...optimisticMessage.metadata,
            waveformData:
              optimisticMessage.metadata?.waveformData ?? m.metadata?.waveformData,
          };
        }
        if (m.local_media_uri && !optimisticMessage.media_url) {
          next.local_media_uri = m.local_media_uri;
        }
        return next;
      }));
    } else {
      setMessages(prev => [optimisticMessage, ...prev]);
    }

    try {
      const { data, error } = await chatMessageService.sendChatMessage(enrichedInput, user.id);

      if (data) {
        processedMessageIds.current.add(data.id);

        // שומרים waveform מהאופטימיסטי אם השרת לא מחזיר metadata (נשמר ב־content)
        const prior = messagesRef.current.find((m) => m.id === tempId);
        const mergedMetadata = {
          ...(prior?.metadata || {}),
          ...(input.metadata || {}),
          ...(data.metadata || {}),
        };
        if (!mergedMetadata.waveformData && prior?.metadata?.waveformData) {
          mergedMetadata.waveformData = prior.metadata.waveformData;
        }

        const finalMessage = asServerMessage(data, {
          reply_to: data.reply_to || replyToData,
          metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : data.metadata,
          // content מהשרת כבר כולל waveform; אם ריק — שמור אופטימיסטי
          content: data.content || prior?.content || input.content || '',
        });

        // החלף את האופטימיסטי בהודעה האמיתית
        setMessages(prev => {
          const realAlready = prev.findIndex(m => m.id === data.id);
          if (realAlready !== -1) {
            // realtime הספיק – עדכן in-place והסר אופטימיסטי
            return prev
              .filter(m => m.id !== tempId)
              .map(m => m.id === data.id ? finalMessage : m);
          }
          // החלפה רגילה של אופטימיסטי
          return prev.map(m => m.id === tempId ? finalMessage : m);
        });

        setGroups(prev => prev.map(g =>
          g.id === input.group_id
            ? {
              ...g,
              last_message_at: data.created_at,
              last_message_preview: getChatMessagePreview(data.message_type, data.content),
              last_message_sender_name:
                data.sender?.display_name ||
                user?.display_name ||
                user?.full_name ||
                'משתמש',
              last_message_type: data.message_type,
              messages_count: g.messages_count + 1,
            }
            : g
        ));

        return { success: true };
      } else {
        const errMsg = error?.message || '';
        const isNetworkError = !isConnected ||
          errMsg.toLowerCase().includes('network') ||
          errMsg.toLowerCase().includes('fetch') ||
          errMsg.toLowerCase().includes('timeout') ||
          error?.code === 'NETWORK_ERROR';

        if (isNetworkError) {
          // L4: persist to AsyncStorage so app-kill / device reboot does not
          // lose the message. Mark the optimistic bubble as "waiting for
          // connection" but keep it on screen.
          await enqueueOffline({
            local_id: tempId,
            client_message_id: clientMessageId,
            sender_id: user.id,
            payload: { ...input, sender_id: user.id },
          });
          setMessages(prev => prev.map(m =>
            m.id === tempId ? { ...m, is_sending: false, send_error: 'ממתין לחיבור...' } : m
          ));
          return { success: false, error: 'אין חיבור – ההודעה תישלח כשהחיבור יחזור', queued: true } as any;
        }

        // שגיאה רגילה – סמן על האופטימיסטי ואפשר retry
        logger.error('ChatContext', `Error sending message: ${errMsg || error?.code || 'Unknown'}`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setMessages(prev => prev.map(m =>
          m.id === tempId ? { ...m, is_sending: false, send_error: errMsg || 'שגיאה בשליחת הודעה' } : m
        ));
        return { success: false, error: errMsg || 'שגיאה בשליחת הודעה' };
      }
    } finally {
      setIsSendingMessage(false);
    }
  }, [user, isConnected]);

  // ============================================
  // Edit message
  // ============================================

  const editMessage = useCallback(async (messageId: string, content: string, mentions?: any[]) => {
    if (!user) return { success: false, error: 'לא מחובר' };

    // Optimistic update — show edited content immediately
    const originalMessage = messagesRef.current.find(m => m.id === messageId);
    setMessages(prev => prev.map(m =>
      m.id === messageId
        ? { ...m, content, is_edited: true, edited_at: new Date().toISOString() }
        : m
    ));

    const mentionedUserIds = mentions?.map((m: any) => m.id).filter(Boolean);
    const { data, error } = await chatMessageService.editChatMessage(
      { message_id: messageId, content, mentioned_users: mentionedUserIds },
      user.id
    );

    if (data) {
      setMessages(prev => prev.map(m => m.id === messageId ? data : m));
      return { success: true };
    }

    // Rollback on failure
    if (originalMessage) {
      setMessages(prev => prev.map(m => m.id === messageId ? originalMessage : m));
    }
    return { success: false, error: error?.message };
  }, [user]);

  // ============================================
  // Delete message
  // ============================================

  const deleteMessage = useCallback(async (messageId: string, deleteForEveryone: boolean) => {
    if (!user) return { success: false, error: 'לא מחובר' };

    const { error } = await chatMessageService.deleteChatMessage(
      { message_id: messageId, delete_for_everyone: deleteForEveryone },
      user.id
    );

    if (!error) {
      // הסרת ההודעה מה-state המקומי - גם במחיקה אישית וגם במחיקה לכולם
      setMessages(prev => prev.filter(m => m.id !== messageId));

      // אם זו מחיקה אישית, נוסיף את ה-ID ל-Set של הודעות שנמחקו אישית
      if (!deleteForEveryone) {
        personalDeletedIds.current.add(messageId);
      }

      return { success: true };
    }

    return { success: false, error: error.message };
  }, [user]);

  // ============================================
  // Forward message
  // ============================================

  const forwardMessage = useCallback(async (messageId: string, groupIds: string[]) => {
    if (!user) return { success: false, error: 'לא מחובר' };

    const { errors } = await chatMessageService.forwardChatMessage(
      { message_id: messageId, to_group_ids: groupIds },
      user.id
    );

    if (!errors || errors.size === 0) {
      return { success: true };
    }

    return { success: false, error: 'שגיאה בהעברת ההודעה' };
  }, [user]);

  // ============================================
  // Reactions
  // ============================================

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user || isOptimisticChatMessageId(messageId)) return;

    const actor = {
      id: user.id,
      name: user?.display_name || 'אני',
      profile_picture: user?.profile_picture,
    };

    // Realtime מתעלם מריאקציות שלי — ה-UI תלוי בעדכון אופטימיסטי.
    // אם ההודעה עדיין רק ב-cache (טרם selectGroup), ממזגים אותה ל-state.
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx >= 0) {
        const m = prev[idx];
        const reactions = applyReactionInsert(m.reactions, emoji, actor, { isActorMe: true });
        if (reactions === m.reactions) return prev;
        const next = prev.slice();
        next[idx] = { ...m, reactions, reactions_count: totalReactionCount(reactions) };
        return next;
      }
      const gid = currentGroupId.current;
      const cached = gid ? readGroupMessagesCache(gid) : [];
      const source = cached.find((m) => m.id === messageId);
      if (!source) return prev;
      const reactions = applyReactionInsert(source.reactions, emoji, actor, { isActorMe: true });
      return mergeChatMessages(
        [{ ...source, reactions, reactions_count: totalReactionCount(reactions) }],
        prev,
      );
    });

    const { error } = await chatMessageService.addReaction({ message_id: messageId, emoji }, user.id);
    if (error) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = applyReactionRemove(m.reactions, emoji, user.id, user.id);
          return { ...m, reactions, reactions_count: totalReactionCount(reactions) };
        }),
      );
      logger.error('ChatContext', 'addReaction failed, rolled back', error);
    }
  }, [user]);

  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user || isOptimisticChatMessageId(messageId)) return;

    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx >= 0) {
        const m = prev[idx];
        const reactions = applyReactionRemove(m.reactions, emoji, user.id, user.id);
        if (reactions === m.reactions) return prev;
        const next = prev.slice();
        next[idx] = { ...m, reactions, reactions_count: totalReactionCount(reactions) };
        return next;
      }
      const gid = currentGroupId.current;
      const cached = gid ? readGroupMessagesCache(gid) : [];
      const source = cached.find((m) => m.id === messageId);
      if (!source) return prev;
      const reactions = applyReactionRemove(source.reactions, emoji, user.id, user.id);
      return mergeChatMessages(
        [{ ...source, reactions, reactions_count: totalReactionCount(reactions) }],
        prev,
      );
    });

    const { error } = await chatMessageService.removeReaction({ message_id: messageId, emoji }, user.id);
    if (error) {
      const actor = {
        id: user.id,
        name: user?.display_name || 'אני',
        profile_picture: user?.profile_picture,
      };
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = applyReactionInsert(m.reactions, emoji, actor, { isActorMe: true });
          return { ...m, reactions, reactions_count: totalReactionCount(reactions) };
        }),
      );
      logger.error('ChatContext', 'removeReaction failed, rolled back', error);
    }
  }, [user]);

  // ============================================
  // Star message
  // ============================================

  const starMessage = useCallback(async (messageId: string, groupId: string) => {
    if (!user) return;
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, is_starred_by_me: true } : m
    ));
    const { error } = await chatMessageService.starMessage(messageId, groupId, user.id);
    if (error) {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, is_starred_by_me: false } : m
      ));
      logger.error('ChatContext', 'starMessage failed', error);
    }
  }, [user]);

  const unstarMessage = useCallback(async (messageId: string) => {
    if (!user) return;
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, is_starred_by_me: false } : m
    ));
    const { error } = await chatMessageService.unstarMessage(messageId, user.id);
    if (error) {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, is_starred_by_me: true } : m
      ));
      logger.error('ChatContext', 'unstarMessage failed', error);
    }
  }, [user]);



  // ============================================
  // Calculate total unread
  // ============================================

  const totalUnreadCount = useMemo(() => groups.reduce((sum, g) => sum + (g.unread_count || 0), 0), [groups]);

  // ============================================
  // Effects
  // ============================================

  // Load groups on mount + Realtime + Fallback polling
  useEffect(() => {
    if (!user) {
      return;
    }

    loadGroups();
  }, [user?.id, loadGroups]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setRealtimeConnectionState('connecting');

    // Wire connection status — באנרים נפרדים ל"מנסה שוב" מול "נותקנו"
    chatRealtimeService.onConnectionStatusChange((status) => {
      if (status === 'CONNECTED') {
        setRealtimeConnectionState('connected');
      } else if (status === 'RECONNECTING') {
        setRealtimeConnectionState('reconnecting');
      } else {
        setRealtimeConnectionState('offline');
      }

      // L4: flush persisted offline queue when connection is restored.
      // Per-message attempt counter (persisted) prevents one bad message from
      // blocking the rest; exponential backoff between consecutive failures.
      if (status === 'CONNECTED' && !isFlushing.current) {
        isFlushing.current = true;
        const flush = async () => {
          try {
            while (true) {
              const queued = await peekOffline();
              if (queued.length === 0) break;
              const next = queued[0];

              // Safety: discard queued messages that don't belong to the current user.
              // This can happen if the user logged out and someone else logged in
              // before the connection was restored.
              if (!user || next.sender_id !== user.id) {
                logger.warn('ChatContext', 'Discarding offline message from different user, dropping', next.local_id);
                await removeOffline(next.local_id);
                setMessages(prev => prev.filter(m => m.id !== next.local_id));
                continue;
              }

              try {
                const enrichedPayload: SendChatMessageInput & { client_message_id: string } = {
                  ...next.payload,
                  client_message_id: next.client_message_id,
                };
                const { data, error } = await chatMessageService.sendChatMessage(
                  enrichedPayload,
                  next.sender_id
                );
                if (data) {
                  await removeOffline(next.local_id);
                  processedMessageIds.current.add(data.id);
                  if (data.group_id === currentGroupId.current) {
                    setMessages(prev => {
                      const tempIdx = prev.findIndex(m => m.id === next.local_id);
                      if (tempIdx !== -1) {
                        return prev.map((m, idx) => (idx === tempIdx ? { ...data } : m));
                      }
                      if (prev.some(m => m.id === data.id)) return prev;
                      return [{ ...data }, ...prev];
                    });
                  }
                } else {
                  await recordOfflineAttempt(next.local_id, error?.message);
                  const attempts = next.attempts + 1;
                  if (attempts >= MAX_OFFLINE_RETRY_ATTEMPTS) {
                    await removeOffline(next.local_id);
                    setMessages(prev => prev.map(m =>
                      m.id === next.local_id
                        ? { ...m, is_sending: false, send_error: error?.message || 'נכשל בשליחה לאחר ניסיונות חוזרים' }
                        : m
                    ));
                    logger.error('ChatContext', 'Dropping queued message after max attempts', { local_id: next.local_id, error });
                  } else {
                    // Exponential backoff: 1s, 2s, 4s, 8s, 16s. Cap at 30s.
                    const delay = Math.min(1000 * Math.pow(2, attempts - 1), 30_000);
                    await new Promise(r => setTimeout(r, delay));
                  }
                }
              } catch (e) {
                logger.error('ChatContext', 'Offline queue flush threw', e);
                await recordOfflineAttempt(next.local_id, e instanceof Error ? e.message : String(e));
                const attempts = next.attempts + 1;
                if (attempts >= MAX_OFFLINE_RETRY_ATTEMPTS) {
                  await removeOffline(next.local_id);
                  setMessages(prev => prev.map(m =>
                    m.id === next.local_id
                      ? { ...m, is_sending: false, send_error: 'נכשל בשליחה' }
                      : m
                  ));
                } else {
                  await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempts - 1), 30_000)));
                }
              }
            }
          } finally {
            isFlushing.current = false;
          }
        };
        flush().catch(e => {
          logger.error('ChatContext', 'Offline flush failed completely', e);
          isFlushing.current = false;
        });
      }
    });

    // M5: typing cleanup only starts when the user actually enters a chat (in selectGroup)
    chatRealtimeService.updateOnlineStatus(user.id, true);

    // הרשמה לכל הקבוצות של המשתמש דרך Realtime בלבד
    logger.debug('ChatContext', `Setting up realtime subscription for user: ${user.id}`);

    const handleMembershipRemoved = (removedGroupId: string) => {
      logger.debug('ChatContext', `Removed from group ${removedGroupId} — cleaning up`);
      setGroups(prev => prev.filter(g => g.id !== removedGroupId));
      chatRealtimeService.unsubscribeFromGroup(removedGroupId);
      if (currentGroupId.current === removedGroupId) {
        stopGroupViewing(removedGroupId);
        setCurrentGroup(null);
        setMessages([]);
        clearTypingIndicators();
        currentGroupId.current = null;
        resubscribeActiveGroupRef.current = null;
      }
    };

    const handleGlobalNewMessage = (groupId: string, message: ChatMessage) => {
      logger.debug('ChatContext', `onNewMessage: group=${groupId} msg=${message.id}`);
      const viewingThisGroup = viewingGroupRef.current === groupId;
      // הודעה חדשה כשלא צופים — לאפשר שוב badge (ביטול suppress אחרי confirm-read)
      if (!viewingThisGroup) {
        sessionReadConfirmedRef.current.delete(groupId);
      }
      // postgres_changes לא כולל join ל-users — משיגים שם שולח לפרביו ברשימה
      void (async () => {
        let senderName =
          message.sender?.display_name ||
          (message.sender as { full_name?: string } | undefined)?.full_name ||
          '';
        if (!senderName && message.sender_id) {
          const enriched = await chatRealtimeService.enrichChatMessageSender(message);
          senderName = enriched.sender?.display_name || '';
          if (!senderName) {
            const { data: nameRows } = await supabase.rpc('get_user_display_names', {
              user_ids: [message.sender_id],
            });
            senderName =
              (nameRows as Array<{ display_name: string }> | null)?.[0]?.display_name || '';
          }
        }
        const preview = getChatMessagePreview(message.message_type, message.content);
        setGroups((prev) => {
          const next = prev.map((g) => {
            if (g.id !== groupId) return g;
            const stillViewing = viewingGroupRef.current === groupId;
            return {
              ...g,
              last_message_at: message.created_at,
              last_message_preview: preview,
              last_message_sender_name: senderName || 'משתמש',
              last_message_type: message.message_type,
              // אופטימי: אם עדיין אין membership UPDATE — השורה עולה עם badge
              ...(stillViewing
                ? {}
                : { unread_count: (g.unread_count || 0) + 1 }),
            };
          });
          if (user?.id) {
            queryClient.setQueryData(appQueryKeys.chatGroups(user.id), next);
          }
          return next;
        });
      })();
      // קאש per-group: גם כשהצ'אט לא פתוח — הודעת realtime נכנסת לקאש (עם sender)
      if (!viewingThisGroup) {
        void chatRealtimeService.enrichChatMessageSender(message).then((enriched) => {
          appendMessageToGroupCache(groupId, enriched, user.id);
        });
      }
      // רק כשבאמת צופים במסך הצ'אט — לא כש־currentGroupId נשאר sticky אחרי יציאה
      if (viewingThisGroup) {
        void ingestIncomingInsertRef.current(message);
      }
    };

    const applyMembershipGroupPatch = (groupId: string, data: any) => {
      setGroups((prev) => {
        let changed = false;
        const next = prev.map((g) => {
          if (g.id !== groupId) return g;

          const patch = { ...data } as Partial<ChatGroup>;
          // אחרי confirm-read בזמן צפייה — לא לתת ל-realtime ישן להחזיר badge.
          // אחרי יציאה / הודעה חדשה sessionReadConfirmed מנוקה — לא מדכאים unread לגיטימי.
          const suppressStaleUnread =
            sessionReadConfirmedRef.current.has(groupId) &&
            viewingGroupRef.current === groupId &&
            (patch.unread_count ?? 0) > 0;
          if (suppressStaleUnread) {
            patch.unread_count = 0;
            patch.mentioned_count = 0;
          }

          const newUnread = patch.unread_count ?? g.unread_count;
          const newMentioned = patch.mentioned_count ?? g.mentioned_count;

          if (
            newUnread === g.unread_count &&
            newMentioned === g.mentioned_count &&
            !patch.last_message_at &&
            !patch.last_message_preview &&
            !patch.name &&
            !patch.avatar_url
          ) {
            return g;
          }

          if (
            (newUnread || 0) > 0 &&
            (newUnread || 0) > (g.unread_count || 0) &&
            viewingGroupRef.current !== groupId
          ) {
            schedulePrefetchChatMessages(user.id, { groupIds: [groupId] });
          }

          changed = true;
          return { ...g, ...patch };
        });
        if (changed && user?.id) {
          queryClient.setQueryData(appQueryKeys.chatGroups(user.id), next);
        }
        return changed ? next : prev;
      });
    };

    const subscribeAllGroups = () => {
      chatRealtimeService.subscribeToAllUserGroups(
        user.id,
        handleGlobalNewMessage,
        (groupId, data) => {
          logger.debug('ChatContext', `onGroupUpdate: group=${groupId}`);
          applyMembershipGroupPatch(groupId, data);
        },
        handleMembershipRemoved
      );
    };

    subscribeAllGroups();

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const appStateRef = { current: AppState.currentState };

    const presenceHeartbeat = setInterval(() => {
      if (AppState.currentState === 'active') {
        chatRealtimeService.updateOnlineStatus(user.id, true);
      }
    }, 90_000);

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState.match(/inactive|background/)) {
        chatRealtimeService.updateOnlineStatus(user.id, false);
        if (viewingGroupRef.current) {
          void chatMessageService.setChatGroupViewing(viewingGroupRef.current, false);
        }
        return;
      }

      if (prevState.match(/inactive|background/) && nextState === 'active') {
        chatRealtimeService.updateOnlineStatus(user.id, true);
        if (viewingGroupRef.current) {
          void chatMessageService.setChatGroupViewing(viewingGroupRef.current, true);
        }

        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          // setAuth רק אם הטוקן באמת השתנה — אחרת socket closed → CLOSED thrash
          void chatRealtimeService.ensureRealtimeAuth().then(() => {
            const membershipOk = chatRealtimeService.isMembershipRealtimeHealthy(user.id);
            if (Platform.OS === 'android') {
              logger.debug(
                'ChatContext',
                `[ChatRealtime][Android] AppState active membershipOk=${membershipOk}`,
              );
            }
            if (!membershipOk) {
              chatRealtimeService.clearFailedChannels();
              void chatRealtimeService.subscribeToAllUserGroups(
                user.id,
                handleGlobalNewMessage,
                (groupId, data) => {
                  logger.debug('ChatContext', `onGroupUpdate: group=${groupId}`);
                  applyMembershipGroupPatch(groupId, data);
                },
                handleMembershipRemoved,
                { force: true }
              );
            } else {
              // רענון callbacks בלי teardown
              void chatRealtimeService.subscribeToAllUserGroups(
                user.id,
                handleGlobalNewMessage,
                (groupId, data) => {
                  applyMembershipGroupPatch(groupId, data);
                },
                handleMembershipRemoved,
              );
            }
            void resubscribeActiveGroupRef.current?.();
          });
        }, 800);
      }
    });

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(presenceHeartbeat);
      appStateSub.remove();
      // קודם ערוצים — בלי UPDATE ל-users ב-logout (אין סשן → RLS / noise ב-Sentry)
      stopGroupViewing(viewingGroupRef.current);
      chatRealtimeService.stopTypingCleanup();
      chatRealtimeService.unsubscribeAll();
      chatRealtimeService.onConnectionStatusChange(null);
      setRealtimeConnectionState('connecting');
      resubscribeActiveGroupRef.current = null;
    };
  }, [user?.id, stopGroupViewing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGroupViewing(viewingGroupRef.current);
      if (currentGroupId.current) {
        chatRealtimeService.unsubscribeFromGroup(currentGroupId.current);
      }
      chatRealtimeService.stopTypingCleanup();
      chatRealtimeService.onConnectionStatusChange(null);
      stopRateLimitCleanup();
      if (readTimerRef.current) {
        clearTimeout(readTimerRef.current);
        readTimerRef.current = null;
      }
      pendingReadRef.current = null;
    };
  }, [stopGroupViewing]);

  // ============================================
  // Optimistic Media Functions
  // ============================================

  const addOptimisticMediaMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [message, ...prev]);
  }, []);

  const updateOptimisticMessage = useCallback((tempId: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => 
      m.id === tempId ? { ...m, ...updates } : m
    ));
  }, []);

  const removeOptimisticMessage = useCallback((tempId: string) => {
    setMessages(prev => prev.filter(m => m.id !== tempId));
  }, []);

  const retrySendMessage = useCallback(async (tempId: string) => {
    const failed = messagesRef.current.find(m => m.id === tempId && m.send_error);
    if (!failed || !currentGroupId.current || !user) return;

    const groupId = currentGroupId.current;
    setMessages(prev => prev.map(m =>
      m.id === tempId
        ? { ...m, send_error: undefined, is_sending: true, is_uploading: !!m.local_media_uri }
        : m
    ));

    try {
      let mediaUrl = failed.media_url;
      let thumbUrl = failed.media_thumbnail_url;
      const metadata: Record<string, unknown> = { existing_optimistic_id: tempId };
      if (failed.metadata?.waveformData) {
        metadata.waveformData = failed.metadata.waveformData;
      }
      if (failed.media_duration != null) {
        metadata.media_duration = failed.media_duration;
      }

      if (failed.local_media_uri) {
        const onProgress = (progress: { progress: number }) => {
          setMessages(prev => prev.map(m =>
            m.id === tempId ? { ...m, upload_progress: progress.progress } : m
          ));
        };

        let uploadResult: {
          url: string | null;
          thumbnail_url?: string | null;
          error: { message?: string } | null;
        };

        switch (failed.message_type) {
          case ChatMessageType.VIDEO:
            uploadResult = await chatMediaService.uploadVideo(failed.local_media_uri, groupId, onProgress);
            break;
          case ChatMessageType.AUDIO:
            uploadResult = await chatMediaService.uploadAudio(
              failed.local_media_uri,
              groupId,
              failed.media_duration || 0,
              onProgress,
            );
            break;
          case ChatMessageType.DOCUMENT:
            uploadResult = await chatMediaService.uploadDocument(
              failed.local_media_uri,
              failed.media_file_name || 'document',
              groupId,
              onProgress,
            );
            break;
          default:
            uploadResult = await chatMediaService.uploadImage(
              failed.local_media_uri,
              groupId,
              onProgress,
              {
                localThumbnailUri:
                  failed.media_thumbnail_url &&
                  (failed.media_thumbnail_url.startsWith('file:') ||
                    failed.media_thumbnail_url.startsWith('content:'))
                    ? failed.media_thumbnail_url
                    : null,
              },
            );
        }

        if (uploadResult.error || !uploadResult.url) {
          throw new Error(uploadResult.error?.message || 'שגיאה בהעלאה');
        }

        mediaUrl = uploadResult.url;
        if (uploadResult.thumbnail_url) {
          metadata.media_thumbnail_url = uploadResult.thumbnail_url;
          // שומרים thumb מקומי להצגה מיידית; הנתיב בשרת נשמר ב-metadata לנתיב קבוע
          const keepLocal =
            !!failed.media_thumbnail_url &&
            (failed.media_thumbnail_url.startsWith('file:') ||
              failed.media_thumbnail_url.startsWith('content:'));
          if (!keepLocal) thumbUrl = uploadResult.thumbnail_url;
        }

        setMessages(prev => prev.map(m =>
          m.id === tempId
            ? {
                ...m,
                media_url: mediaUrl,
                media_thumbnail_url: thumbUrl,
                local_media_uri: undefined,
                is_uploading: false,
                upload_progress: 100,
              }
            : m
        ));
      }

      const result = await sendMessage({
        group_id: groupId,
        content: failed.content ?? '',
        message_type: failed.message_type,
        media_url: mediaUrl,
        media_thumbnail_url: thumbUrl,
        media_file_name: failed.media_file_name,
        media_size: failed.media_size,
        media_duration: failed.media_duration,
        media_urls: failed.media_urls,
        reply_to_message_id: failed.reply_to_message_id,
        metadata,
        existing_optimistic_id: tempId,
      });

      if (!result.success && !(result as { queued?: boolean }).queued) {
        throw new Error(result.error || 'שגיאה בשליחה חוזרת');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'שגיאה בשליחה חוזרת';
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, is_sending: false, is_uploading: false, send_error: message }
          : m
      ));
    }
  }, [sendMessage, user]);

  // ============================================
  // Context value
  // ============================================

  const value = useMemo<ChatContextType>(() => ({
    groups,
    currentGroup,
    messages,
    typingUsers,
    isLoadingGroups,
    isLoadingMessages,
    isSendingMessage,
    initialUnreadInfo,
    loadGroups,
    selectGroup,
    refreshCurrentGroupDetails,
    createGroup,
    updateGroup,
    leaveGroup,
    sendMessage,
    loadMoreMessages,
    loadMessagesAround,
    editMessage,
    deleteMessage,
    forwardMessage,
    addReaction,
    removeReaction,
    starMessage,
    unstarMessage,
    setTyping,
    markAsRead,
    confirmChatReadAtBottom,
    leaveChatScreen,
    isConnected,
    realtimeConnectionState,
    totalUnreadCount,
    addOptimisticMediaMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
    retrySendMessage,
  }), [
    groups, currentGroup, messages, typingUsers,
    isLoadingGroups, isLoadingMessages, isSendingMessage,
    initialUnreadInfo, isConnected, realtimeConnectionState, totalUnreadCount,
    loadGroups, selectGroup, refreshCurrentGroupDetails, createGroup, updateGroup, leaveGroup,
    sendMessage, loadMoreMessages, loadMessagesAround, editMessage,
    deleteMessage, forwardMessage, addReaction, removeReaction,
    starMessage, unstarMessage, setTyping, markAsRead, confirmChatReadAtBottom,
    leaveChatScreen,
    addOptimisticMediaMessage, updateOptimisticMessage, removeOptimisticMessage, retrySendMessage,
  ]);

  const actionsRef = useRef<ChatActionsType>({} as ChatActionsType);
  actionsRef.current = {
    loadGroups,
    selectGroup,
    refreshCurrentGroupDetails,
    createGroup,
    updateGroup,
    leaveGroup,
    sendMessage,
    loadMoreMessages,
    loadMessagesAround,
    editMessage,
    deleteMessage,
    forwardMessage,
    addReaction,
    removeReaction,
    starMessage,
    unstarMessage,
    setTyping,
    markAsRead,
    confirmChatReadAtBottom,
    leaveChatScreen,
    addOptimisticMediaMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
    retrySendMessage,
  };

  const stableActions = useMemo<ChatActionsType>(() => ({
    loadGroups: (...args) => actionsRef.current.loadGroups(...args),
    selectGroup: (...args) => actionsRef.current.selectGroup(...args),
    refreshCurrentGroupDetails: (...args) => actionsRef.current.refreshCurrentGroupDetails(...args),
    createGroup: (...args) => actionsRef.current.createGroup(...args),
    updateGroup: (...args) => actionsRef.current.updateGroup(...args),
    leaveGroup: (...args) => actionsRef.current.leaveGroup(...args),
    sendMessage: (...args) => actionsRef.current.sendMessage(...args),
    loadMoreMessages: (...args) => actionsRef.current.loadMoreMessages(...args),
    loadMessagesAround: (...args) => actionsRef.current.loadMessagesAround(...args),
    editMessage: (...args) => actionsRef.current.editMessage(...args),
    deleteMessage: (...args) => actionsRef.current.deleteMessage(...args),
    forwardMessage: (...args) => actionsRef.current.forwardMessage(...args),
    addReaction: (...args) => actionsRef.current.addReaction(...args),
    removeReaction: (...args) => actionsRef.current.removeReaction(...args),
    starMessage: (...args) => actionsRef.current.starMessage(...args),
    unstarMessage: (...args) => actionsRef.current.unstarMessage(...args),
    setTyping: (...args) => actionsRef.current.setTyping(...args),
    markAsRead: (...args) => actionsRef.current.markAsRead(...args),
    confirmChatReadAtBottom: (...args) => actionsRef.current.confirmChatReadAtBottom(...args),
    leaveChatScreen: (...args) => actionsRef.current.leaveChatScreen(...args),
    addOptimisticMediaMessage: (...args) => actionsRef.current.addOptimisticMediaMessage(...args),
    updateOptimisticMessage: (...args) => actionsRef.current.updateOptimisticMessage(...args),
    removeOptimisticMessage: (...args) => actionsRef.current.removeOptimisticMessage(...args),
    retrySendMessage: (...args) => actionsRef.current.retrySendMessage(...args),
  }), []);

  return (
    <ChatActionsContext.Provider value={stableActions}>
      <ChatContext.Provider value={value}>
        {children}
      </ChatContext.Provider>
    </ChatActionsContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

/** Stable action callbacks — does not re-render when messages/groups change */
export function useChatActions(): ChatActionsType {
  const context = useContext(ChatActionsContext);
  if (context === undefined) {
    throw new Error('useChatActions must be used within a ChatProvider');
  }
  return context;
}
