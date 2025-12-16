// ============================================
// Chat Context
// ============================================
// ניהול State גלובלי של מערכת הצ'אט
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
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
import { supabase } from '../services/supabase';
import { Audio } from 'expo-av';

// ============================================
// Types
// ============================================

// מידע על הודעות לא נקראות כשנכנסים לצ'אט
interface InitialUnreadInfo {
  count: number;
  lastReadMessageId: string | null;
}

interface ChatContextType {
  // State
  groups: ChatGroup[];
  currentGroup: ChatGroupWithDetails | null;
  messages: ChatMessage[];
  typingUsers: ChatTypingIndicator[];
  isLoadingGroups: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  
  // Unread info when entering chat
  initialUnreadInfo: InitialUnreadInfo | null;
  
  // Group Actions
  loadGroups: () => Promise<void>;
  selectGroup: (groupId: string) => Promise<void>;
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
  
  // Read Receipts
  markAsRead: (groupId: string, messageIds: string[]) => Promise<void>;
  
  // Realtime
  isConnected: boolean;
  
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
  const [isConnected, setIsConnected] = useState(false);
  const [initialUnreadInfo, setInitialUnreadInfo] = useState<InitialUnreadInfo | null>(null);
  
  // Refs
  const messagesOffset = useRef(0);
  const hasMoreMessages = useRef(true);
  const currentGroupId = useRef<string | null>(null);
  const notificationSound = useRef<Audio.Sound | null>(null);
  const personalDeletedIds = useRef<Set<string>>(new Set()); // הודעות שנמחקו אישית
  
  // ============================================
  // Load notification sound
  // ============================================
  
