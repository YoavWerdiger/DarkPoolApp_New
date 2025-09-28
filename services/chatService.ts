import { supabase, Message, Chat, ReactionSummary, ReactionDetail } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export type ChatListItem = {
  id: string;
  name: string;
  avatar_url: string;
  last_message: {
    content: string;
    timestamp: string;
    status: 'sent' | 'delivered' | 'read';
    sender_id: string;
    sender_name: string;
  } | null;
  unread_count: number;
  is_group: boolean;
  is_pinned: boolean;
  has_unread_mentions: boolean;
};

export class ChatService {
  // Fetch channel image URL (uses image_url column)
  static async getChannelImageUrl(channelId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('image_url')
        .eq('id', channelId)
        .single();
      if (error) {
        console.error('❌ Error fetching channel image url:', error);
        return null;
      }
      return (data as any)?.image_url || null;
    } catch (e) {
      console.error('❌ Exception fetching channel image url:', e);
      return null;
    }
  }
  // Send text message (supports both channel and DM)
  static async sendMessage({
    channelId,
    content,
    senderId,
    type = 'channel',
    recipientId = null,
    replyTo = null,
    mentions = null
  }: {
    channelId?: string;
    content: string;
    senderId: string;
    type?: 'channel' | 'dm';
    recipientId?: string | null;
    replyTo?: string | null;
    mentions?: any[] | null;
  }): Promise<Message | null> {
    try {
      console.log('🔄 ChatService: Sending message:', { channelId, content, senderId, type, recipientId, replyTo });
      
      // בדיקה שהמשתמש חבר בערוץ
      if (channelId) {
        console.log('🔍 ChatService: Checking if user is member of channel:', { senderId, channelId });
        const isMember = await this.isUserInChannel(senderId, channelId);
        console.log('👥 ChatService: User membership check result:', { senderId, channelId, isMember });
        
        if (!isMember) {
          console.error('❌ ChatService: User is not a member of the channel');
          return null;
        }
      }
      
      const isReply = !!replyTo;
      const messageData = {
        channel_id: channelId || null,
        sender_id: senderId,
        content,
        type: isReply ? 'reply' : 'text',
        recipient_id: recipientId || null,
        reply_to_message_id: replyTo || null,
        mentions: mentions || null
      };
      
      console.log('📝 ChatService: Message data to insert:', messageData);
      console.log('🔍 ChatService: Mentions data:', mentions);
      console.log('📅 ChatService: Current server time:', new Date().toISOString());
      
      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();
        
      if (error) {
        console.error('❌ ChatService: Supabase error:', error);
        throw error;
      }
      
      console.log('✅ ChatService: Message sent successfully:', data);
      console.log('🔍 ChatService: Saved mentions:', data.mentions);
      console.log('📅 ChatService: Message created_at from server:', data.created_at);
      console.log('📅 ChatService: Message created_at parsed:', new Date(data.created_at).toISOString());
      return data;
    } catch (error) {
      console.error('❌ ChatService: Error sending message:', error);
      return null;
    }
  }

  // Upload file and send message
  static async sendFileMessage(channelId: string, senderId: string, fileType: 'image' | 'voice' | 'file'): Promise<Message | null> {
    try {
      let result;
      
      if (fileType === 'image') {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        // TODO: Implement file picker for other types
        return null;
      }

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        const fileName = `chat_${channelId}_${Date.now()}.jpg`;
        
        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to Uint8Array (React Native compatible)
        const binaryString = this.base64ToBinary(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-files')
          .upload(fileName, bytes, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('chat-files')
          .getPublicUrl(fileName);

        // Send message with file URL
        const { data, error } = await supabase
          .from('messages')
          .insert({
            channel_id: channelId,
            sender_id: senderId,
            content: '📷 תמונה',
            type: fileType,
            file_url: publicUrl,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error sending file message:', error);
    }
    return null;
  }

  // פונקציה עזר להמרת base64 ל-binary string
  private static base64ToBinary(base64: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    
    // הסר רווחים וסימנים מיוחדים
    base64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
    
    while (i < base64.length) {
      const encoded1 = chars.indexOf(base64.charAt(i++));
      const encoded2 = chars.indexOf(base64.charAt(i++));
      const encoded3 = chars.indexOf(base64.charAt(i++));
      const encoded4 = chars.indexOf(base64.charAt(i++));
      
      const decoded1 = (encoded1 << 2) | (encoded2 >> 4);
      const decoded2 = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      const decoded3 = ((encoded3 & 3) << 6) | encoded4;
      
      result += String.fromCharCode(decoded1);
      if (encoded3 !== 64) result += String.fromCharCode(decoded2);
      if (encoded4 !== 64) result += String.fromCharCode(decoded3);
    }
    
    return result;
  }

  // Send media message with proper media data
  static async sendMediaMessage({
    channelId,
    senderId,
    mediaUrl,
    mediaType,
    caption = '',
    metadata = {},
    replyTo = null
  }: {
    channelId: string;
    senderId: string;
    mediaUrl: string;
    mediaType: 'image' | 'video' | 'audio' | 'document';
    caption?: string;
    metadata?: {
      file_name?: string;
      file_size?: number;
      duration?: number;
      width?: number;
      height?: number;
    };
    replyTo?: string | null;
  }): Promise<Message | null> {
    try {
      console.log('📤 ChatService: Sending media message:', { 
        channelId, 
        senderId, 
        mediaType, 
        mediaUrl, 
        caption,
        metadata 
      });
      
      // בדיקה שהמשתמש חבר בערוץ
      const isMember = await this.isUserInChannel(senderId, channelId);
      if (!isMember) {
        console.error('❌ ChatService: User is not a member of the channel');
        return null;
      }
      
      const messageData = {
        channel_id: channelId,
        sender_id: senderId,
        content: caption || `[${mediaType}]`,
        type: mediaType,
        file_url: mediaUrl,
        reply_to_message_id: replyTo || null
      };
      
      console.log('📝 ChatService: Media message data to insert:', messageData);
      
      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();
        
      if (error) {
        console.error('❌ ChatService: Supabase error:', error);
        throw error;
      }
      
      console.log('✅ ChatService: Media message sent successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ ChatService: Error sending media message:', error);
      return null;
    }
  }

  // Check if user has unread mentions in a channel
  static async hasUnreadMentions(channelId: string, userId: string): Promise<boolean> {
    try {
      console.log('🔍 ChatService: Checking for unread mentions:', { channelId, userId });
      
      // Get the last read message ID for this user in this channel
      const lastReadId = await this.getLastReadMessageId(channelId, userId);
      
      if (!lastReadId) {
        // If no last read message, check if there are any mentions at all
        const { data, error } = await supabase
          .from('messages')
          .select('id, mentions')
          .eq('channel_id', channelId)
          .not('mentions', 'is', null)
          .limit(50);
          
        if (error) {
          console.error('❌ ChatService: Error checking mentions:', error);
          return false;
        }
        
        // בדיקה ידנית של mentions
        const hasMentions = data?.some(message => {
          if (!message.mentions || !Array.isArray(message.mentions)) return false;
          return message.mentions.some((mention: any) => mention.user_id === userId);
        }) || false;
        
        console.log('🔍 ChatService: Manual mention check result:', hasMentions);
        return hasMentions;
      }
      
      // Get the timestamp of the last read message
      const { data: lastReadMessage, error: lastReadError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', lastReadId)
        .single();
        
      if (lastReadError) {
        console.error('❌ ChatService: Error getting last read message:', lastReadError);
        return false;
      }
      
      // Check for mentions after the last read message
      const { data: mentionMessages, error: mentionError } = await supabase
        .from('messages')
        .select('id, mentions')
        .eq('channel_id', channelId)
        .not('mentions', 'is', null)
        .gt('created_at', lastReadMessage.created_at)
        .limit(50);
        
      if (mentionError) {
        console.error('❌ ChatService: Error checking mention messages:', mentionError);
        return false;
      }
      
      // בדיקה ידנית של mentions
      const hasMentions = mentionMessages?.some(message => {
        if (!message.mentions || !Array.isArray(message.mentions)) return false;
        return message.mentions.some((mention: any) => mention.user_id === userId);
      }) || false;
      
      console.log('✅ ChatService: Has unread mentions:', hasMentions);
      return hasMentions;
    } catch (error) {
      console.error('❌ ChatService: Exception checking mentions:', error);
      return false;
    }
  }

  // Get the latest mention message ID for a user in a channel
  static async getLatestMentionMessageId(channelId: string, userId: string): Promise<string | null> {
    try {
      console.log('🔍 ChatService: Getting latest mention message ID:', { channelId, userId });
      
      const { data, error } = await supabase
        .from('messages')
        .select('id, mentions')
        .eq('channel_id', channelId)
        .not('mentions', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) {
        console.error('❌ ChatService: Error getting latest mention message:', error);
        return null;
      }
      
      // בדיקה ידנית של mentions
      const mentionMessage = data?.find(message => {
        if (!message.mentions || !Array.isArray(message.mentions)) return false;
        return message.mentions.some((mention: any) => mention.user_id === userId);
      });
      
      if (!mentionMessage) {
        console.log('ℹ️ ChatService: No mention messages found for user');
        return null;
      }
      
      console.log('✅ ChatService: Latest mention message ID:', mentionMessage.id);
      return mentionMessage.id;
    } catch (error) {
      console.error('❌ ChatService: Exception getting latest mention message:', error);
      return null;
    }
  }

  // Get messages for a channel - optimized for performance
  static async getMessages(channelId: string, limit = 50): Promise<Message[]> {
    try {
      console.log('📥 ChatService: Fetching messages for channel:', channelId);
      const startTime = Date.now();
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          type,
          file_url,
          created_at,
          updated_at,
          sender_id,
          channel_id,
          reply_to_message_id,
          mentions,
          read_by,
          viewed_by,
          sender:users!messages_sender_id_fkey(
            full_name,
            profile_picture
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(limit);

      const endTime = Date.now();
      console.log(`⏱️ ChatService: Query took ${endTime - startTime}ms`);

      if (error) {
        console.error('❌ ChatService: Error fetching messages:', error);
        throw error;
      }
      
      console.log('✅ ChatService: Fetched messages:', data?.length || 0, 'messages');
      
      // תיקון ה-sender מ-array ל-object
      const fixedData = data?.map(msg => ({
        ...msg,
        sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender
      })) || [];
      
      return fixedData;
    } catch (error) {
      console.error('❌ ChatService: Error fetching messages:', error);
      return [];
    }
  }

  // Subscribe to real-time messages
  static subscribeToMessages(channelId: string, onMessage: (message: Message) => void) {
    console.log('🔔 ChatService: Setting up subscription for channel:', channelId);
    
    return supabase
      .channel(`chat:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          console.log('📨 ChatService: Received real-time message payload:', payload);
          console.log('📨 ChatService: Payload new:', payload.new);
          
          // שלוף את ההודעה מחדש עם join ל-users
          const { data, error } = await supabase
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(
                id,
                full_name,
                profile_picture
              )
            `)
            .eq('id', payload.new.id)
            .single();
            
          if (error) {
            console.error('❌ Error fetching message for realtime:', error);
            return;
          }
          
          console.log('✅ ChatService: Fetched message for realtime:', data);
          onMessage(data as Message);
        }
      )
      .subscribe((status) => {
        console.log('🔔 ChatService: Subscription status:', status);
      });
  }

  // Subscribe to message status updates
  static subscribeToMessageStatus(channelId: string, onStatusUpdate: (message: Message) => void) {
    return supabase
      .channel(`status:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          onStatusUpdate(payload.new as Message);
        }
      )
      .subscribe();
  }

  // Subscribe to message updates (for edited messages)
  static subscribeToMessageUpdates(channelId: string, onMessageUpdate: (message: Message) => void) {
    console.log('🔔 ChatService: Setting up message updates subscription for channel:', channelId);
    
    return supabase
      .channel(`updates:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          console.log('✏️ ChatService: Received message update payload:', payload);
          
          // בדוק אם זה עדכון של תוכן (לא רק סטטוס)
          if (payload.new.content !== payload.old.content || payload.new.mentions !== payload.old.mentions) {
            console.log('✏️ ChatService: Content or mentions updated, fetching full message');
            
            // שלוף את ההודעה מחדש עם join ל-users
            const { data, error } = await supabase
              .from('messages')
              .select(`
                *,
                sender:users!messages_sender_id_fkey(
                  id,
                  full_name,
                  profile_picture
                )
              `)
              .eq('id', payload.new.id)
              .single();
              
            if (error) {
              console.error('❌ Error fetching updated message for realtime:', error);
              return;
            }
            
            console.log('✅ ChatService: Fetched updated message for realtime:', data);
            onMessageUpdate(data as Message);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 ChatService: Message updates subscription status:', status);
      });
  }

  // Mark message as read
  static async markAsRead(messageId: string, userId: string): Promise<void> {
    try {
      // עדכן את הסטטוס ל-read והוסף את המשתמש לרשימת הקוראים
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('read_by')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      const readBy = message?.read_by || [];
      if (!readBy.includes(userId)) {
        readBy.push(userId);
      }

      const { error: updateError } = await supabase
        .from('messages')
        .update({
          status: 'read',
          read_by: readBy
        })
        .eq('id', messageId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  // Mark message as delivered
  static async markAsDelivered(messageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ status: 'delivered' })
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking message as delivered:', error);
    }
  }

  // Update message status
  static async updateMessageStatus(messageId: string, status: 'sent' | 'delivered' | 'read'): Promise<void> {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ status })
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }

  // Edit message
  static async editMessage(messageId: string, newContent: string, mentions?: any[]): Promise<Message | null> {
    try {
      console.log('✏️ ChatService: Editing message:', { messageId, newContent, mentions });
      
      const { data, error } = await supabase
        .from('messages')
        .update({ 
          content: newContent,
          mentions: mentions || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        console.error('❌ ChatService: Error editing message:', error);
        throw error;
      }

      console.log('✅ ChatService: Message edited successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ ChatService: Error editing message:', error);
      return null;
    }
  }

  // Delete message
  static async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      console.log('🗑️ ChatService: Deleting message:', { messageId, userId });
      
      // בדיקה שהמשתמש הוא השולח של ההודעה
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('sender_id, channel_id')
        .eq('id', messageId)
        .single();

      if (fetchError) {
        console.error('❌ ChatService: Error fetching message for deletion:', fetchError);
        throw fetchError;
      }

      console.log('🔍 ChatService: Message data:', { 
        messageId, 
        userId, 
        messageSenderId: message.sender_id,
        types: {
          userIdType: typeof userId,
          senderIdType: typeof message.sender_id
        },
        areEqual: message.sender_id === userId,
        strictEqual: message.sender_id === userId
      });

      if (message.sender_id !== userId) {
        console.error('❌ ChatService: User is not the sender of the message');
        console.error('❌ ChatService: Comparison details:', {
          messageSenderId: message.sender_id,
          userId: userId,
          areEqual: message.sender_id === userId,
          messageSenderIdLength: message.sender_id?.length,
          userIdLength: userId?.length
        });
        throw new Error('לא ניתן למחוק הודעה שלא שלחת');
      }

      // מחיקת ההודעה
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (deleteError) {
        console.error('❌ ChatService: Error deleting message:', deleteError);
        throw deleteError;
      }

      console.log('✅ ChatService: Message deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ ChatService: Error deleting message:', error);
      return false;
    }
  }

  // Get channels list
  static async getChats(userId: string): Promise<Chat[]> {
    try {
      console.log('🔄 ChatService: Getting chats for user:', userId);
      
      // שלוף את כל ה-channel_id שהמשתמש חבר בהם
      const { data: memberRows, error: memberError } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', userId);

      if (memberError) {
        console.error('❌ ChatService: Error fetching channel members:', memberError);
        throw memberError;
      }
      
      let channelIds = memberRows?.map(row => row.channel_id) || [];
      console.log('👥 ChatService: User is member of channels:', channelIds);

      // אם אין ערוצים, נסה ליצור ערוץ ברירת מחדל
      if (channelIds.length === 0) {
        console.log('⚠️ ChatService: User is not a member of any channels, creating default channel...');
        try {
          await this.createDefaultChannel(userId);
          // נסה שוב לקבל את הערוצים
          const { data: retryMemberRows, error: retryMemberError } = await supabase
            .from('channel_members')
            .select('channel_id')
            .eq('user_id', userId);
          
          if (retryMemberError) {
            console.error('❌ ChatService: Error fetching channel members after creating default:', retryMemberError);
            return [];
          }
          
          channelIds = retryMemberRows?.map(row => row.channel_id) || [];
          console.log('🔄 ChatService: After creating default channel, user is member of:', channelIds);
        } catch (error) {
          console.error('❌ ChatService: Error creating default channel:', error);
          return [];
        }
      }

      // אם עדיין אין ערוצים, תחזיר מערך ריק
      if (channelIds.length === 0) {
        console.log('⚠️ ChatService: Still no channels found after creating default');
        return [];
      }

      // שלוף את כל הערוצים שהמשתמש חבר בהם
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .in('id', channelIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ ChatService: Error fetching channels:', error);
        throw error;
      }
      
      console.log('✅ ChatService: Successfully fetched channels:', data);
      return data || [];
    } catch (error) {
      console.error('❌ ChatService: Error fetching channels:', error);
      return [];
    }
  }

  // Create default general channel
  static async createDefaultChannel(userId: string): Promise<void> {
    try {
      console.log('🔄 ChatService: Creating default channel for user:', userId);
      
      // Create general channel
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .insert({
          name: 'כללי',
          description: 'ערוץ כללי לכל המשתמשים',
          created_by: userId,
          is_private: false,
          is_pinned: true
        })
        .select()
        .single();

      if (channelError) {
        console.error('❌ ChatService: Error creating default channel:', channelError);
        throw channelError;
      }

      console.log('✅ ChatService: Default channel created:', channel.id);

      // Add user to channel
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channel.id,
          user_id: userId
        });

      if (memberError) {
        console.error('❌ ChatService: Error adding user to default channel:', memberError);
        throw memberError;
      }

      console.log('✅ ChatService: User added to default channel');
    } catch (error) {
      console.error('❌ ChatService: Error creating default channel:', error);
    }
  }

  static async getChatList(userId: string): Promise<ChatListItem[]> {
    const chats = await this.getChats(userId);
    const result: ChatListItem[] = await Promise.all(
      chats.map(async (chat) => {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('*, sender:users!messages_sender_id_fkey(full_name)')
          .eq('channel_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        // Get unread count using the proper logic
        console.log('🔢 ChatService: Getting unread count for chat:', chat.id, 'user:', userId);
        const unreadCount = await this.getUnreadCount(chat.id, userId);
        console.log('🔢 ChatService: Unread count for chat:', chat.id, 'is:', unreadCount);
        
        // Check for unread mentions
        const hasUnreadMentions = await this.hasUnreadMentions(chat.id, userId);
        console.log('🔍 ChatService: Has unread mentions for chat:', chat.id, 'is:', hasUnreadMentions);
        
        return {
          id: chat.id,
          name: chat.name || 'קבוצה',
          avatar_url: (chat as any).image_url || '',
          last_message: lastMsg
            ? {
                content: lastMsg.content,
                timestamp: lastMsg.created_at,
                status: lastMsg.status || 'sent',
                sender_id: lastMsg.sender_id,
                sender_name: lastMsg.sender?.full_name || '',
              }
            : null,
          unread_count: unreadCount,
          is_group: true,
          is_pinned: chat.is_pinned || false,
          has_unread_mentions: hasUnreadMentions,
        };
      })
    );
    // מיון: קודם מוצמדים, אחר כך לפי זמן הודעה אחרונה
    result.sort((a, b) => {
      if (b.is_pinned !== a.is_pinned) return (b.is_pinned ? 1 : -1) - (a.is_pinned ? 1 : -1);
      return (b.last_message?.timestamp || '').localeCompare(a.last_message?.timestamp || '');
    });
    return result;
  }

  static async togglePinChat(chatId: string, isPinned: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('channels')
        .update({ is_pinned: !isPinned })
        .eq('id', chatId);
      
      if (error) {
        console.error('❌ Error toggling pin status:', error);
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Exception in togglePinChat:', error);
      throw error;
    }
  }

  static async addUserToDefaultChannels(userId: string) {
    console.log('🔄 ChatService: Adding user to default channels:', userId);
    
    try {
      const { data: channels, error: channelsError } = await supabase
        .from('channels')
        .select('id')
        .eq('is_private', false);
      
      if (channelsError) {
        console.error('❌ ChatService: Error fetching channels:', channelsError);
        return;
      }
      
      console.log('📋 ChatService: Found channels:', channels);
      
      if (channels && channels.length > 0) {
        for (const channel of channels) {
          console.log('➕ ChatService: Adding user to channel:', channel.id);
          
          // בדיקה אם המשתמש כבר חבר בערוץ
          const { data: existingMember, error: checkError } = await supabase
            .from('channel_members')
            .select('id')
            .eq('channel_id', channel.id)
            .eq('user_id', userId)
            .single();
            
          if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('❌ ChatService: Error checking existing membership for channel:', channel.id, checkError);
            continue;
          }
          
          if (existingMember) {
            console.log('ℹ️ ChatService: User is already a member of channel:', channel.id);
            continue;
          }
          
          // המשתמש לא חבר, נוסיף אותו
          const { error: insertError } = await supabase
            .from('channel_members')
            .insert({ 
              channel_id: channel.id, 
              user_id: userId 
            });
          
          if (insertError) {
            console.error('❌ ChatService: Error adding user to channel:', channel.id, insertError);
          } else {
            console.log('✅ ChatService: User added to channel:', channel.id);
          }
        }
      } else {
        console.log('⚠️ ChatService: No default channels found');
      }
    } catch (error) {
      console.error('❌ ChatService: Error in addUserToDefaultChannels:', error);
    }
  }

  // בדיקה אם משתמש חבר בערוץ
  static async isUserInChannel(userId: string, channelId: string): Promise<boolean> {
    try {
      console.log('🔍 ChatService: Checking if user is member of channel:', { userId, channelId });
      
      const { data, error } = await supabase
        .from('channel_members')
        .select('id')
        .eq('user_id', userId)
        .eq('channel_id', channelId)
        .single();
        
      if (error) {
        console.error('❌ ChatService: Error checking channel membership:', error);
        return false;
      }
      
      const isMember = !!data;
      console.log('👥 ChatService: Channel membership result:', { userId, channelId, isMember, data });
      return isMember;
    } catch (error) {
      console.error('❌ ChatService: Error checking channel membership:', error);
      return false;
    }
  }

  static async getChannelMembersCount(channelId: string): Promise<{ count: number | null; error: string | null }> {
    try {
      const { data, error, count } = await supabase
        .from('channel_members')
        .select('user_id', { count: 'exact' })
        .eq('channel_id', channelId);
      if (error) return { count: null, error: error.message };
      const finalCount = count ?? (data ? data.length : 0);
      console.log('membersCount:', finalCount);
      return { count: finalCount, error: null };
    } catch (error: any) {
      return { count: null, error: error.message };
    }
  }

  // פונקציות ריאקציות
  static async getMessageReactions(messageId: string): Promise<ReactionSummary[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_message_reactions', { message_id_param: messageId });

      if (error) {
        console.error('❌ Error getting message reactions:', error);
        return [];
      }

      // המרה לפורמט ReactionSummary
      if (data) {
        return data.map((item: any) => ({
          emoji: item.emoji,
          count: item.count,
          user_ids: [],
          user_names: []
        }));
      }

      return [];
    } catch (error) {
      console.error('❌ Error getting message reactions:', error);
      return [];
    }
  }

  static async toggleReaction(messageId: string, emoji: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('toggle_reaction', { 
          message_id_param: messageId, 
          emoji_param: emoji 
        });

      if (error) {
        console.error('❌ Error toggling reaction:', error);
        return false;
      }
      
      return data || false;
    } catch (error) {
      console.error('❌ Error toggling reaction:', error);
      return false;
    }
  }

  // פונקציה חדשה לקבלת פירוט מלא של ריאקציות
  static async getReactionDetails(messageId: string): Promise<ReactionDetail[]> {
    try {
      // שליפה נפרדת של ריאקציות ומשתמשים - כמו שעשינו עם חברי הקבוצה
      const { data: reactions, error: reactionsError } = await supabase
        .from('message_reactions')
        .select('emoji, user_id')
        .eq('message_id', messageId);

      if (reactionsError) {
        console.error('❌ Error getting reactions:', reactionsError);
        return [];
      }

      if (!reactions || reactions.length === 0) {
        return [];
      }

      // קבלת כל ה-user_ids הייחודיים
      const userIds = [...new Set(reactions.map(r => r.user_id))];

      // שליפה נפרדת של פרטי המשתמשים
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, profile_picture')
        .in('id', userIds);

      if (usersError) {
        console.error('❌ Error getting users:', usersError);
        // נחזיר רק את הריאקציות בלי שמות משתמשים
        return this.groupReactionsByEmoji(reactions);
      }

      // יצירת מפה של משתמשים לפי ID
      const usersMap = new Map(users?.map(u => [u.id, u]) || []);

      // Merge של הנתונים בצד הלקוח
      const reactionsWithUsers = reactions.map(reaction => ({
        ...reaction,
        user: usersMap.get(reaction.user_id) || { id: reaction.user_id, full_name: 'משתמש לא ידוע', profile_picture: null }
      }));

      // קיבוץ לפי emoji
      return this.groupReactionsByEmoji(reactionsWithUsers);
    } catch (error) {
      console.error('❌ Error getting reaction details:', error);
      return [];
    }
  }

  // פונקציה עזר לקיבוץ ריאקציות לפי emoji
  private static groupReactionsByEmoji(reactions: any[]): ReactionDetail[] {
    const grouped = new Map<string, any[]>();
    
    reactions.forEach(reaction => {
      if (!grouped.has(reaction.emoji)) {
        grouped.set(reaction.emoji, []);
      }
      grouped.get(reaction.emoji)!.push(reaction);
    });

    return Array.from(grouped.entries()).map(([emoji, reactions]) => ({
      emoji,
      count: reactions.length,
      user_ids: reactions.map(r => r.user_id),
      user_names: reactions.map(r => r.user?.full_name || 'משתמש לא ידוע')
    }));
  }

  // Mark messages as read for a user in a channel
  static async markMessagesAsRead(channelId: string, userId: string, lastReadMessageId: string): Promise<boolean> {
    try {
      console.log('📖 ChatService: Marking messages as read for user:', userId, 'in channel:', channelId);
      
      // First check if the message exists and get its timestamp
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('id, created_at')
        .eq('id', lastReadMessageId)
        .single();
      
      if (messageError || !messageData) {
        console.error('❌ Error fetching message data:', messageError);
        return false;
      }
      
      console.log('📖 ChatService: Marking message as read:', { messageId: lastReadMessageId, timestamp: messageData.created_at });
      
      // עדכון ב-user_channel_state (זה מה שgetUnreadCount קורא)
      const { error: stateError } = await supabase
        .from('user_channel_state')
        .upsert({
          user_id: userId,
          channel_id: channelId,
          last_read_message_id: lastReadMessageId,
          last_read_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,channel_id'
        });
      
      if (stateError) {
        console.error('❌ Error updating user_channel_state:', stateError);
        return false;
      }
      
      // גם עדכון ב-channel_members לתמיכה לאחור
      const { error: membersError } = await supabase
        .from('channel_members')
        .update({ last_read_message_id: lastReadMessageId })
        .eq('channel_id', channelId)
        .eq('user_id', userId);
      
      if (membersError) {
        console.warn('⚠️ Warning updating channel_members (backward compatibility):', membersError);
        // לא נכשל בגלל זה, זה רק תמיכה לאחור
      }
      
      console.log('✅ ChatService: Messages marked as read successfully in user_channel_state');
      return true;
    } catch (error) {
      console.error('❌ ChatService: Error in markMessagesAsRead:', error);
      return false;
    }
  }

  // Get last read message ID for a user in a channel
  static async getLastReadMessageId(channelId: string, userId: string): Promise<string | null> {
    try {
      console.log('📖 ChatService: Getting last read message ID for user:', userId, 'in channel:', channelId);
      
      const { data: userState, error } = await supabase
        .from('user_channel_state')
        .select('last_read_message_id')
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ Error fetching last read message ID:', error);
        return null;
      }
      
      const lastReadId = userState?.last_read_message_id || null;
      console.log('✅ ChatService: Last read message ID:', lastReadId);
      return lastReadId;
    } catch (error) {
      console.error('❌ ChatService: Error in getLastReadMessageId:', error);
      return null;
    }
  }

  // Get unread message count for a user in a channel
  static async getUnreadCount(channelId: string, userId: string): Promise<number> {
    try {
      console.log('🚀🚀🚀 ChatService: getUnreadCount CALLED! 🚀🚀🚀');
      console.log('🔢 ChatService: Getting unread count for user:', userId, 'in channel:', channelId);
      
      // Get user's last read message from the new user_channel_state table
      const { data: userState, error: userStateError } = await supabase
        .from('user_channel_state')
        .select('last_read_message_id')
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .single();
      
      if (userStateError && userStateError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ Error fetching user channel state:', userStateError);
        return 0;
      }
      
      if (!userState || !userState.last_read_message_id) {
        // User hasn't read any messages, count all messages not sent by user
        const { count, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', channelId)
          .neq('sender_id', userId);
        
        if (countError) {
          console.error('❌ Error counting messages:', countError);
          return 0;
        }
        
        console.log('🔢 ChatService: User has no read state, counting all messages not sent by user:', count);
        return count || 0;
      }
      
      // Get the timestamp of the last read message first
      const { data: lastReadMessage, error: msgError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', userState.last_read_message_id)
        .single();
      
      if (msgError) {
        console.error('❌ Error fetching last read message:', msgError);
        return 0;
      }
      
      // Count messages created after the last read message timestamp
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .gt('created_at', lastReadMessage.created_at)
        .neq('sender_id', userId);
      
      if (countError) {
        console.error('❌ Error counting unread messages:', countError);
        return 0;
      }
      
      console.log('✅ ChatService: Unread count fetched successfully:', count);
      return count || 0;
    } catch (error) {
      console.error('❌ ChatService: Error in getUnreadCount:', error);
      return 0;
    }
  }

  // Pin a message in a channel
  static async pinMessage(channelId: string, messageId: string, userId: string): Promise<boolean> {
    try {
      console.log('🔄 ChatService: Pinning message:', { channelId, messageId, userId });
      
      // Check if user is admin/owner
      const { data: memberData, error: memberError } = await supabase
        .from('channel_members')
        .select('role')
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .single();
      
      if (memberError || !memberData) {
        console.error('❌ ChatService: User not found in channel:', memberError);
        return false;
      }
      
      if (!['admin', 'owner'].includes(memberData.role)) {
        console.error('❌ ChatService: User not authorized to pin messages');
        return false;
      }
      
      // Check if message is already pinned
      const { data: existingPin, error: checkError } = await supabase
        .from('pinned_messages')
        .select('id')
        .eq('channel_id', channelId)
        .eq('message_id', messageId)
        .single();
      
      if (existingPin) {
        console.log('ℹ️ ChatService: Message already pinned');
        return true;
      }
      
      // Pin the message
      const { error: pinError } = await supabase
        .from('pinned_messages')
        .insert({
          channel_id: channelId,
          message_id: messageId,
          pinned_by: userId
        });
      
      if (pinError) {
        console.error('❌ ChatService: Error pinning message:', pinError);
        return false;
      }
      
      console.log('✅ ChatService: Message pinned successfully');
      return true;
    } catch (error) {
      console.error('❌ ChatService: Exception pinning message:', error);
      return false;
    }
  }

  // Unpin a message from a channel
  static async unpinMessage(channelId: string, messageId: string, userId: string): Promise<boolean> {
    try {
      console.log('🔄 ChatService: Unpinning message:', { channelId, messageId, userId });
      
      // Check if user is admin/owner
      const { data: memberData, error: memberError } = await supabase
        .from('channel_members')
        .select('role')
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .single();
      
      if (memberError || !memberData) {
        console.error('❌ ChatService: User not authorized to unpin messages');
        return false;
      }
      
      if (!['admin', 'owner'].includes(memberData.role)) {
        console.error('❌ ChatService: User not authorized to unpin messages');
        return false;
      }
      
      // Unpin the message
      const { error: unpinError } = await supabase
        .from('pinned_messages')
        .delete()
        .eq('channel_id', channelId)
        .eq('message_id', messageId);
      
      if (unpinError) {
        console.error('❌ ChatService: Error unpinning message:', unpinError);
        return false;
      }
      
      console.log('✅ ChatService: Message unpinned successfully');
      return true;
    } catch (error) {
      console.error('❌ ChatService: Exception unpinning message:', error);
      return false;
    }
  }

  // Get pinned messages for a channel
  static async getPinnedMessages(channelId: string): Promise<any[]> {
    try {
      console.log('🔄 ChatService: Getting pinned messages for channel:', channelId);
      
      const { data, error } = await supabase
        .rpc('get_pinned_messages', { channel_uuid: channelId });
      
      if (error) {
        console.error('❌ ChatService: Error getting pinned messages:', error);
        return [];
      }
      
      console.log('✅ ChatService: Pinned messages loaded:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('❌ ChatService: Exception getting pinned messages:', error);
      return [];
    }
  }

  // Check if a message is pinned
  static async isMessagePinned(channelId: string, messageId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('pinned_messages')
        .select('id')
        .eq('channel_id', channelId)
        .eq('message_id', messageId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ ChatService: Error checking if message is pinned:', error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error('❌ ChatService: Exception checking if message is pinned:', error);
      return false;
    }
  }

  // Check if user can pin messages in a channel
  static async canUserPinMessages(channelId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('channel_members')
        .select('role')
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('❌ ChatService: Error checking user pin permissions:', error);
        return false;
      }
      
      return data?.role === 'admin' || data?.role === 'owner';
    } catch (error) {
      console.error('❌ ChatService: Exception checking user pin permissions:', error);
      return false;
    }
  }

  // Mark message as viewed by user
  static async markMessageAsViewed(messageId: string, userId: string): Promise<boolean> {
    try {
      console.log('👁️ ChatService: Marking message as viewed:', { messageId, userId });
      
      const { data, error } = await supabase
        .rpc('add_user_to_viewed_by', { 
          message_uuid: messageId, 
          user_uuid: userId 
        });
      
      if (error) {
        console.error('❌ ChatService: Error marking message as viewed:', error);
        return false;
      }
      
      console.log('✅ ChatService: Message marked as viewed successfully');
      return true;
    } catch (error) {
      console.error('❌ ChatService: Exception marking message as viewed:', error);
      return false;
    }
  }

  // Get message viewers
  static async getMessageViewers(messageId: string): Promise<any[]> {
    try {
      console.log('👥 ChatService: Getting message viewers:', messageId);
      
      const { data, error } = await supabase
        .rpc('get_message_viewers', { message_uuid: messageId });
      
      if (error) {
        console.error('❌ ChatService: Error getting message viewers:', error);
        return [];
      }
      
      console.log('✅ ChatService: Message viewers loaded:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('❌ ChatService: Exception getting message viewers:', error);
      return [];
    }
  }

  // Star a message
  static async starMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      console.log('⭐ ChatService: Starring message:', { messageId, userId });
      
      // Get message details to get channel_id
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('channel_id')
        .eq('id', messageId)
        .single();
      
      if (messageError || !messageData) {
        console.error('❌ ChatService: Message not found:', messageError);
        return false;
      }
      
      // Check if user is member of the channel
      const { data: memberData, error: memberError } = await supabase
        .from('channel_members')
        .select('id')
        .eq('channel_id', messageData.channel_id)
        .eq('user_id', userId)
        .single();
      
      if (memberError || !memberData) {
        console.error('❌ ChatService: User not member of channel:', memberError);
        return false;
      }
      
      // Insert starred message
      const { error: insertError } = await supabase
        .from('starred_messages')
        .insert({
          user_id: userId,
          message_id: messageId,
          channel_id: messageData.channel_id
        });
      
      if (insertError) {
        console.error('❌ ChatService: Error starring message:', insertError);
        return false;
      }
      
      console.log('✅ ChatService: Message starred successfully');
      return true;
    } catch (error) {
      console.error('❌ ChatService: Exception starring message:', error);
      return false;
    }
  }

  // Unstar a message
  static async unstarMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      console.log('⭐ ChatService: Unstarring message:', { messageId, userId });
      
      const { error } = await supabase
        .from('starred_messages')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId);
      
      if (error) {
        console.error('❌ ChatService: Error unstarring message:', error);
        return false;
      }
      
      console.log('✅ ChatService: Message unstarred successfully');
      return true;
    } catch (error) {
      console.error('❌ ChatService: Exception unstarring message:', error);
      return false;
    }
  }

  // Check if a message is starred by a user
  static async isMessageStarred(messageId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('starred_messages')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ ChatService: Error checking if message is starred:', error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error('❌ ChatService: Exception checking if message is starred:', error);
      return false;
    }
  }

  // Get starred messages for a user
  static async getStarredMessages(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_starred_messages', { user_uuid: userId });
      
      if (error) {
        console.error('❌ ChatService: Error getting starred messages:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ ChatService: Exception getting starred messages:', error);
      return [];
    }
  }
}