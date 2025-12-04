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
import { Audio } from 'expo-av';

// ============================================
// Types
// ============================================

interface ChatContextType {
  // State
  groups: ChatGroup[];
  currentGroup: ChatGroupWithDetails | null;
  messages: ChatMessage[];
  typingUsers: ChatTypingIndicator[];
  isLoadingGroups: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  
  // Group Actions
  loadGroups: () => Promise<void>;
  selectGroup: (groupId: string) => Promise<void>;
  createGroup: (input: CreateChatGroupInput) => Promise<{ success: boolean; groupId?: string; error?: string }>;
  updateGroup: (groupId: string, input: UpdateChatGroupInput) => Promise<{ success: boolean; error?: string }>;
  leaveGroup: (groupId: string) => Promise<{ success: boolean; error?: string }>;
  
  // Message Actions
  sendMessage: (input: SendChatMessageInput) => Promise<{ success: boolean; error?: string }>;
  loadMoreMessages: () => Promise<void>;
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
  
  // Refs
  const messagesOffset = useRef(0);
  const hasMoreMessages = useRef(true);
  const currentGroupId = useRef<string | null>(null);
  const notificationSound = useRef<Audio.Sound | null>(null);
  
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
    
    try {
      // Load group details
      const { data: groupData } = await chatGroupService.getChatGroupDetails(groupId, user.id);
      if (groupData) {
        setCurrentGroup(groupData);
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
        
        // Mark as read
        if (messagesData.messages.length > 0) {
          const unreadIds = messagesData.messages
            .filter(m => !m.is_read_by_me)
            .map(m => m.id);
          
          if (unreadIds.length > 0) {
            await markAsRead(groupId, unreadIds);
          }
        }
      }
      
      // Subscribe to realtime updates
      chatRealtimeService.subscribeToGroup(groupId, user.id, {
        onMessage: (message, eventType) => {
          if (eventType === 'INSERT') {
            // New message
            setMessages(prev => [...prev, message]);
            
            // Play sound if not from me
            if (message.sender_id !== user.id) {
              notificationSound.current?.replayAsync();
            }
            
            // Auto mark as read
            if (currentGroupId.current === groupId) {
              markAsRead(groupId, [message.id]);
            }
          } else if (eventType === 'UPDATE') {
            // Updated message
            setMessages(prev => prev.map(m => m.id === message.id ? message : m));
          } else if (eventType === 'DELETE') {
            // Deleted message
            setMessages(prev => prev.filter(m => m.id !== message.id));
          }
        },
        onReaction: (reaction, eventType) => {
          // Update reactions in messages
          setMessages(prev => prev.map(m => {
            if (m.id === reaction.message_id) {
              // Refetch message with updated reactions
              // או לעדכן ידנית את הריאקציות
              return m;
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
        setMessages(prev => [...data.messages, ...prev]);
        messagesOffset.current += data.messages.length;
        hasMoreMessages.current = data.has_more;
      }
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user, isLoadingMessages]);
  
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
    if (!user) return { success: false, error: 'לא מחובר' };
    
    setIsSendingMessage(true);
    
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
    
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      const { data, error } = await chatMessageService.sendChatMessage(input, user.id);
      
      if (data) {
        // Replace optimistic message with real one
        setMessages(prev => prev.map(m => 
          m.id === optimisticMessage.id ? data : m
        ));
        
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
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        return { success: false, error: error?.message };
      }
    } finally {
      setIsSendingMessage(false);
    }
  }, [user]);
  
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
      if (deleteForEveryone) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
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
    await chatMessageService.addReaction({ message_id: messageId, emoji }, user.id);
  }, [user]);
  
  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
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
    await chatRealtimeService.setTypingStatus({ group_id: groupId, is_typing: isTyping }, user.id);
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
    loadGroups,
    selectGroup,
    createGroup,
    updateGroup,
    leaveGroup,
    sendMessage,
    loadMoreMessages,
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
