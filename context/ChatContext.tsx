import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Message, Chat } from '../services/supabase';
import { ChatService } from '../services/chatService';
import { TypingService, TypingUser } from '../services/typingService';
import { supabase } from '../services/supabase';

interface ChatContextType {
  messages: Message[];
  chats: Chat[];
  currentChatId: string | null;
  isLoading: boolean;
  typingUsers: TypingUser[];
  sendMessage: (content: string, replyTo?: string | null, mentions?: any[]) => Promise<void>;
  sendFileMessage: (fileType: 'image' | 'voice' | 'file') => Promise<void>;
  sendMediaMessage: (mediaUrl: string, mediaType: string, caption?: string, metadata?: any, replyTo?: string | null) => Promise<void>;
  setCurrentChat: (chatId: string) => void;
  loadMessages: (chatId: string) => Promise<void>;
  loadChats: () => Promise<void>;
  markMessageAsRead: (messageId: string) => Promise<void>;
  markMessageAsDelivered: (messageId: string) => Promise<void>;
  updateMessage: (messageId: string, newContent: string, mentions?: any[]) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    console.error('❌ useChat: Context not found - make sure ChatProvider is wrapping the component');
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
  userId: string;
  initialChatId?: string;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children, userId, initialChatId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(initialChatId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({});
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load user name for typing indicator
  useEffect(() => {
    if (userId) {
      console.log('🔄 ChatContext: Loading user name for:', userId);
      
      supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('❌ ChatContext: Error loading user name:', error);
            return;
          }
          
          if (data?.full_name) {
            setCurrentUserName(data.full_name);
            console.log('✅ ChatContext: User name loaded:', data.full_name);
          }
        });
    }
  }, [userId]);


  // טעינה מקדימה של הודעות לכל הצ'אטים אחרי שהם נטענו (CACHE בלבד, בלי להחליף UI)
  useEffect(() => {
    if (chats.length > 0 && userId) {
      console.log('🚀 ChatContext: Preloading messages for all chats (cache only):', chats.length);
      const startTime = Date.now();
      
      const chatsToPreload = chats.slice(0, 3);
      Promise.all(
        chatsToPreload.map(async (chat) => {
          try {
            const messageList = await ChatService.getMessages(chat.id);
            setMessagesCache(prev => ({ ...prev, [chat.id]: messageList }));
          } catch (error) {
            console.error(`❌ Error preloading messages for chat ${chat.id}:`, error);
          }
        })
      ).then(() => {
        const endTime = Date.now();
        console.log(`⏱️ ChatContext: Preloaded (cache) for ${chatsToPreload.length} chats in ${endTime - startTime}ms`);
      });
    }
  }, [chats.length, userId]);

  // טעינה מקדימה של מידע נוסף לצ'אט הראשי
  useEffect(() => {
    if (initialChatId && userId) {
      console.log('🚀 ChatContext: Preloading additional data for initial chat:', initialChatId);
      const startTime = Date.now();
      
      // טען מידע נוסף במקביל
      Promise.all([
        ChatService.getChannelMembersCount(initialChatId).then(({ count, error }) => {
          if (!error && typeof count === 'number') {
            console.log('✅ Preloaded members count:', count);
          }
        }),
        ChatService.getChannelImageUrl(initialChatId).then(url => {
          console.log('✅ Preloaded channel image:', url ? 'Yes' : 'No');
        }),
        // טען גם את רשימת החברים
        ChatService.getChannelMembersCount(initialChatId).then(({ count, error }) => {
          if (!error && typeof count === 'number') {
            console.log('✅ Preloaded channel members count:', count);
          }
        })
      ]).then(() => {
        const endTime = Date.now();
        console.log(`⏱️ ChatContext: Preloaded additional data in ${endTime - startTime}ms`);
      });
    }
  }, [initialChatId, userId]);

  // טעינה מקדימה של מידע נוסף לכל הצ'אטים
  useEffect(() => {
    if (chats.length > 0 && userId) {
      console.log('🚀 ChatContext: Preloading additional data for all chats:', chats.length);
      const startTime = Date.now();
      
      // טען מידע נוסף לכל הצ'אטים במקביל (רק 3 הראשונים)
      const chatsToPreload = chats.slice(0, 3);
      Promise.all(
        chatsToPreload.map(chat => 
          Promise.all([
            ChatService.getChannelMembersCount(chat.id).then(({ count, error }) => {
              if (!error && typeof count === 'number') {
                console.log(`✅ Preloaded members count for ${chat.id}:`, count);
              }
            }),
            ChatService.getChannelImageUrl(chat.id).then(url => {
              console.log(`✅ Preloaded channel image for ${chat.id}:`, url ? 'Yes' : 'No');
            })
          ]).catch(error => 
            console.error(`❌ Error preloading additional data for chat ${chat.id}:`, error)
          )
        )
      ).then(() => {
        const endTime = Date.now();
        console.log(`⏱️ ChatContext: Preloaded additional data for ${chatsToPreload.length} chats in ${endTime - startTime}ms`);
      });
    }
  }, [chats.length, userId]);

  // טעינה מקדימה של מידע נוסף לצ'אט הראשי
  useEffect(() => {
    if (initialChatId && userId) {
      console.log('🚀 ChatContext: Preloading additional data for initial chat:', initialChatId);
      const startTime = Date.now();
      
      // טען מידע נוסף במקביל
      Promise.all([
        ChatService.getChannelMembersCount(initialChatId).then(({ count, error }) => {
          if (!error && typeof count === 'number') {
            console.log('✅ Preloaded members count:', count);
          }
        }),
        ChatService.getChannelImageUrl(initialChatId).then(url => {
          console.log('✅ Preloaded channel image:', url ? 'Yes' : 'No');
        })
      ]).then(() => {
        const endTime = Date.now();
        console.log(`⏱️ ChatContext: Preloaded additional data in ${endTime - startTime}ms`);
      });
    }
  }, [initialChatId, userId]);

  // Subscribe to real-time messages when chat changes
  useEffect(() => {
    if (!currentChatId) return;

    console.log('🔔 Setting up real-time subscription for chat:', currentChatId);
    
    // טען הודעות מחדש כשהערוץ משתנה
    loadMessages(currentChatId);
    
    const subscription = ChatService.subscribeToMessages(currentChatId, (newMessage) => {
      console.log('📨 Received real-time message:', newMessage);
      setMessages(prev => {
        // בדיקה שההודעה לא קיימת כבר (למניעת כפילויות)
        const exists = prev.some(msg => msg.id === newMessage.id);
        if (exists) {
          console.log('⚠️ Message already exists, skipping duplicate');
          return prev;
        }
        
        // בדיקה אם זו הודעה זמנית שצריך להחליף (רק למשתמש ששלח)
        const tempMessageIndex = prev.findIndex(msg => {
          const isTemp = msg.id.startsWith('temp_');
          const sameSender = msg.sender_id === newMessage.sender_id;
          const sameContent = (msg.content || '').trim() === (newMessage.content || '').trim();
          const sameReply = (msg.reply_to_message_id || '') === (newMessage.reply_to_message_id || '');
          return isTemp && sameSender && sameContent && sameReply;
        });
        
        if (tempMessageIndex !== -1) {
          console.log('🔄 Replacing temporary message with real-time message');
          const newMessages = [...prev];
          newMessages[tempMessageIndex] = { ...newMessage, status: 'sent' as const };
          return newMessages;
        }
        
        console.log('➕ Adding new real-time message from', newMessage.sender_id === userId ? 'self' : 'other user');
        return [newMessage, ...prev];
      });
    });

    // Subscribe to message updates (for edited messages)
    const updateSubscription = ChatService.subscribeToMessageUpdates(currentChatId, (updatedMessage) => {
      console.log('✏️ Received real-time message update:', updatedMessage);
      setMessages(prev => prev.map(msg => 
        msg.id === updatedMessage.id ? updatedMessage : msg
      ));
    });

    return () => {
      console.log('🔕 Unsubscribing from real-time messages for chat:', currentChatId);
      subscription.unsubscribe();
      updateSubscription.unsubscribe();
    };
  }, [currentChatId]);

  // Subscribe to typing events when chat changes
  useEffect(() => {
    if (!currentChatId || !userId || !currentUserName) return;

    console.log('👀 ChatContext: Setting up typing subscription for chat:', currentChatId);

    const unsubscribe = TypingService.subscribeToTyping(
      currentChatId,
      userId,
      (typingUsersList) => {
        console.log('✍️ ChatContext: Typing users updated:', typingUsersList);
        setTypingUsers(typingUsersList);
      }
    );

    return () => {
      console.log('🔕 ChatContext: Unsubscribing from typing events');
      unsubscribe();
      setTypingUsers([]);
    };
  }, [currentChatId, userId, currentUserName]);

  useEffect(() => {
    if (initialChatId) {
      setCurrentChatId(initialChatId);
      loadMessages(initialChatId);
    }
  }, [initialChatId]);

  const loadChats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('🔄 ChatContext: Loading chats for user:', userId);
      const chatList = await ChatService.getChats(userId);
      console.log('📋 ChatContext: Loaded chats:', chatList);
      setChats(chatList);
      
      // אל תקבע צ'אט ראשון כברירת מחדל אם כבר הועבר initialChatId
      // הגנה מרייס: נקבע רק אם אין currentChatId וגם אין initialChatId
      if (chatList.length > 0 && !currentChatId && !initialChatId) {
        console.log('🎯 ChatContext: No current/initial chat - setting first chat as default:', chatList[0].id);
        setCurrentChatId(chatList[0].id);
        loadMessages(chatList[0].id);
      } else if (chatList.length === 0) {
        console.log('⚠️ ChatContext: No chats found for user');
      } else {
        console.log('ℹ️ ChatContext: Current chat already set:', currentChatId);
      }
    } catch (error) {
      console.error('❌ ChatContext: Error loading chats:', error);
      setError(error instanceof Error ? error.message : 'Failed to load chats');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    if (!chatId) return;
    
    console.log('🔄 ChatContext: Loading messages for chat:', chatId);
    const startTime = Date.now();
    
    // בדוק אם יש cache
    if (messagesCache[chatId]) {
      console.log('✅ ChatContext: Using cached messages for chat:', chatId);
      setMessages(messagesCache[chatId]);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const messageList = await ChatService.getMessages(chatId);
      const endTime = Date.now();
      console.log(`⏱️ ChatContext: Loaded ${messageList.length} messages in ${endTime - startTime}ms`);
      
      // שמור ב-cache
      setMessagesCache(prev => ({
        ...prev,
        [chatId]: messageList
      }));
      
      // עדכון ישיר ללא בדיקות מיותרות
      setMessages(messageList);
    } catch (error) {
      console.error('❌ ChatContext: Error loading messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string, replyTo?: string | null, mentions?: any[]) => {
    console.log('🚀 ChatContext sendMessage called:', { content, replyTo, mentions, currentChatId, userId });
    if (!currentChatId) {
      console.error('❌ No current chat ID');
      return;
    }
    if (!userId) {
      console.error('❌ No user ID');
      return;
    }
    
    // צור הודעה זמנית להצגה מיידית למשתמש ששלח
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tempMessage: Message = {
      id: tempId,
      channel_id: currentChatId,
      sender_id: userId,
      content,
      type: 'text' as any,
      created_at: new Date().toISOString(),
      reply_to_message_id: replyTo || undefined,
      mentions: mentions || undefined,
      status: 'sending' as any,
    };
    
    // הוסף הודעה זמנית רק למשתמש ששלח
    console.log('📤 ChatContext: Adding temporary message for sender:', tempId);
    setMessages(prev => [tempMessage, ...prev]);
    
    try {
      console.log('📤 ChatContext: Sending message via ChatService...');
      const result = await ChatService.sendMessage({
        channelId: currentChatId,
        content,
        senderId: userId,
        type: 'channel',
        recipientId: null,
        replyTo: replyTo || null,
        mentions
      });
      console.log('✅ ChatContext: Message sent successfully:', result);
      
      // ההודעה האמיתית תגיע דרך realtime subscription
      // ה-subscription יחליף את ההודעה הזמנית בהודעה האמיתית
      
      // עדכן גם את הצ'אט האחרון
      if (result && result.id) {
        setChats(prev => prev.map(chat => {
          if (chat.id === currentChatId) {
            return {
              ...chat,
              last_message: {
                id: result.id,
                content: result.content,
                created_at: result.created_at,
                status: 'sent' as const,
                sender_id: result.sender_id,
                type: result.type,
                channel_id: result.channel_id,
                chat_id: result.chat_id
              } as Message
            };
          }
          return chat;
        }));
        
        console.log('✅ ChatContext: Chat updated with last message');
      }
      
      console.log('✅ ChatContext: Message sent - waiting for realtime to replace temp message');
    } catch (error) {
      console.error('❌ ChatContext: Error sending message:', error);
      
      // הסר את ההודעה הזמנית במקרה של שגיאה
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    }
  };

  const sendFileMessage = async (fileType: 'image' | 'voice' | 'file') => {
    if (!currentChatId) return;

    try {
      const newMessage = await ChatService.sendFileMessage(currentChatId, userId, fileType);
      if (newMessage) {
        setMessages(prev => [newMessage, ...prev]);
      }
    } catch (error) {
      console.error('Error sending file message:', error);
    }
  };

  const sendMediaMessage = async (mediaUrl: string, mediaType: string, caption?: string, metadata?: any, replyTo?: string | null) => {
    if (!currentChatId) return;
    if (!userId) return;

    try {
      const newMessage = await ChatService.sendMediaMessage({
        channelId: currentChatId,
        senderId: userId,
        mediaUrl,
        mediaType: mediaType as 'image' | 'video' | 'audio' | 'document',
        caption,
        metadata,
        replyTo
      });
      
      if (newMessage) {
        console.log('✅ ChatContext: Media message sent successfully');
        setMessages(prev => [newMessage, ...prev]);
      }
    } catch (error) {
      console.error('Error sending media message:', error);
    }
  };

  const setCurrentChat = (chatId: string) => {
    console.log('🔄 ChatContext: Switching to chat:', chatId);
    setCurrentChatId(chatId);

    // הצג מיד הודעות מה־cache אם קיימות, אחרת נקה כדי למנוע הצגת צ'אט קודם
    if (messagesCache[chatId]) {
      setMessages(messagesCache[chatId]);
    } else {
      setMessages([]);
    }

    // ואז טען הודעות טריות
    loadMessages(chatId);
  };

  const markMessageAsRead = async (messageId: string) => {
    if (!currentChatId) return;
    try {
      console.log('🔄 ChatContext: Marking message as read:', { messageId, userId, currentChatId });
      
      // Mark message as read in the read_by array
      await ChatService.markAsRead(messageId, userId);
      
      // Update last_read_message_id in channel_members
      await ChatService.markMessagesAsRead(currentChatId, userId, messageId);
      
      console.log('✅ ChatContext: Message marked as read and last_read_message_id updated');
      console.log('📊 ChatContext: This should trigger unread count update in ChatsListScreen');
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const markMessageAsDelivered = async (messageId: string) => {
    if (!currentChatId) return;
    try {
      await ChatService.markAsDelivered(messageId);
    } catch (error) {
      console.error('Error marking message as delivered:', error);
    }
  };

  const updateMessage = async (messageId: string, newContent: string, mentions?: any[]) => {
    console.log('✏️ ChatContext: Updating message:', { messageId, newContent, mentions });
    
    try {
      // עדכן את ההודעה במסד הנתונים
      const updatedMessage = await ChatService.editMessage(messageId, newContent, mentions);
      
      if (updatedMessage) {
        console.log('✅ ChatContext: Message updated successfully, updating local state');
        
        // עדכן את ההודעה ברשימה המקומית
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: newContent, mentions: mentions || undefined, updated_at: updatedMessage.updated_at }
            : msg
        ));
        
        console.log('✅ ChatContext: Local state updated with edited message');
      } else {
        console.error('❌ ChatContext: Failed to update message');
        throw new Error('Failed to update message');
      }
    } catch (error) {
      console.error('❌ ChatContext: Error updating message:', error);
      throw error;
    }
  };

  const deleteMessage = async (messageId: string) => {
    console.log('🗑️ ChatContext: Deleting message:', { messageId, userId });
    
    if (!userId) {
      console.error('❌ ChatContext: No userId available for deletion');
      throw new Error('User not authenticated');
    }
    
    try {
      // מחק את ההודעה ממסד הנתונים
      const success = await ChatService.deleteMessage(messageId, userId);
      
      if (success) {
        console.log('✅ ChatContext: Message deleted successfully, updating local state');
        
        // הסר את ההודעה מהרשימה המקומית
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        
        console.log('✅ ChatContext: Local state updated - message removed');
      } else {
        console.error('❌ ChatContext: Failed to delete message');
        throw new Error('Failed to delete message');
      }
    } catch (error) {
      console.error('❌ ChatContext: Error deleting message:', error);
      throw error;
    }
  };

  const startTyping = () => {
    if (!currentChatId || !userId || !currentUserName) return;
    
    console.log('✍️ ChatContext: User started typing');
    TypingService.startTyping(currentChatId, userId, currentUserName);
  };

  const stopTyping = () => {
    if (!currentChatId || !userId) return;
    
    console.log('🛑 ChatContext: User stopped typing');
    TypingService.stopTyping(currentChatId, userId);
  };

  // Load chats and messages on mount - טעינה מקדימה
  useEffect(() => {
    if (userId) {
      console.log('🔄 ChatContext: userId changed, preloading data for:', userId);
      const startTime = Date.now();
      
      // טען הכל במקביל
      Promise.all([
        loadChats(),
        // אם יש chatId התחלתי, טען גם את ההודעות שלו
        initialChatId ? loadMessages(initialChatId) : Promise.resolve()
      ]).then(() => {
        const endTime = Date.now();
        console.log(`⏱️ ChatContext: Preloading completed in ${endTime - startTime}ms`);
        setIsInitialized(true);
      }).catch((error) => {
        console.error('❌ ChatContext: Error preloading data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load data');
        setIsInitialized(true); // גם במקרה של שגיאה, נאפשר גישה לקומפוננטה
      });
    } else {
      console.log('⚠️ ChatContext: No userId yet');
      setIsInitialized(true);
    }
  }, [userId, initialChatId]);

  const value: ChatContextType = {
    messages,
    chats,
    currentChatId,
    isLoading,
    typingUsers,
    sendMessage,
    sendFileMessage,
    sendMediaMessage,
    setCurrentChat,
    loadMessages,
    loadChats,
    markMessageAsRead,
    markMessageAsDelivered,
    updateMessage,
    deleteMessage,
    startTyping,
    stopTyping,
  };

  // אם עדיין לא הסתיים האתחול, הצג טוען
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10, color: '#666' }}>טוען צ'אט...</Text>
      </View>
    );
  }

  // אם יש שגיאה, הצג אותה
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', textAlign: 'center', marginBottom: 20 }}>
          שגיאה בטעינת הצ'אט: {error}
        </Text>
        <TouchableOpacity 
          style={{ backgroundColor: '#007AFF', padding: 10, borderRadius: 5 }}
          onPress={() => setError(null)}
        >
          <Text style={{ color: 'white' }}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}; 