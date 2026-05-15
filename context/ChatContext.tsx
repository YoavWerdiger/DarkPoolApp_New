// ============================================
// Chat Context
// ============================================
// ניהול State גלובלי של מערכת הצ'אט
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';
import * as Clipboard from 'expo-clipboard';

import {
  ChatGroup,
  ChatMessage,
  ChatGroupWithDetails,
  ChatTypingIndicator,
  SendChatMessageInput,
  CreateChatGroupInput,
  UpdateChatGroupInput,
} from '../types/chat.types';
import {
  chatGroupService,
  chatMessageService,
  chatRealtimeService,
} from '../services/chat';
import { stopRateLimitCleanup } from '../services/chat/chatValidation';
import {
  enqueue as enqueueOffline,
  remove as removeOffline,
  recordAttempt as recordOfflineAttempt,
  peek as peekOffline,
  makeLocalId,
  makeClientMessageId,
} from '../services/chat/chatOfflineQueue';
import { supabase } from '../services/supabase';
// Audio import removed — notification sound is not yet implemented (no mp3 asset in repo)

const MAX_OFFLINE_RETRY_ATTEMPTS = 5;

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

  // Read Receipts
  markAsRead: (groupId: string, messageIds: string[]) => Promise<void>;

  // Unread
  totalUnreadCount: number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

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
    if (!user || messageIds.length === 0) return;

    if (pendingReadRef.current?.groupId === groupId) {
      messageIds.forEach(id => pendingReadRef.current!.messageIds.add(id));
    } else {
      if (pendingReadRef.current) {
        await flushMarkAsRead();
      }
      pendingReadRef.current = { groupId, messageIds: new Set(messageIds) };
    }

    if (readTimerRef.current) clearTimeout(readTimerRef.current);
    readTimerRef.current = setTimeout(flushMarkAsRead, 500);
  }, [user, flushMarkAsRead]);

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

    setIsLoadingGroups(true);
    try {
      const { data, error } = await chatGroupService.getChatGroups(user.id);
      if (data) {
        setGroups(data);
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

  // ============================================
  // Select group
  // ============================================

  const selectGroup = useCallback(async (groupId: string) => {
    if (!user) return;

    // Unsubscribe from previous group to prevent memory leak
    if (currentGroupId.current && currentGroupId.current !== groupId) {
      chatRealtimeService.unsubscribeFromGroup(currentGroupId.current);
    }

    // C2: bump version so any prior in-flight selectGroup call detects it's stale
    const version = ++selectVersion.current;
    processedMessageIds.current.clear();

    // שימור הודעות אופטימיסטיות (בשליחה) לפני איפוס – מונע "היעלמות" כשחוזרים למסך
    const optimisticsToKeep =
      currentGroupId.current === groupId
        ? messagesRef.current.filter(
            (m) =>
              m.id.startsWith('temp-') &&
              m.sender_id === user.id &&
              (m.is_sending || m.is_uploading)
          )
        : [];

    currentGroupId.current = groupId;
    setIsLoadingMessages(true);
    setMessages([]);
    setTypingUsers([]);
    messagesOffset.current = 0;
    hasMoreMessages.current = true;
    setInitialUnreadInfo(null);

    // משתנים שישמשו גם מחוץ ל-blocks
    let savedUnreadCount = 0;
    let savedLastReadMessageId: string | null = null;

    try {
      // Load group details
      const { data: groupData, error: groupError } = await chatGroupService.getChatGroupDetails(groupId, user.id);
      if (selectVersion.current !== version) return;
      if (groupError) {
        logger.error('ChatContext', 'Failed to load group details', groupError);
      }
      if (groupData) {
        setCurrentGroup(groupData);

        // שמירת מידע על הודעות לא נקראות לפני איפוס
        savedUnreadCount = groupData.unread_count || 0;
        savedLastReadMessageId = groupData.last_read_message_id || null;

        if (savedUnreadCount > 0) {
          setInitialUnreadInfo({
            count: savedUnreadCount,
            lastReadMessageId: savedLastReadMessageId,
          });
        }
      }

      // Load messages
      const { data: messagesData } = await chatMessageService.getChatMessages(
        groupId,
        user.id,
        { limit: 50, offset: 0 }
      );

      if (selectVersion.current !== version) return; // C2: stale call, abort
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

        // סימון הצ'אט כנקרא - תמיד! לא משנה מה הסטטוס של ההודעות
        // ⚠️ messages[0] היא ההודעה הכי חדשה (FlatList inverted)
        if (messagesData.messages.length > 0) {
          const newestMessageId = messagesData.messages[0].id;
          await chatMessageService.markChatAsRead(groupId, user.id, newestMessageId);

          // עדכון מקומי
          setGroups(prev => prev.map(g =>
            g.id === groupId ? { ...g, unread_count: 0, mentioned_count: 0 } : g
          ));
        }
      }

      if (selectVersion.current !== version) return; // C2: stale call, abort before subscribing

      // M5: start typing cleanup only when actively in a chat room
      chatRealtimeService.startTypingCleanup();

      // Subscribe to realtime updates
      chatRealtimeService.subscribeToGroup(groupId, user.id, {
        onMessage: async (message, eventType) => {
          if (eventType === 'INSERT') {
            // New message - מילוי reply_to אם יש
            let enrichedMessage = message;
            if (message.reply_to_message_id && !message.reply_to) {
              const replyTo = await fetchReplyToData(message.reply_to_message_id);
              if (replyTo) {
                enrichedMessage = { ...message, reply_to: replyTo };
              }
            }

            // C3: if server response already processed this message, skip realtime duplicate
            if (processedMessageIds.current.has(enrichedMessage.id)) {
              // Still update the message in-place (e.g., updated reply_to) but don't duplicate
              setMessages(prev => prev.map(m => m.id === enrichedMessage.id ? { ...m, ...enrichedMessage } : m));
            } else if (enrichedMessage.sender_id === user.id) {
              // My message – find and replace its optimistic placeholder
              processedMessageIds.current.add(enrichedMessage.id);
              setMessages(prev => {
                const optimisticIndex = prev.findIndex(m => {
                  if (!m.id.startsWith('temp-') || m.sender_id !== user.id) return false;

                  if (enrichedMessage.reply_to_message_id && m.reply_to_message_id) {
                    return m.reply_to_message_id === enrichedMessage.reply_to_message_id &&
                      Math.abs(new Date(m.created_at).getTime() - new Date(enrichedMessage.created_at).getTime()) < 10000;
                  }

                  return m.content === enrichedMessage.content &&
                    Math.abs(new Date(m.created_at).getTime() - new Date(enrichedMessage.created_at).getTime()) < 10000;
                });

                if (optimisticIndex !== -1) {
                  const optimisticMsg = prev[optimisticIndex];
                  const finalMessage = {
                    ...enrichedMessage,
                    reply_to: optimisticMsg.reply_to || enrichedMessage.reply_to,
                  };
                  return prev.map((m, idx) => idx === optimisticIndex ? finalMessage : m);
                } else {
                  const existingIndex = prev.findIndex(m => m.id === enrichedMessage.id);
                  if (existingIndex !== -1) {
                    return prev.map((m, idx) => idx === existingIndex ? enrichedMessage : m);
                  }
                  return [enrichedMessage, ...prev];
                }
              });
            } else {
              // Someone else's message
              processedMessageIds.current.add(enrichedMessage.id);
              setMessages(prev => {
                const existingIndex = prev.findIndex(m => m.id === enrichedMessage.id);
                if (existingIndex !== -1) {
                  return prev.map((m, idx) => idx === existingIndex ? enrichedMessage : m);
                }
                return [enrichedMessage, ...prev];
              });
            }

            // Auto mark as read
            if (currentGroupId.current === groupId) {
              markAsRead(groupId, [enrichedMessage.id]);
            }
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
          // התעלם לחלוטין מ-real-time events של הריאקציות שלי - נטפל בהן אופטימיסטית בלבד
          if (reaction.user_id === user.id) {
            logger.debug('ChatContext', 'Skipping own reaction event - handled optimistically');
            return;
          }

          // Validate emoji — reject non-string or suspiciously long values
          if (typeof reaction.emoji !== 'string' || reaction.emoji.length === 0 || reaction.emoji.length > 20) {
            logger.warn('ChatContext', 'Dropping reaction event with invalid emoji', reaction.emoji);
            return;
          }

          logger.debug('ChatContext', `Processing other user reaction: ${eventType} ${reaction.emoji}`);
          
          setMessages(prev => prev.map(m => {
            if (m.id === reaction.message_id) {
              const currentReactions = m.reactions || [];
              const reactionGroup = currentReactions.find(r => r.emoji === reaction.emoji);

              if (eventType === 'INSERT') {
                // בדיקה אם המשתמש כבר קיים בריאקציה (בדיקה נוספת)
                const userAlreadyReacted = reactionGroup?.users?.some(u => u.id === reaction.user_id);
                if (userAlreadyReacted) {
                  // כבר קיים, לא צריך לעדכן שוב
                  return m;
                }

                // הוספת ריאקציה
                if (reactionGroup) {
                  // אם יש כבר ריאקציה עם האימוג'י הזה
                  return {
                    ...m,
                    reactions: currentReactions.map(r =>
                      r.emoji === reaction.emoji
                        ? {
                          ...r,
                          count: r.count + 1,
                          reacted_by_me: r.reacted_by_me || reaction.user_id === user.id,
                          users: [...r.users, {
                            id: reaction.user_id,
                            name: reaction.user?.display_name || 'משתמש',
                            profile_picture: reaction.user?.profile_picture,
                          }]
                        }
                        : r
                    ),
                    reactions_count: (m.reactions_count || 0) + 1
                  };
                } else {
                  // ריאקציה חדשה
                  return {
                    ...m,
                    reactions: [
                      ...currentReactions,
                      {
                        emoji: reaction.emoji,
                        count: 1,
                        reacted_by_me: reaction.user_id === user.id,
                        users: [{
                          id: reaction.user_id,
                          name: reaction.user?.display_name || 'משתמש',
                          profile_picture: reaction.user?.profile_picture,
                        }]
                      }
                    ],
                    reactions_count: (m.reactions_count || 0) + 1
                  };
                }
              } else {
                // DELETE - הסרת ריאקציה
                // בדיקה נוספת אם המשתמש עדיין קיים
                const userExistsInReaction = reactionGroup?.users?.some(u => u.id === reaction.user_id);
                if (!userExistsInReaction) {
                  // המשתמש לא קיים, לא צריך לעדכן
                  return m;
                }

                if (reactionGroup && reactionGroup.count > 1) {
                  // עדיין יש ריאקציות אחרות עם האימוג'י הזה
                  return {
                    ...m,
                    reactions: currentReactions.map(r =>
                      r.emoji === reaction.emoji
                        ? {
                          ...r,
                          count: r.count - 1,
                          reacted_by_me: r.reacted_by_me && reaction.user_id !== user.id,
                          users: r.users.filter(u => u.id !== reaction.user_id)
                        }
                        : r
                    ),
                    reactions_count: Math.max(0, (m.reactions_count || 0) - 1)
                  };
                } else {
                  // הסרת הריאקציה האחרונה עם האימוג'י הזה
                  return {
                    ...m,
                    reactions: currentReactions.filter(r => r.emoji !== reaction.emoji),
                    reactions_count: Math.max(0, (m.reactions_count || 0) - 1)
                  };
                }
              }
            }
            return m;
          }));
        },
        onTyping: (indicators) => {
          setTypingUsers(indicators.map(i => ({
            ...i,
            userName: i.user?.display_name
          })));
        },
        onMember: (_data, _eventType) => {
          chatGroupService.getChatGroupDetails(groupId, user.id).then(({ data: groupDetails, error: detailsError }) => {
            if (detailsError) {
              logger.error('ChatContext', 'onMember: failed to reload group details', detailsError);
            }
            if (groupDetails && currentGroupId.current === groupId) {
              setCurrentGroup(groupDetails);
            }
          });
        },
        onGroup: (data) => {
          // Use functional update to avoid stale closure on currentGroup
          setCurrentGroup(prev => prev ? { ...prev, ...data } : prev);
        },
      });
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
    setIsLoadingMessages(true);
    try {
      const oldestMessage = messagesRef.current[messagesRef.current.length - 1];
      const cursor = oldestMessage?.created_at;

      const { data } = await chatMessageService.getChatMessages(
        currentGroupId.current,
        user.id,
        { limit: 50, before: cursor }
      );

      if (data) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = data.messages.filter(m => !existingIds.has(m.id));
          const combined = [...prev, ...newMessages];
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
      }
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMessages(false);
    }
  }, [user]);

  const loadMessagesAround = useCallback(async (messageId: string) => {
    if (!user || !currentGroupId.current) {
      return { success: false, error: 'לא מחובר או אין קבוצה נבחרת' };
    }

    if (isLoadingAroundRef.current) {
      return { success: false, error: 'טעינה בתהליך' };
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
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const fresh = combined.filter(m => !existingIds.has(m.id));
          if (fresh.length === 0) return prev;

          const all = [...prev, ...fresh].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          messagesOffset.current = all.length;
          return all;
        });

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
      // Remove from groups list
      setGroups(prev => prev.filter(g => g.id !== groupId));

      // Clear current group if selected
      if (currentGroup?.id === groupId) {
        setCurrentGroup(null);
        setMessages([]);
        chatRealtimeService.unsubscribeFromGroup(groupId);
      }

      return { success: true };
    }

    return { success: false, error: error.message };
  }, [user, currentGroup]);

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
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, ...optimisticMessage } : m
      ));
    } else {
      setMessages(prev => [optimisticMessage, ...prev]);
    }

    try {
      const { data, error } = await chatMessageService.sendChatMessage(enrichedInput, user.id);

      if (data) {
        processedMessageIds.current.add(data.id);

        const finalMessage: ChatMessage = {
          ...data,
          reply_to: data.reply_to || replyToData,
        };

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
              last_message_preview: data.content || '📎 מדיה',
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
    if (!user) return;

    // עדכון אופטימיסטי
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const currentReactions = m.reactions || [];
        const reactionGroup = currentReactions.find(r => r.emoji === emoji);

        if (reactionGroup) {
          // אם יש כבר ריאקציה עם האימוג'י הזה
          return {
            ...m,
            reactions: currentReactions.map(r =>
              r.emoji === emoji
                ? {
                  ...r,
                  count: r.count + 1,
                  reacted_by_me: true,
                  users: [...r.users, {
                    id: user.id,
                    name: user.display_name || 'אני',
                    profile_picture: user.profile_picture,
                  }]
                }
                : r
            ),
            reactions_count: (m.reactions_count || 0) + 1
          };
        } else {
          // ריאקציה חדשה
          return {
            ...m,
            reactions: [
              ...currentReactions,
              {
                emoji: emoji,
                count: 1,
                reacted_by_me: true,
                users: [{
                  id: user.id,
                  name: user.display_name || 'אני',
                  profile_picture: user.profile_picture,
                }]
              }
            ],
            reactions_count: (m.reactions_count || 0) + 1
          };
        }
      }
      return m;
    }));

    const { error } = await chatMessageService.addReaction({ message_id: messageId, emoji }, user.id);
    if (error) {
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const reactions = (m.reactions || []).map(r => {
          if (r.emoji !== emoji) return r;
          const filtered = r.users.filter(u => u.id !== user.id);
          return { ...r, count: r.count - 1, reacted_by_me: false, users: filtered };
        }).filter(r => r.count > 0);
        return { ...m, reactions, reactions_count: Math.max(0, (m.reactions_count || 0) - 1) };
      }));
      logger.error('ChatContext', 'addReaction failed, rolled back', error);
    }
  }, [user]);

  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;

    // עדכון אופטימיסטי
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const currentReactions = m.reactions || [];
        const reactionGroup = currentReactions.find(r => r.emoji === emoji);

        if (reactionGroup && reactionGroup.count > 1) {
          // עדיין יש ריאקציות אחרות עם האימוג'י הזה
          return {
            ...m,
            reactions: currentReactions.map(r =>
              r.emoji === emoji
                ? {
                  ...r,
                  count: r.count - 1,
                  reacted_by_me: false,
                  users: r.users.filter(u => u.id !== user.id)
                }
                : r
            ),
            reactions_count: Math.max(0, (m.reactions_count || 0) - 1)
          };
        } else {
          // הסרת הריאקציה האחרונה עם האימוג'י הזה
          return {
            ...m,
            reactions: currentReactions.filter(r => r.emoji !== emoji),
            reactions_count: Math.max(0, (m.reactions_count || 0) - 1)
          };
        }
      }
      return m;
    }));

    const { error } = await chatMessageService.removeReaction({ message_id: messageId, emoji }, user.id);
    if (error) {
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions || [];
        const existing = reactions.find(r => r.emoji === emoji);
        if (existing) {
          return { ...m, reactions: reactions.map(r => r.emoji === emoji
            ? { ...r, count: r.count + 1, reacted_by_me: true, users: [...r.users, { id: user.id, name: user.display_name || 'אני', profile_picture: user.profile_picture }] }
            : r), reactions_count: (m.reactions_count || 0) + 1 };
        }
        return { ...m, reactions: [...reactions, { emoji, count: 1, reacted_by_me: true, users: [{ id: user.id, name: user.display_name || 'אני', profile_picture: user.profile_picture }] }], reactions_count: (m.reactions_count || 0) + 1 };
      }));
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

    // טעינת קבוצות ראשונית
    loadGroups();

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
    chatRealtimeService.subscribeToAllUserGroups(
      user.id,
      (groupId, message) => {
        // הודעה חדשה בקבוצה - עדכון last_message בלבד, unread_count מגיע מהשרת
        logger.debug('ChatContext', `onNewMessage: group=${groupId} msg=${message.id}`);
        setGroups(prev => {
          return prev.map(g =>
            g.id === groupId
              ? {
                ...g,
                last_message_at: message.created_at,
                last_message_preview: message.content || '📎 מדיה',
              }
              : g
          );
        });

        // Sound is played only in subscribeToGroup for the active chat.
        // Here we only update the groups list preview.
      },
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
      }
    );

    // Listen for own membership being removed from any group.
    // When another admin removes this user, the Realtime DELETE event fires here
    // and we immediately clean up — no need to wait for reload.
    const membershipChannel = supabase
      .channel(`own-membership-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_group_members',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const removedGroupId = (payload.old as any)?.group_id;
          if (!removedGroupId) return;
          logger.debug('ChatContext', `Removed from group ${removedGroupId} — cleaning up`);
          setGroups(prev => prev.filter(g => g.id !== removedGroupId));
          chatRealtimeService.unsubscribeFromGroup(removedGroupId);
          // If currently viewing that group, clear it
          if (currentGroupId.current === removedGroupId) {
            setCurrentGroup(null);
            setMessages([]);
            setTypingUsers([]);
          }
        }
      )
      .subscribe();

    return () => {
      membershipChannel.unsubscribe();
      chatRealtimeService.updateOnlineStatus(user.id, false);
      chatRealtimeService.stopTypingCleanup();
      chatRealtimeService.unsubscribeAll();
      chatRealtimeService.onConnectionStatusChange(null);
      setRealtimeConnectionState('connecting');
    };
  }, [user, loadGroups]);

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
    isConnected,
    realtimeConnectionState,
    totalUnreadCount,
    addOptimisticMediaMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
  }), [
    groups, currentGroup, messages, typingUsers,
    isLoadingGroups, isLoadingMessages, isSendingMessage,
    initialUnreadInfo, isConnected, realtimeConnectionState, totalUnreadCount,
    loadGroups, selectGroup, refreshCurrentGroupDetails, createGroup, updateGroup, leaveGroup,
    sendMessage, loadMoreMessages, loadMessagesAround, editMessage,
    deleteMessage, forwardMessage, addReaction, removeReaction,
    starMessage, unstarMessage, setTyping, markAsRead,
    addOptimisticMediaMessage, updateOptimisticMessage, removeOptimisticMessage,
  ]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
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
