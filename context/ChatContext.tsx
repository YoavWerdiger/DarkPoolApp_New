import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Message, Chat } from '../services/supabase';
import { ChatService } from '../services/chatService';

interface ChatContextType {
  messages: Message[];
  chats: Chat[];
  currentChatId: string | null;
  isLoading: boolean;
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
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
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
      });
    } else {
      console.log('⚠️ ChatContext: No userId yet');
    }
  }, [userId]);

  // טעינה מקדימה של הודעות לכל הצ'אטים אחרי שהם נטענו
  useEffect(() => {
    if (chats.length > 0 && userId) {
      console.log('🚀 ChatContext: Preloading messages for all chats:', chats.length);
      const startTime = Date.now();
      
      // טען הודעות לכל הצ'אטים במקביל (רק 3 הראשונים)
      const chatsToPreload = chats.slice(0, 3);
      Promise.all(
        chatsToPreload.map(chat => 
          loadMessages(chat.id).catch(error => 
            console.error(`❌ Error preloading messages for chat ${chat.id}:`, error)
          )
        )
      ).then(() => {
        const endTime = Date.now();
        console.log(`⏱️ ChatContext: Preloaded messages for ${chatsToPreload.length} chats in ${endTime - startTime}ms`);
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
        
        // בדיקה אם זו הודעה זמנית שצריך להחליף
        const correlationKey = `${newMessage.sender_id}|${(newMessage.content || '').trim()}|${newMessage.reply_to_message_id || ''}`;
        const tempMessageIndex = prev.findIndex(msg => {
          const isTemp = msg.id.startsWith('temp_');
          const sameSender = msg.sender_id === newMessage.sender_id;
          const sameContent = (msg.content || '').trim() === (newMessage.content || '').trim();
          const sameReply = (msg.reply_to_message_id || '') === (newMessage.reply_to_message_id || '');
          const sameCorrelation = (msg as any).correlationKey && (msg as any).correlationKey === correlationKey;
          return isTemp && sameSender && (sameCorrelation || (sameContent && sameReply));
        });
        
        if (tempMessageIndex !== -1) {
          console.log('🔄 Replacing temporary message with real-time message');
          const newMessages = [...prev];
          newMessages[tempMessageIndex] = { ...newMessage, status: 'sent' as const };
          return newMessages;
        }
        
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

  useEffect(() => {
    if (initialChatId) {
      setCurrentChatId(initialChatId);
      loadMessages(initialChatId);
    }
  }, [initialChatId]);

  const loadChats = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 ChatContext: Loading chats for user:', userId);
      const chatList = await ChatService.getChats(userId);
      console.log('📋 ChatContext: Loaded chats:', chatList);
      setChats(chatList);
      
      // Set first chat as default if no current chat is set
      if (chatList.length > 0 && !currentChatId) {
        console.log('🎯 ChatContext: Setting first chat as default:', chatList[0].id);
        setCurrentChatId(chatList[0].id);
        loadMessages(chatList[0].id);
      } else if (chatList.length === 0) {
        console.log('⚠️ ChatContext: No chats found for user');
      } else {
        console.log('ℹ️ ChatContext: Current chat already set:', currentChatId);
      }
    } catch (error) {
      console.error('❌ ChatContext: Error loading chats:', error);
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
    
    // יצירת הודעה זמנית מיד כדי שהמשתמש יראה אותה
    const correlationKey = `${userId}|${(content || '').trim()}|${replyTo || ''}`;
    const tempMessage: Message = {
      id: `temp_${Date.now()}_${Math.random()}`,
      channel_id: currentChatId,
      sender_id: userId,
      content,
      type: replyTo ? 'reply' : 'text',
      recipient_id: undefined,
      reply_to_message_id: replyTo || undefined,
      mentions: mentions || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'sent' as const, // נשתמש ב-sent גם להודעה זמנית
      read_by: [],
      sender: {
        full_name: 'אתה'
      },
      // שדה עזר פנימי לדידופ
      ...( { correlationKey } as any )
    };
    
    // הוסף את ההודעה הזמנית מיד
    console.log('📤 ChatContext: Adding temporary message immediately');
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
      
      // בדיקה שההודעה נשלחה בהצלחה
      if (result && result.id) {
        console.log('🔄 ChatContext: Replacing temporary message with real message');
        
        // החלף את ההודעה הזמנית בהודעה האמיתית
        setMessages(prev => {
          const newMessages = prev.map(msg => 
            msg.id === tempMessage.id ? { ...result, status: 'sent' as const } : msg
          );
          console.log('📋 Messages after replacement:', newMessages.length);
          return newMessages;
        });
        
        // עדכן גם את הצ'אט האחרון
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
        
        console.log('✅ ChatContext: Message replaced and chat updated');
      } else {
        console.error('❌ ChatContext: Message result is invalid, removing temporary message');
        // הסר את ההודעה הזמנית אם השליחה נכשלה
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      }
      
      // Real-time subscription יטפל בעדכונים נוספים
      console.log('✅ ChatContext: Message sent and added to local state - real-time will handle further updates');
    } catch (error) {
      console.error('❌ ChatContext: Error sending message:', error);
      // הסר את ההודעה הזמנית אם השליחה נכשלה
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
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
    
    // טען הודעות (עם cache)
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

  const value: ChatContextType = {
    messages,
    chats,
    currentChatId,
    isLoading,
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
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}; 