  useEffect(() => {
    // קובץ הסאונד אופציונלי - אם לא קיים פשוט לא יהיה סאונד
    async function loadSound() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sounds/notification.mp3')
        );
        notificationSound.current = sound;
          } catch (error) {
        console.log('⚠️ Could not load notification sound:', error);
      }
    }
    
    loadSound();

    return () => {
      notificationSound.current?.unloadAsync();
    };
  }, []);
  
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
        console.error('❌ Error loading groups:', error);
      }
    } finally {
      setIsLoadingGroups(false);
    }
  }, [user]);
  
  // ============================================
  // Select group
  // ============================================
  
  const selectGroup = useCallback(async (groupId: string) => {
    if (!user) return;
    
    currentGroupId.current = groupId;
    setIsLoadingMessages(true);
    setMessages([]);
    messagesOffset.current = 0;
    hasMoreMessages.current = true;
    setInitialUnreadInfo(null); // איפוס
    
    try {
      // Load group details
      const { data: groupData } = await chatGroupService.getChatGroupDetails(groupId, user.id);
      if (groupData) {
        setCurrentGroup(groupData);
        
        // שמירת מידע על הודעות לא נקראות לפני איפוס
        const unreadCount = groupData.unread_count || 0;
        const lastReadMessageId = groupData.last_read_message_id || null;
        
        console.log('📊 Initial unread info for group:', groupId);
        console.log('📊   - unread_count:', unreadCount);
        console.log('📊   - last_read_message_id:', lastReadMessageId ? lastReadMessageId.slice(0, 8) + '...' : 'null');
        console.log('📊   - is_member:', !!groupData.my_role);
        
        if (unreadCount > 0) {
          setInitialUnreadInfo({
            count: unreadCount,
            lastReadMessageId: lastReadMessageId,
          });
          console.log('✅ Set initialUnreadInfo:', { count: unreadCount, lastReadMessageId: lastReadMessageId?.slice(0, 8) + '...' });
        } else {
          console.log('⚠️ No unread messages, initialUnreadInfo not set');
        }
      }
      
      // Load messages
      const { data: messagesData } = await chatMessageService.getChatMessages(
        groupId,
        user.id,
        { limit: 50, offset: 0 }
      );
      
      if (messagesData) {
        setMessages(messagesData.messages);
        messagesOffset.current = messagesData.messages.length;
        hasMoreMessages.current = messagesData.has_more;
        
        
        // סימון הצ'אט כנקרא - תמיד! לא משנה מה הסטטוס של ההודעות
        if (messagesData.messages.length > 0) {
          const lastMessageId = messagesData.messages[messagesData.messages.length - 1].id;
          console.log('📖 Marking chat as read on enter, last message:', lastMessageId);
          await chatMessageService.markChatAsRead(groupId, user.id, lastMessageId);
          
          // עדכון מקומי
          setGroups(prev => prev.map(g => 
            g.id === groupId ? { ...g, unread_count: 0, mentioned_count: 0 } : g
          ));
        }
      }
      
      // Subscribe to realtime updates
      chatRealtimeService.subscribeToGroup(groupId, user.id, {
        onMessage: async (message, eventType) => {
          // #region agent log
          const logData5 = {location:'ChatContext.tsx:220',message:'Realtime message received',data:{eventType,messageId:message.id,senderId:message.sender_id,isMyMessage:message.sender_id===user.id,hasReplyTo:!!message.reply_to_message_id,groupId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
          console.log('🔍 DEBUG [C]:', JSON.stringify(logData5));
          fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData5)}).catch(()=>{});
          // #endregion
          if (eventType === 'INSERT') {
            // New message - מילוי reply_to אם יש
            let enrichedMessage = message;
            if (message.reply_to_message_id && !message.reply_to) {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:224',message:'Enriching reply_to for realtime message',data:{messageId:message.id,replyToId:message.reply_to_message_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
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
                  .eq('id', message.reply_to_message_id)
                  .single();
                
                if (replyToMessage) {
                  const sender = Array.isArray(replyToMessage.sender) 
                    ? replyToMessage.sender[0] 
                    : replyToMessage.sender;
                  enrichedMessage = {
                    ...message,
                    reply_to: {
                      message_id: replyToMessage.id,
                      content: replyToMessage.content,
                      message_type: replyToMessage.message_type,
                      media_url: replyToMessage.media_url,
                      sender_id: replyToMessage.sender_id,
                      sender_name: sender?.display_name || 'משתמש',
                    },
                  };
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:257',message:'Enriched reply_to successfully',data:{messageId:enrichedMessage.id,hasReplyTo:!!enrichedMessage.reply_to},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                  // #endregion
                  console.log('📎 Enriched message with reply_to:', enrichedMessage.id);
                }
              } catch (error) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:260',message:'Error enriching reply_to',data:{error:error instanceof Error?error.message:'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                console.error('❌ Error loading reply_to message:', error);
              }
            }
            
            // אם זו הודעה שלי, נחפש optimistic message ונחליף אותו
            // אחרת, נוסיף הודעה חדשה
            if (enrichedMessage.sender_id === user.id) {
              // זו הודעה שלי - נחפש optimistic message ונחליף אותו
              setMessages(prev => {
                // נחפש optimistic message (מתחיל ב-temp-)
                // נחפש לפי reply_to_message_id קודם, ואז לפי תוכן וזמן
                const optimisticIndex = prev.findIndex(m => {
                  if (!m.id.startsWith('temp-') || m.sender_id !== user.id) return false;
                  
                  // אם יש reply_to_message_id, נבדוק לפי זה
                  if (enrichedMessage.reply_to_message_id && m.reply_to_message_id) {
                    return m.reply_to_message_id === enrichedMessage.reply_to_message_id &&
                           Math.abs(new Date(m.created_at).getTime() - new Date(enrichedMessage.created_at).getTime()) < 10000; // 10 שניות
                  }
                  
                  // אחרת נבדוק לפי תוכן וזמן
                  return m.content === enrichedMessage.content &&
                         Math.abs(new Date(m.created_at).getTime() - new Date(enrichedMessage.created_at).getTime()) < 10000; // 10 שניות
                });
                
                if (optimisticIndex !== -1) {
                  // מצאנו optimistic message - נחליף אותו עם reply_to מה-optimistic אם יש
                  const optimisticMsg = prev[optimisticIndex];
                  const finalMessage = {
                    ...enrichedMessage,
                    // שמור את reply_to מה-optimistic אם יש, אחרת מה-enriched
                    reply_to: optimisticMsg.reply_to || enrichedMessage.reply_to,
                  };
                  // #region agent log
                  const logData6 = {location:'ChatContext.tsx:306',message:'Realtime replacing optimistic',data:{tempId:optimisticMsg.id,realId:enrichedMessage.id,hasReplyTo:!!finalMessage.reply_to,replyToFromOptimistic:!!optimisticMsg.reply_to,replyToFromEnriched:!!enrichedMessage.reply_to},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
                  console.log('🔍 DEBUG [B]:', JSON.stringify(logData6));
                  fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData6)}).catch(()=>{});
                  // #endregion
                  console.log('🔄 Replacing optimistic message with real one, preserving reply_to:', finalMessage.reply_to);
                  return prev.map((m, idx) => idx === optimisticIndex ? finalMessage : m);
                } else {
                  // לא מצאנו optimistic message - נבדוק אם ההודעה כבר קיימת
                  const existingIndex = prev.findIndex(m => m.id === enrichedMessage.id);
                  if (existingIndex !== -1) {
                    // ההודעה כבר קיימת - נחליף אותה
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:315',message:'Realtime message already exists, replacing',data:{messageId:enrichedMessage.id,existingIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
                    // #endregion
                    return prev.map((m, idx) => idx === existingIndex ? enrichedMessage : m);
                  }
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:297',message:'Realtime adding new message (no optimistic)',data:{messageId:enrichedMessage.id,hasReplyTo:!!enrichedMessage.reply_to},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                  // #endregion
                  console.log('➕ Adding new message (no optimistic found), enriched reply_to:', enrichedMessage.reply_to);
                  return [...prev, enrichedMessage];
                }
              });
            } else {
              // זו הודעה של מישהו אחר - נבדוק אם היא כבר קיימת לפני הוספה
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:303',message:'Realtime adding other user message',data:{messageId:enrichedMessage.id,hasReplyTo:!!enrichedMessage.reply_to},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
              setMessages(prev => {
                // בדיקה אם ההודעה כבר קיימת
                const existingIndex = prev.findIndex(m => m.id === enrichedMessage.id);
                if (existingIndex !== -1) {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:328',message:'Other user message already exists, replacing',data:{messageId:enrichedMessage.id,existingIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
                  // #endregion
                  return prev.map((m, idx) => idx === existingIndex ? enrichedMessage : m);
                }
                // הוספה בתחילת המערך כי המערך בסדר יורד (חדשה לישנה)
                return [enrichedMessage, ...prev];
              });
            }
            
            // Play sound if not from me
            if (enrichedMessage.sender_id !== user.id) {
              notificationSound.current?.replayAsync();
            }
            
            // Auto mark as read
            if (currentGroupId.current === groupId) {
              markAsRead(groupId, [enrichedMessage.id]);
            }
          } else if (eventType === 'UPDATE') {
            // Updated message - מילוי reply_to אם יש
            let enrichedMessage = message;
            if (message.reply_to_message_id && !message.reply_to) {
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
                  .eq('id', message.reply_to_message_id)
                  .single();
                
                if (replyToMessage) {
                  const sender = Array.isArray(replyToMessage.sender) 
                    ? replyToMessage.sender[0] 
                    : replyToMessage.sender;
                  enrichedMessage = {
                    ...message,
                    reply_to: {
                      message_id: replyToMessage.id,
                      content: replyToMessage.content,
                      message_type: replyToMessage.message_type,
                      media_url: replyToMessage.media_url,
                      sender_id: replyToMessage.sender_id,
                      sender_name: sender?.display_name || 'משתמש',
                    },
                  };
      }
    } catch (error) {
                console.error('❌ Error loading reply_to message:', error);
              }
            }
            
            setMessages(prev => prev.map(m => m.id === enrichedMessage.id ? enrichedMessage : m));
          } else if (eventType === 'DELETE') {
            // Deleted message
            setMessages(prev => prev.filter(m => m.id !== message.id));
          }
        },
        onReaction: async (reaction, eventType) => {
          // עדכון ריאקציות בהודעה
          console.log('👍 Reaction event received:', eventType, reaction.emoji, 'for message', reaction.message_id);
          
          setMessages(prev => prev.map(m => {
            if (m.id === reaction.message_id) {
              const currentReactions = m.reactions || [];
              const reactionGroup = currentReactions.find(r => r.emoji === reaction.emoji);
              
              if (eventType === 'INSERT') {
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
          setTypingUsers(indicators);
        },
        onMember: (data, eventType) => {
          // Member added/removed/updated
          if (currentGroup) {
            // Reload group details
            chatGroupService.getChatGroupDetails(groupId, user.id).then(({ data }) => {
              if (data) {
                setCurrentGroup(data);
              }
            });
          }
        },
        onGroup: (data) => {
          // Group updated
          if (currentGroup) {
            setCurrentGroup({ ...currentGroup, ...data });
          }
        },
      });
      
      setIsConnected(true);
    } catch (error) {
      console.error('❌ Error selecting group:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user]);
  
  // ============================================
  // Load more messages
  // ============================================
  
  const loadMoreMessages = useCallback(async () => {
    if (!user || !currentGroupId.current || !hasMoreMessages.current || isLoadingMessages) {
      return;
    }

    setIsLoadingMessages(true);
    try {
      const { data } = await chatMessageService.getChatMessages(
        currentGroupId.current,
        user.id,
        { limit: 50, offset: messagesOffset.current }
      );
      
      if (data) {
        setMessages(prev => {
          // נסיר הודעות כפולות - נשמור רק את ההודעות החדשות שלא קיימות
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = data.messages.filter(m => !existingIds.has(m.id));
          // #region agent log
          if (newMessages.length !== data.messages.length) {
            fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:518',message:'Filtered duplicate messages in loadMoreMessages',data:{totalMessages:data.messages.length,newMessages:newMessages.length,filtered:data.messages.length-newMessages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
          }
          // #endregion
          // הודעות ישנות יותר בסוף המערך (מוצגות בראש עם inverted)
          return [...prev, ...newMessages];
        });
        messagesOffset.current += data.messages.length;
        hasMoreMessages.current = data.has_more;
      }
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user, isLoadingMessages]);

  // טעינת הודעות סביב הודעה מסוימת (לפני ואחרי)
  const loadMessagesAround = useCallback(async (messageId: string) => {
    if (!user || !currentGroupId.current) {
      return { success: false, error: 'לא מחובר או אין קבוצה נבחרת' };
    }

    try {
      // נטען את ההודעה מהמסד הנתונים
      const { data: messageData, error: messageError } = await supabase
        .from('chat_messages')
        .select('created_at')
        .eq('id', messageId)
        .eq('group_id', currentGroupId.current)
        .single();

      if (messageError || !messageData) {
        console.error('❌ Error loading message:', messageError);
        return { success: false, error: 'הודעה לא נמצאה' };
      }

      const messageDate = new Date(messageData.created_at);
      const beforeDate = new Date(messageDate.getTime() - 7 * 24 * 60 * 60 * 1000); // שבוע לפני
      const afterDate = new Date(messageDate.getTime() + 7 * 24 * 60 * 60 * 1000); // שבוע אחרי

      // נטען הודעות סביב ההודעה
      const { data } = await chatMessageService.getChatMessages(
        currentGroupId.current,
        user.id,
        { limit: 200, offset: 0 },
        {
          date_from: beforeDate.toISOString(),
          date_to: afterDate.toISOString(),
        }
      );

      if (data && data.messages.length > 0) {
        console.log('✅ Loaded', data.messages.length, 'messages around target message');
        
        // נמיזג את ההודעות עם ההודעות הקיימות
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = data.messages.filter(m => !existingIds.has(m.id));
          
          if (newMessages.length > 0) {
            // נמיין את כל ההודעות לפי תאריך (מהחדש לישן) עבור FlatList inverted
            const allMessages = [...prev, ...newMessages].sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            return allMessages;
          }
          
          return prev;
        });
        
        return { success: true };
      }

      return { success: false, error: 'לא נמצאו הודעות' };
    } catch (error: any) {
      console.error('❌ Error loading messages around:', error);
      return { success: false, error: error.message };
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
  
  // ============================================
  // Leave group
  // ============================================
  
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
    // #region agent log
    const logData = {location:'ChatContext.tsx:638',message:'sendMessage called',data:{userId:user?.id,groupId:input.group_id,content:input.content?.substring(0,50),messageType:input.message_type,replyTo:input.reply_to_message_id,hasMentions:!!input.mentioned_users?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
    console.log('🔍 DEBUG [A]:', JSON.stringify(logData));
    fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    // #endregion
    if (!user) return { success: false, error: 'לא מחובר' };
    
    setIsSendingMessage(true);
    
    // מציאת הודעת המקור עבור reply_to
    let replyToData: ChatMessage['reply_to'] | undefined;
    if (input.reply_to_message_id) {
      const originalMessage = messages.find(m => m.id === input.reply_to_message_id);
      if (originalMessage) {
        replyToData = {
          message_id: originalMessage.id,
          content: originalMessage.content,
          message_type: originalMessage.message_type,
          media_url: originalMessage.media_url,
          sender_id: originalMessage.sender_id,
          sender_name: originalMessage.sender?.display_name || 'משתמש',
        };
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:648',message:'Found reply_to in local messages',data:{replyToId:replyToData.message_id,replyToContent:replyToData.content?.substring(0,30)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.log('📎 Found reply_to message for optimistic update:', replyToData);
      } else {
        // אם לא מצאנו את ההודעה, נטען אותה
        try {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:658',message:'Loading reply_to from DB',data:{replyToId:input.reply_to_message_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
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
            .eq('id', input.reply_to_message_id)
            .single();
          
          if (replyToMessage) {
            const sender = Array.isArray(replyToMessage.sender) 
              ? replyToMessage.sender[0] 
              : replyToMessage.sender;
            replyToData = {
              message_id: replyToMessage.id,
              content: replyToMessage.content,
              message_type: replyToMessage.message_type,
              media_url: replyToMessage.media_url,
              sender_id: replyToMessage.sender_id,
              sender_name: sender?.display_name || 'משתמש',
            };
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:688',message:'Loaded reply_to from DB',data:{replyToId:replyToData.message_id,replyToContent:replyToData.content?.substring(0,30)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            console.log('📎 Loaded reply_to message from DB for optimistic update:', replyToData);
          }
    } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:691',message:'Error loading reply_to',data:{error:error instanceof Error?error.message:'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          console.error('❌ Error loading reply_to message:', error);
        }
      }
    }
    
    // Optimistic UI - add message immediately
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      group_id: input.group_id,
      sender_id: user.id,
      content: input.content,
      message_type: input.message_type,
      media_url: input.media_url,
      media_thumbnail_url: input.media_thumbnail_url,
      media_type: input.media_type,
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
    };
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatContext.tsx:727',message:'Adding optimistic message',data:{tempId:optimisticMessage.id,hasReplyTo:!!optimisticMessage.reply_to,replyToId:optimisticMessage.reply_to_message_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log('📤 Sending optimistic message with reply_to:', optimisticMessage.reply_to);
    setMessages(prev => {
      // הוספה בתחילת המערך כי המערך בסדר יורד (חדשה לישנה) עבור FlatList inverted
      const updated = [optimisticMessage, ...prev];
      console.log('📤 Added optimistic message, total messages:', updated.length, 'first ID:', updated[0]?.id);
      return updated;
    });
    
    try {
      // #region agent log
      const logData1 = {location:'ChatContext.tsx:773',message:'Calling sendChatMessage service',data:{tempId:optimisticMessage.id,groupId:input.group_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
      console.log('🔍 DEBUG [A]:', JSON.stringify(logData1));
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData1)}).catch(()=>{});
      // #endregion
      const { data, error } = await chatMessageService.sendChatMessage(input, user.id);
      
      // #region agent log
      const logData2 = {location:'ChatContext.tsx:778',message:'sendChatMessage response',data:{hasData:!!data,hasError:!!error,messageId:data?.id,errorCode:error?.code,hasReplyTo:!!data?.reply_to,errorMessage:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
      console.log('🔍 DEBUG [A]:', JSON.stringify(logData2));
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData2)}).catch(()=>{});
      // #endregion
      if (data) {
        // Replace optimistic message with real one, preserving reply_to if missing
        // או הוסף אם ההודעה כבר הגיעה דרך realtime
        setMessages(prev => {
          // בדוק אם ההודעה כבר קיימת (הגיעה דרך realtime)
          const existingIndex = prev.findIndex(m => m.id === data.id);
          if (existingIndex !== -1) {
            // ההודעה כבר קיימת - עדכן אותה עם reply_to אם חסר
            const existingMsg = prev[existingIndex];
            const finalMessage = {
              ...data,
              reply_to: data.reply_to || existingMsg.reply_to || optimisticMessage.reply_to,
            };
            // #region agent log
            const logData3 = {location:'ChatContext.tsx:790',message:'Updating existing message from sendMessage response',data:{messageId:data.id,hasReplyTo:!!finalMessage.reply_to,replyToFromData:!!data.reply_to,replyToFromExisting:!!existingMsg.reply_to},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
            console.log('🔍 DEBUG [B]:', JSON.stringify(logData3));
            fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData3)}).catch(()=>{});
            // #endregion
            // יוצר array חדש כדי לוודא ש-React מזהה את השינוי
            const updated = [...prev];
            updated[existingIndex] = finalMessage;
            return updated;
          }
          
          // אם לא קיימת, נחפש optimistic message ונחליף אותו
          const optimisticIndex = prev.findIndex(m => m.id === optimisticMessage.id);
          if (optimisticIndex !== -1) {
            // שמור את reply_to מה-optimistic אם ההודעה האמיתית לא מכילה אותו
            const finalMessage = {
              ...data,
              reply_to: data.reply_to || optimisticMessage.reply_to,
            };
            // #region agent log
            const logData3 = {location:'ChatContext.tsx:790',message:'Replacing optimistic with real',data:{tempId:optimisticMessage.id,realId:data.id,hasReplyTo:!!finalMessage.reply_to,replyToFromData:!!data.reply_to,replyToFromOptimistic:!!optimisticMessage.reply_to},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
            console.log('🔍 DEBUG [B]:', JSON.stringify(logData3));
            fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData3)}).catch(()=>{});
            // #endregion
            // יוצר array חדש כדי לוודא ש-React מזהה את השינוי
            const updated = [...prev];
            updated[optimisticIndex] = finalMessage;
            console.log('🔄 Updated messages array after replacing optimistic:', {
              oldId: optimisticMessage.id,
              newId: finalMessage.id,
              totalMessages: updated.length,
              lastMessageId: updated[updated.length - 1]?.id,
              optimisticIndex,
              hasSender: !!finalMessage.sender,
              messageContent: finalMessage.content?.substring(0, 20),
            });
            console.log('📝 Final message structure:', {
              id: finalMessage.id,
              hasSender: !!finalMessage.sender,
              senderId: finalMessage.sender_id,
              content: finalMessage.content?.substring(0, 30),
            });
            return updated;
          }
          
          // אם לא מצאנו גם optimistic וגם לא קיימת - נוסיף את ההודעה בתחילת המערך
          // #region agent log
          const logData3 = {location:'ChatContext.tsx:790',message:'Adding message from sendMessage response (no optimistic found)',data:{messageId:data.id,hasReplyTo:!!data.reply_to},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
          console.log('🔍 DEBUG [B]:', JSON.stringify(logData3));
          fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData3)}).catch(()=>{});
          // #endregion
          return [data, ...prev];
        });
        
        // Update group last message
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
        // Remove optimistic message on error
        // #region agent log
        const logData4 = {location:'ChatContext.tsx:815',message:'Error sending message, removing optimistic',data:{tempId:optimisticMessage.id,errorCode:error?.code,errorMessage:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
        console.log('🔍 DEBUG [A]:', JSON.stringify(logData4));
        console.error('❌ Error sending message:', error?.message || error?.code || 'Unknown error', error);
        fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData4)}).catch(()=>{});
        // #endregion
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        return { success: false, error: error?.message || 'שגיאה בשליחת הודעה' };
      }
    } finally {
      setIsSendingMessage(false);
    }
  }, [user, messages]);
  
  // ============================================
  // Edit message
  // ============================================
  
  const editMessage = useCallback(async (messageId: string, content: string) => {
    if (!user) return { success: false, error: 'לא מחובר' };
    
    const { data, error } = await chatMessageService.editChatMessage(
      { message_id: messageId, content },
      user.id
    );
    
    if (data) {
      setMessages(prev => prev.map(m => m.id === messageId ? data : m));
      return { success: true };
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
    
    if (!errors) {
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
    
    // שליחה לשרת
    await chatMessageService.addReaction({ message_id: messageId, emoji }, user.id);
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
    
    // שליחה לשרת
    await chatMessageService.removeReaction({ message_id: messageId, emoji }, user.id);
  }, [user]);
  
  // ============================================
  // Star message
  // ============================================
  
  const starMessage = useCallback(async (messageId: string, groupId: string) => {
    if (!user) return;
    await chatMessageService.starMessage(messageId, groupId, user.id);
    
    // Update message in list
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, is_starred_by_me: true } : m
    ));
  }, [user]);
  
  const unstarMessage = useCallback(async (messageId: string) => {
    if (!user) return;
    await chatMessageService.unstarMessage(messageId, user.id);
    
    // Update message in list
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, is_starred_by_me: false } : m
    ));
  }, [user]);
  
  // ============================================
  // Typing
  // ============================================
  
  const setTyping = useCallback(async (groupId: string, isTyping: boolean) => {
    if (!user) return;
    
    try {
      const result = await chatRealtimeService.setTypingStatus({ group_id: groupId, is_typing: isTyping }, user.id);
      // בדיקה אם יש error בתוצאה
      if (result.error) {
        // רק עבור התחלת הקלדה נדווח - עבור סיום הקלדה זה לא קריטי
        if (isTyping) {
          console.warn('⚠️ Warning: Could not set typing status (usually harmless):', result.error.message);
        }
      }
    } catch (error: any) {
      // לא נדווח כעל error חמור - יכול להיות בעיית רשת זמנית
      console.warn('⚠️ Warning: Exception while updating typing status (usually harmless):', error?.message || error);
    }
  }, [user]);
  
  // ============================================
  // Mark as read
  // ============================================
  
  const markAsRead = useCallback(async (groupId: string, messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;
    
    await chatMessageService.markMessagesAsRead(
      { group_id: groupId, message_ids: messageIds },
      user.id
    );
    
    // Update group unread count
    setGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, unread_count: 0 } : g
    ));
  }, [user]);
  
  // ============================================
  // Calculate total unread
  // ============================================
  
  const totalUnreadCount = groups.reduce((sum, g) => sum + (g.unread_count || 0), 0);
  
  // ============================================
  // Effects
  // ============================================
  
  // Load groups on mount
  useEffect(() => {
    if (user) {
      loadGroups();
      
      // Update online status
      chatRealtimeService.updateOnlineStatus(user.id, true);
      
      // Start typing cleanup
      chatRealtimeService.startTypingCleanup();
      
      // Subscribe to all user groups for notifications
      chatRealtimeService.subscribeToAllUserGroups(
        user.id,
        (groupId, message) => {
          // New message in a group
          setGroups(prev => prev.map(g => 
            g.id === groupId
              ? {
                  ...g,
                  last_message_at: message.created_at,
                  last_message_preview: message.content || '📎 מדיה',
                  unread_count: (g.unread_count || 0) + 1,
                }
              : g
          ));
          
          // Play notification sound
          notificationSound.current?.replayAsync();
        },
        (groupId, data) => {
          // Group updated
          setGroups(prev => prev.map(g => 
            g.id === groupId ? { ...g, ...data } : g
          ));
        }
      );
    }
    
    return () => {
      if (user) {
        chatRealtimeService.updateOnlineStatus(user.id, false);
        chatRealtimeService.stopTypingCleanup();
        chatRealtimeService.unsubscribeAll();
      }
    };
  }, [user, loadGroups]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentGroupId.current) {
        chatRealtimeService.unsubscribeFromGroup(currentGroupId.current);
      }
    };
  }, []);
  
  // ============================================
  // Context value
  // ============================================

  const value: ChatContextType = {
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
    totalUnreadCount,
  };

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
