// ============================================
// Chat Context
// ============================================
// ניהול State גלובלי של מערכת הצ'אט
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState } from 'react-native';
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
import { scheduleChatMessagesPersist } from '../lib/chatMessagePersist';
import { persistQueryCache } from '../lib/queryPersist';
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
  /** סימון "נקרא עד הסוף" — אחרי גלילה לתחתית (לא בפתיחה עם unread) */
  confirmChatReadAtBottom: () => Promise<void>;

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
  const resubscribeActiveGroupRef = useRef<(() => void) | null>(null);
  const personalDeletedIds = useRef<Set<string>>(new Set());
  // C1: version counter to abort stale selectGroup calls
  const selectVersion = useRef(0);
  // C3: track IDs already processed to prevent triple-source duplicates
  const processedMessageIds = useRef<Set<string>>(new Set());
  // C4: ref-based lock to prevent concurrent loadMoreMessages calls
  const isLoadingMoreRef = useRef(false);
  const isLoadingAroundRef = useRef(false);
  // L4: outbound queue is persisted to AsyncStorage (chatOfflineQueue).
  // A single in-flight guard prevents two flushers running concurrently.
  const isFlushing = useRef(false);

  // Keep messagesRef in sync with state
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // סנכרון cache ההודעות (כולל realtime) + גיבוי לדיסק — לכניסה מיידית בפעם הבאה
  useEffect(() => {
    const gid = currentGroupId.current;
    if (!gid || !user || messages.length === 0) return;
    const persistable = messages.filter((m) => !m.id.startsWith('temp-'));
    if (persistable.length === 0) return;
    queryClient.setQueryData(appQueryKeys.chatMessages(gid), persistable);
    scheduleChatMessagesPersist(user.id);
  }, [messages, user]);

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
    try {
      await chatMessageService.markMessagesAsRead(
        { group_id: pending.groupId, message_ids: Array.from(pending.messageIds) },
        user.id
      );
      setGroups(prev => prev.map(g =>
        g.id === pending.groupId ? { ...g, unread_count: 0 } : g
      ));
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

  const confirmChatReadAtBottom = useCallback(async () => {
    if (!user) return;
    const gid = currentGroupId.current;
    if (!gid) return;

    const newestPersistedId = getNewestPersistedMessageId(messagesRef.current);

    try {
      await chatMessageService.markChatAsRead(gid, user.id, newestPersistedId);
      setInitialUnreadInfo(null);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === gid ? { ...g, unread_count: 0, mentioned_count: 0 } : g,
        ),
      );
    } catch (error) {
      logger.error('ChatContext', 'confirmChatReadAtBottom failed', error);
    }
  }, [user]);

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
    if (!user) return;

    const cacheKey = appQueryKeys.chatGroups(user.id);
    const cached = queryClient.getQueryData<ChatGroup[]>(cacheKey);
    if (cached?.length) {
      setGroups(cached);
      setIsLoadingGroups(false);
    } else {
      setIsLoadingGroups(true);
    }

    try {
      const { data, error } = await chatGroupService.getChatGroups(user.id);
      if (data) {
        setGroups(data);
        queryClient.setQueryData(cacheKey, data);
        void persistQueryCache(user.id);
      } else {
        logger.error('ChatContext', 'Error loading groups', error);
      }
    } finally {
      setIsLoadingGroups(false);
    }
  }, [user]);

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

  // ============================================
  // Select group
  // ============================================

  const selectGroup = useCallback(async (groupId: string) => {
    if (!user) return;

    const isSameGroup = currentGroupId.current === groupId;
    const keepVisibleThread = isSameGroup && messagesRef.current.length > 0;

    const groupAlreadySubscribed =
      isSameGroup && chatRealtimeService.isGroupRealtimeSubscribed(groupId);

    if (!isSameGroup && currentGroupId.current) {
      chatRealtimeService.unsubscribeFromGroup(currentGroupId.current);
    } else if (isSameGroup && !groupAlreadySubscribed && !keepVisibleThread) {
      chatRealtimeService.unsubscribeFromGroup(groupId);
    }

    // C2: bump version so any prior in-flight selectGroup call detects it's stale
    const version = ++selectVersion.current;
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
      // אם יש הודעות שמורות מהכניסה הקודמת — מציגים אותן מיד בלי skeleton,
      // והרשת מרעננת ברקע. אחרת — מצב טעינה רגיל.
      const cachedMessages = queryClient.getQueryData<ChatMessage[]>(
        appQueryKeys.chatMessages(groupId),
      );
      if (cachedMessages?.length) {
        setMessages(cachedMessages);
        messagesOffset.current = cachedMessages.length;
        hasMoreMessages.current = true;
        setIsLoadingMessages(false);
        warmChatMediaCache(cachedMessages);
      } else {
        setIsLoadingMessages(true);
        setMessages([]);
        messagesOffset.current = 0;
        hasMoreMessages.current = true;
      }
      setTypingUsers([]);
      setInitialUnreadInfo(null);
    }

    // כבר בצ'אט עם הודעות טעונות — בלי reload/markAsRead (מונע קפיצות גלילה)
    const skipMessageReload = isSameGroup && keepVisibleThread;

    // משתנים שישמשו גם מחוץ ל-blocks
    let savedUnreadCount = 0;
    let savedLastReadMessageId: string | null = null;

    try {
      // הרצה במקביל: פרטי הקבוצה + ההודעות יוצאים יחד (במקום בטור).
      // טעינת פרטי הקבוצה כוללת join לכל החברים ויכולה להיות איטית —
      // אין סיבה שטעינת ההודעות תחכה לה. חוסך עד ~חצי מזמן הכניסה.
      const groupDetailsPromise = chatGroupService.getChatGroupDetails(groupId, user.id);
      const messagesPromise = skipMessageReload
        ? null
        : chatMessageService.getChatMessages(groupId, user.id, { limit: 50, offset: 0 });

      // Load group details
      const { data: groupData, error: groupError } = await groupDetailsPromise;
      if (selectVersion.current !== version) return;
      if (groupError) {
        logger.error('ChatContext', 'Failed to load group details', groupError);
      }
      if (groupData) {
        setCurrentGroup(groupData);

        if (!skipMessageReload) {
          savedUnreadCount = groupData.unread_count || 0;
          savedLastReadMessageId = groupData.last_read_message_id || null;

          if (savedUnreadCount > 0) {
            setInitialUnreadInfo({
              count: savedUnreadCount,
              lastReadMessageId: savedLastReadMessageId,
            });
          }
        }
      }

      if (!skipMessageReload && messagesPromise) {
        const { data: messagesData } = await messagesPromise;

        if (selectVersion.current !== version) return;
        if (messagesData) {
        // מיזוג הודעות אופטימיסטיות – התאמה אחד-לאחד (מונע איבוד הודעות שנשלחו במקביל)
        const usedApiIndices = new Set();
        const stillPending = optimisticsToKeep.filter((opt) => {
          const optTime = new Date(opt.created_at).getTime();
          const matchIdx = messagesData.messages.findIndex((api, idx) => {
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
        const merged = stillPending.length > 0 ? [...stillPending, ...messagesData.messages] : messagesData.messages;

        setMessages(merged);
        messagesOffset.current = merged.length;
        hasMoreMessages.current = messagesData.has_more;
        warmChatMediaCache(merged);

        // שמירת ה-batch הראשון ל-cache לכניסה אופטימית מהירה בפעם הבאה.
        // שומרים רק הודעות אמיתיות (לא אופטימיות temp-) כדי לא לזרוע מצב שליחה.
        const persistable = merged.filter((m) => !m.id.startsWith('temp-'));
        queryClient.setQueryData(appQueryKeys.chatMessages(groupId), persistable);

        // ✅ ספירה אמיתית של הודעות לא נקראות (לא סומכים על unread_count מהשרת)
        if (savedLastReadMessageId && messagesData.messages.length > 0) {
          const lastReadIndex = messagesData.messages.findIndex(m => m.id === savedLastReadMessageId);
          if (lastReadIndex !== -1) {
            // ספירת הודעות שנוצרו אחרי ההודעה האחרונה שנקראה (ולא שלי)
            const actualUnreadCount = messagesData.messages
              .slice(0, lastReadIndex) // הודעות אחרי lastReadMessageId (FlatList inverted)
              .filter(m => m.sender_id !== user.id) // לא הודעות שלי
              .length;
            
            if (actualUnreadCount > 0 && actualUnreadCount !== savedUnreadCount) {
              logger.debug('ChatContext', `Correcting unread count: server=${savedUnreadCount}, actual=${actualUnreadCount}`);
              setInitialUnreadInfo({
                count: actualUnreadCount,
                lastReadMessageId: savedLastReadMessageId,
              });
            }
          }
        }

        // בלי unread — סימון מיידי; עם unread — רק אחרי גלילה לתחתית (confirmChatReadAtBottom)
        if (messagesData.messages.length > 0 && savedUnreadCount === 0) {
          const newestMessageId = messagesData.messages[0].id;
          await chatMessageService.markChatAsRead(groupId, user.id, newestMessageId);
          setGroups((prev) =>
            prev.map((g) =>
              g.id === groupId ? { ...g, unread_count: 0, mentioned_count: 0 } : g,
            ),
          );
        }
        }
      }

      if (selectVersion.current !== version) return; // C2: stale call, abort before subscribing

      if (skipMessageReload && groupAlreadySubscribed) {
        chatRealtimeService.startTypingCleanup();
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
            // Updated message - מילוי reply_to אם יש
            let enrichedMessage = message;
            if (message.reply_to_message_id && !message.reply_to) {
              const replyTo = await fetchReplyToData(message.reply_to_message_id);
              if (replyTo) {
                enrichedMessage = { ...message, reply_to: replyTo };
              }
            }

            // עדכון ההודעה אבל שמירה על הריאקציות המקומיות (optimistic)
            setMessages(prev => prev.map(m => {
              if (m.id === enrichedMessage.id) {
                // שמור על הריאקציות המקומיות - הן עודכנו אופטימיסטית
                return {
                  ...enrichedMessage,
                  reactions: m.reactions,
                  reactions_count: m.reactions_count,
                };
              }
              return m;
            }));
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
          setTypingUsers(indicators.map(i => ({
            ...i,
            userName: i.user?.display_name
          })));
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
      resubscribeActiveGroupRef.current = () => {
        const gid = currentGroupId.current;
        if (!user || !gid) return;
        chatRealtimeService.clearFailedChannel(gid);
        chatRealtimeService.unsubscribeFromGroup(gid);
        void chatRealtimeService.subscribeToGroup(gid, user.id, groupRealtimeListeners);
      };
      void chatRealtimeService.subscribeToGroup(groupId, user.id, groupRealtimeListeners);
    } catch (error) {
      logger.error('ChatContext', 'Error selecting group', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user]);

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
            }
          : g
      )
    );
  }, [user]);

  // ============================================
  // Load more messages
  // ============================================

  const MAX_MESSAGES_IN_MEMORY = 500;

  const loadMoreMessages = useCallback(async () => {
    // C4: ref-based lock prevents concurrent calls (state updates are async)
    if (!user || !currentGroupId.current || !hasMoreMessages.current || isLoadingMoreRef.current) {
      return;
    }

    // Hard memory cap — stop loading history when we have enough in RAM
    if (messagesRef.current.length >= MAX_MESSAGES_IN_MEMORY) {
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
          const prevIds = new Set(prev.map(m => m.id));
          const toAppend = data.messages.filter(m => !prevIds.has(m.id));
          const combined = [...prev, ...toAppend];
          // C4: sliding window – trim oldest messages (end of array) when history grows too large.
          // In inverted FlatList index 0 = newest, so slice from the start keeps the newest.
          // Never trim while there are in-flight optimistic messages.
          if (combined.length > MAX_MESSAGES_IN_MEMORY) {
            const hasPendingOptimistic = combined.some(m => m.id.startsWith('temp-') && (m.is_sending || m.is_uploading));
            if (hasPendingOptimistic) return combined;
            return combined.slice(0, MAX_MESSAGES_IN_MEMORY);
          }
          return combined;
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
      // L5: cursor-based – מצא את created_at של ההודעה ואז טען 50 לפני ו-50 אחרי
      const { data: anchor, error: anchorError } = await supabase
        .from('chat_messages')
        .select('created_at')
        .eq('id', messageId)
        .eq('group_id', currentGroupId.current)
        .single();

      if (anchorError || !anchor) {
        return { success: false, error: 'הודעה לא נמצאה' };
      }

      const anchorTs = anchor.created_at;

      // שאילתה A: הודעות ישנות יותר (כולל ה-anchor עצמה)
      const olderPromise = chatMessageService.getChatMessages(
        currentGroupId.current,
        user.id,
        { limit: 50, before: new Date(new Date(anchorTs).getTime() + 1).toISOString() }
      );

      // שאילתה B: הודעות חדשות יותר
      const newerPromise = chatMessageService.getChatMessages(
        currentGroupId.current,
        user.id,
        { limit: 50, after: anchorTs }
      );

      const [{ data: older }, { data: newer }] = await Promise.all([olderPromise, newerPromise]);

      const combined = [
        ...(newer?.messages || []),
        ...(older?.messages || []),
      ];

      if (combined.length > 0) {
        const byId = new Map<string, ChatMessage>();
        for (const m of [...messagesRef.current, ...combined]) {
          byId.set(m.id, m);
        }
        const all = Array.from(byId.values()).sort((a, b) => {
          const dt = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          if (dt !== 0) return dt;
          return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
        });

        setMessages(all);
        messagesOffset.current = all.length;
        warmChatMediaCache(combined);
        return { success: true };
      }

      return { success: false, error: 'לא נמצאו הודעות' };
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
        currentGroupId.current = null;
        setCurrentGroup(null);
        setMessages([]);
        setTypingUsers([]);
      }

      return { success: true };
    }

    logger.error('ChatContext', 'leaveGroup failed', error);
    return { success: false, error: error.message };
  }, [user]);

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
        display_name: user.display_name || 'אני',
        profile_picture: user.profile_picture,
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
      name: user.display_name || 'אני',
      profile_picture: user.profile_picture,
    };

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = applyReactionInsert(m.reactions, emoji, actor, { isActorMe: true });
        if (reactions === m.reactions) return m;
        return { ...m, reactions, reactions_count: totalReactionCount(reactions) };
      }),
    );

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

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = applyReactionRemove(m.reactions, emoji, user.id, user.id);
        if (reactions === m.reactions) return m;
        return { ...m, reactions, reactions_count: totalReactionCount(reactions) };
      }),
    );

    const { error } = await chatMessageService.removeReaction({ message_id: messageId, emoji }, user.id);
    if (error) {
      const actor = {
        id: user.id,
        name: user.display_name || 'אני',
        profile_picture: user.profile_picture,
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
        setCurrentGroup(null);
        setMessages([]);
        setTypingUsers([]);
        currentGroupId.current = null;
        resubscribeActiveGroupRef.current = null;
      }
    };

    const handleGlobalNewMessage = (groupId: string, message: ChatMessage) => {
      logger.debug('ChatContext', `onNewMessage: group=${groupId} msg=${message.id}`);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
              ...g,
              last_message_at: message.created_at,
              last_message_preview: getChatMessagePreview(message.message_type, message.content),
            }
            : g
        )
      );
      // גיבוי: אם מנוי הקבוצה הפעילה נכשל — עדיין להציג הודעות במסך הפתוח
      if (currentGroupId.current === groupId) {
        void ingestIncomingInsertRef.current(message);
      }
    };

    const subscribeAllGroups = () => {
      chatRealtimeService.subscribeToAllUserGroups(
        user.id,
        handleGlobalNewMessage,
        (groupId, data) => {
          // עדכון קבוצות (כולל unread_count מהשרת)
          logger.debug('ChatContext', `onGroupUpdate: group=${groupId}`);
          setGroups(prev => prev.map(g => {
            if (g.id !== groupId) return g;

            const newUnread = data.unread_count ?? g.unread_count;
            const newMentioned = data.mentioned_count ?? g.mentioned_count;

            // אם אין שינוי אמיתי, לא מעדכנים
            if (newUnread === g.unread_count &&
                newMentioned === g.mentioned_count &&
                !data.last_message_at && !data.name && !data.avatar_url) {
              return g;
            }

            return { ...g, ...data };
          }));
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
        return;
      }

      if (prevState.match(/inactive|background/) && nextState === 'active') {
        chatRealtimeService.updateOnlineStatus(user.id, true);

        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          chatRealtimeService.clearFailedChannels();
          void chatRealtimeService.subscribeToAllUserGroups(
            user.id,
            handleGlobalNewMessage,
            (groupId, data) => {
              logger.debug('ChatContext', `onGroupUpdate: group=${groupId}`);
              setGroups(prev => prev.map(g => {
                if (g.id !== groupId) return g;
                const newUnread = data.unread_count ?? g.unread_count;
                const newMentioned = data.mentioned_count ?? g.mentioned_count;
                if (newUnread === g.unread_count &&
                    newMentioned === g.mentioned_count &&
                    !data.last_message_at && !data.name && !data.avatar_url) {
                  return g;
                }
                return { ...g, ...data };
              }));
            },
            handleMembershipRemoved,
            { force: true }
          );
          resubscribeActiveGroupRef.current?.();
        }, 800);
      }
    });

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(presenceHeartbeat);
      appStateSub.remove();
      chatRealtimeService.updateOnlineStatus(user.id, false);
      chatRealtimeService.stopTypingCleanup();
      chatRealtimeService.unsubscribeAll();
      chatRealtimeService.onConnectionStatusChange(null);
      setRealtimeConnectionState('connecting');
      resubscribeActiveGroupRef.current = null;
    };
  }, [user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
  }, []);

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
