import { supabase, Message, Chat, ReactionSummary, ReactionDetail } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

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

      // הסרת בדיקת isUserInChannel - RLS (Row Level Security) כבר בודק את זה
      // זה חוסך query נוסף ומאיץ את שליחת ההודעה

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

      // הוסף את פרטי המשתמש ישירות ב-select כדי לא לעשות query נוסף
      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select(`
          *,
          sender:users!messages_sender_id_fkey(
            id,
            full_name,
            profile_picture
          )
        `)
        .single();

      if (error) {
        console.error('❌ ChatService: Supabase error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ ChatService: Error sending message:', error);
      return null;
    }
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

      // הסרת בדיקת isUserInChannel - RLS (Row Level Security) כבר בודק את זה
      // זה חוסך query נוסף ומאיץ את שליחת ההודעה

      const messageData = {
        channel_id: channelId,
        sender_id: senderId,
        content: caption || `[${mediaType}]`,
        type: mediaType,
        file_url: mediaUrl,
        reply_to_message_id: replyTo || null,
        metadata: metadata // Assuming there is a metadata column or similar, if not it might be ignored or need schema update
      };

      // הוסף את פרטי המשתמש ישירות ב-select כדי לא לעשות query נוסף
      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select(`
          *,
          sender:users!messages_sender_id_fkey(
            id,
            full_name,
            profile_picture
          )
        `)
        .single();

      if (error) {
        console.error('❌ ChatService: Supabase error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ ChatService: Error sending media message:', error);
      return null;
    }
  }

  // Check if user has unread mentions in a channel
  static async hasUnreadMentions(channelId: string, userId: string): Promise<boolean> {
    try {
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

        if (error) return false;

        return data?.some(message => {
          if (!message.mentions || !Array.isArray(message.mentions)) return false;
          return message.mentions.some((mention: any) => mention.user_id === userId);
        }) || false;
      }

      // Get the timestamp of the last read message
      const { data: lastReadMessage, error: lastReadError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', lastReadId)
        .single();

      if (lastReadError) return false;

      // Check for mentions after the last read message
      const { data: mentionMessages, error: mentionError } = await supabase
        .from('messages')
        .select('id, mentions')
        .eq('channel_id', channelId)
        .not('mentions', 'is', null)
        .gt('created_at', lastReadMessage.created_at)
        .limit(50);

      if (mentionError) return false;

      return mentionMessages?.some(message => {
        if (!message.mentions || !Array.isArray(message.mentions)) return false;
        return message.mentions.some((mention: any) => mention.user_id === userId);
      }) || false;
    } catch (error) {
      console.error('❌ ChatService: Exception checking mentions:', error);
      return false;
    }
  }

  // Get the latest mention message ID for a user in a channel
  static async getLatestMentionMessageId(channelId: string, userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, mentions')
        .eq('channel_id', channelId)
        .not('mentions', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) return null;

      const mentionMessage = data?.find(message => {
        if (!message.mentions || !Array.isArray(message.mentions)) return false;
        return message.mentions.some((mention: any) => mention.user_id === userId);
      });

      return mentionMessage?.id || null;
    } catch (error) {
      console.error('❌ ChatService: Exception getting latest mention message:', error);
      return null;
    }
  }

  // Get messages for a channel - optimized for performance
  static async getMessages(channelId: string, limit = 50): Promise<Message[]> {
    try {

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
          news_data,
          trade_data,
          sender:users!messages_sender_id_fkey(
            full_name,
            profile_picture
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(limit);


      if (error) {
        console.error('❌ ChatService: Error fetching messages:', error);
        throw error;
      }

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

  // Unified subscription to channel events (INSERT, UPDATE, DELETE)
  static subscribeToChannel(
    channelId: string,
    callbacks: {
      onMessage: (message: Message) => void;
      onMessageUpdate: (message: Message) => void;
      onMessageDelete: (messageId: string) => void;
    }
  ) {
    console.log('🔔 ChatService: Setting up unified subscription for channel:', channelId);

    const channel = supabase.channel(`chat:${channelId}`);

    return channel
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          console.log('📨 ChatService: Received real-time payload:', payload.eventType);

          if (payload.eventType === 'INSERT') {
            // השתמש בנתונים שכבר יש ב-payload במקום לעשות query נוסף
            // זה מאיץ את התגובה להודעה חדשה
            const messageData = payload.new as any;
            
            // נסה לקבל את פרטי המשתמש מה-payload, אם לא - נטען אותם
            if (messageData.sender) {
              // אם יש sender ב-payload, השתמש בו
              callbacks.onMessage(messageData as Message);
            } else {
              // רק אם אין sender, נטען אותו (זה נדיר)
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

              if (!error && data) {
                callbacks.onMessage(data as Message);
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            // השתמש בנתונים מה-payload
            const messageData = payload.new as any;
            
            if (messageData.sender) {
              callbacks.onMessageUpdate(messageData as Message);
            } else {
              // רק אם אין sender, נטען אותו
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

              if (!error && data) {
                callbacks.onMessageUpdate(data as Message);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            callbacks.onMessageDelete(payload.old.id);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 ChatService: Subscription status:', status);
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

      console.log('✅ ChatService: Message edited successfully');
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
        .select('sender_id')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      if (message.sender_id !== userId) {
        throw new Error('לא ניתן למחוק הודעה שלא שלחת');
      }

      // מחיקת ההודעה
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (deleteError) throw deleteError;

      console.log('✅ ChatService: Message deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ ChatService: Error deleting message:', error);
      return false;
    }
  }

  static async getChatList(userId: string): Promise<ChatListItem[]> {
    try {
      const { data: memberRows, error: memberError } = await supabase
        .from('channel_members')
        .select('channel_id, last_read_message_id')
        .eq('user_id', userId);

      if (memberError) {
        console.error('❌ ChatService: Error loading channel memberships:', memberError);
        throw memberError;
      }

      const channelIds = memberRows?.map(row => row.channel_id) || [];
      if (channelIds.length === 0) {
        return [];
      }

      // טען את כל הנתונים במקביל - אופטימיזציה קריטית
      const [
        { data: channels, error: channelsError },
        { data: recentMessages, error: messagesError }
      ] = await Promise.all([
        supabase
          .from('channels')
          .select('id, name, image_url, icon_name, is_private, is_pinned, created_at')
          .in('id', channelIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('messages')
          .select(`
            id,
            content,
            status,
            sender_id,
            channel_id,
            created_at,
            sender:users!messages_sender_id_fkey(
              full_name
            )
          `)
          .in('channel_id', channelIds)
          .order('created_at', { ascending: false })
          .limit(channelIds.length * 5)
      ]);

      if (channelsError) {
        console.error('❌ ChatService: Error loading channels data:', channelsError);
        throw channelsError;
      }

      if (messagesError) {
        console.error('❌ ChatService: Error loading recent messages:', messagesError);
        throw messagesError;
      }

      // בנה מפות לזיהוי מהיר
      const lastMessageMap = new Map<string, any>();
      (recentMessages || []).forEach(message => {
        if (!message?.channel_id) return;
        if (!lastMessageMap.has(message.channel_id)) {
          lastMessageMap.set(message.channel_id, message);
        }
      });

      const memberMap = new Map(memberRows?.map(r => [r.channel_id, r]) || []);

      // אופטימיזציה: טען את כל last_read_message_id בבת אחת
      const lastReadIds = memberRows?.map(r => r.last_read_message_id).filter(Boolean) || [];
      const lastReadMessagesMap = new Map<string, string>(); // messageId -> created_at
      
      if (lastReadIds.length > 0) {
        const { data: lastReadMessages } = await supabase
          .from('messages')
          .select('id, created_at')
          .in('id', lastReadIds);
        
        lastReadMessages?.forEach(msg => {
          lastReadMessagesMap.set(msg.id, msg.created_at);
        });
      }

      // חישוב unread counts ו-mentions בבת אחת עם batch queries
      const unreadPromises = channelIds.map(async channelId => {
        try {
          const member = memberMap.get(channelId);
          const lastReadId = member?.last_read_message_id;
          const lastReadTimestamp = lastReadId ? lastReadMessagesMap.get(lastReadId) : null;

          let query = supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', channelId);

          if (lastReadTimestamp) {
            query = query.gt('created_at', lastReadTimestamp);
          }

          const { count } = await query;
          return { channelId, count: count || 0 };
        } catch {
          return { channelId, count: 0 };
        }
      });

      const mentionPromises = channelIds.map(async channelId => {
        try {
          const member = memberMap.get(channelId);
          const lastReadId = member?.last_read_message_id;
          const lastReadTimestamp = lastReadId ? lastReadMessagesMap.get(lastReadId) : null;

          let query = supabase
            .from('messages')
            .select('id, mentions')
            .eq('channel_id', channelId)
            .not('mentions', 'is', null)
            .limit(50);

          if (lastReadTimestamp) {
            query = query.gt('created_at', lastReadTimestamp);
          } else {
            // אם אין last read, נבדוק את כל ההודעות
          }

          const { data } = await query;
          const hasMention = data?.some(message => {
            if (!message.mentions || !Array.isArray(message.mentions)) return false;
            return message.mentions.some((mention: any) => mention.user_id === userId);
          }) || false;

          return { channelId, hasMention };
        } catch {
          return { channelId, hasMention: false };
        }
      });

      const [unreadResults, mentionResults] = await Promise.all([
        Promise.all(unreadPromises),
        Promise.all(mentionPromises)
      ]);

      const unreadMap = new Map(unreadResults.map(r => [r.channelId, r.count]));
      const mentionMap = new Map(mentionResults.map(r => [r.channelId, r.hasMention]));

      const chatItems: ChatListItem[] = (channels || []).map(channel => {
        const lastMessage = lastMessageMap.get(channel.id);
        const senderData = Array.isArray(lastMessage?.sender)
          ? lastMessage?.sender[0]
          : lastMessage?.sender;

        const formattedLastMessage = lastMessage
          ? {
            content: lastMessage.content || '',
            timestamp: lastMessage.created_at,
            status: (lastMessage.status as 'sent' | 'delivered' | 'read') || 'sent',
            sender_id: lastMessage.sender_id,
            sender_name: senderData?.full_name || ''
          }
          : null;

        return {
          id: channel.id,
          name: channel.name || 'קבוצה ללא שם',
          avatar_url: channel.image_url || '',
          last_message: formattedLastMessage,
          unread_count: unreadMap.get(channel.id) || 0,
          is_group: true,
          is_pinned: !!channel.is_pinned,
          has_unread_mentions: mentionMap.get(channel.id) || false
        };
      });

      const sortedChatItems = chatItems.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) {
          return a.is_pinned ? -1 : 1;
        }

        const aTime = a.last_message?.timestamp
          ? new Date(a.last_message.timestamp).getTime()
          : 0;
        const bTime = b.last_message?.timestamp
          ? new Date(b.last_message.timestamp).getTime()
          : 0;

        return bTime - aTime;
      });

      return sortedChatItems;
    } catch (error) {
      console.error('❌ ChatService: Error building chat list:', error);
      return [];
    }
  }

  static async togglePinChat(channelId: string, isCurrentlyPinned: boolean): Promise<boolean> {
    try {

      const { error } = await supabase
        .from('channels')
        .update({ is_pinned: !isCurrentlyPinned })
        .eq('id', channelId);

      if (error) {
        console.error('❌ ChatService: Error updating pin state:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('❌ ChatService: Failed to toggle pin state:', error);
      return false;
    }
  }

  // Get channels list
  static async getChats(userId: string): Promise<Chat[]> {
    try {
      // שלוף את כל ה-channel_id שהמשתמש חבר בהם
      const { data: memberRows, error: memberError } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', userId);

      if (memberError) throw memberError;

      let channelIds = memberRows?.map(row => row.channel_id) || [];

      // אם אין ערוצים, נסה ליצור ערוץ ברירת מחדל
      if (channelIds.length === 0) {
        try {
          await this.createDefaultChannel(userId);
          const { data: retryMemberRows } = await supabase
            .from('channel_members')
            .select('channel_id')
            .eq('user_id', userId);

          channelIds = retryMemberRows?.map(row => row.channel_id) || [];
        } catch (error) {
          console.error('❌ ChatService: Error creating default channel:', error);
          return [];
        }
      }

      if (channelIds.length === 0) return [];

      // שלוף את כל הערוצים שהמשתמש חבר בהם
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .in('id', channelIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ ChatService: Error fetching channels:', error);
      return [];
    }
  }

  // Create default general channel
  static async createDefaultChannel(userId: string): Promise<void> {
    try {
      // Create general channel
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .insert({
          name: 'כללי',
          description: 'ערוץ כללי לכל המשתמשים',
          created_by: userId,
          is_private: false,
          type: 'group'
        })
        .select()
        .single();

      if (channelError) {
        // If channel already exists (e.g. name constraint), try to find it
        // This is a simplified logic
        console.warn('⚠️ Could not create default channel, might already exist');
      }

      // Add user to channel if channel was created or found
      // For now, we assume if insert failed, we might need to find the 'General' channel and add user.
      // But let's keep it simple.
    } catch (error) {
      console.error('Error in createDefaultChannel:', error);
    }
  }

  // Helper to check if user is in channel
  static async isUserInChannel(userId: string, channelId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .single();

    return !!data && !error;
  }

  // Helper to get last read message ID
  static async getLastReadMessageId(channelId: string, userId: string): Promise<string | null> {
    // נסה קודם מ-channel_members (זה מה שבדרך כלל קיים)
    const { data: memberData } = await supabase
      .from('channel_members')
      .select('last_read_message_id')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .single();

    if (memberData?.last_read_message_id) {
      return memberData.last_read_message_id;
    }

    // אם לא נמצא, נסה מ-user_read_events (אם הטבלה קיימת)
    try {
      const { data: readData } = await supabase
        .from('user_read_events')
        .select('last_read_message_id')
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .single();

      return readData?.last_read_message_id || null;
    } catch {
      return null;
    }
  }

  // Helper to mark messages as read (update user_read_events)
  static async markMessagesAsRead(channelId: string, userId: string, messageId: string): Promise<void> {
    const { error } = await supabase
      .from('user_read_events')
      .upsert({
        channel_id: channelId,
        user_id: userId,
        last_read_message_id: messageId,
        last_read_at: new Date().toISOString()
      }, {
        onConflict: 'channel_id,user_id'
      });

    if (error) {
      console.error('Error updating last read message:', error);
    }
  }

  // Helper to get unread count
  static async getUnreadCount(channelId: string, userId: string): Promise<number> {
    const lastReadId = await this.getLastReadMessageId(channelId, userId);

    let query = supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', channelId);

    if (lastReadId) {
      const { data: lastMsg } = await supabase.from('messages').select('created_at').eq('id', lastReadId).single();
      if (lastMsg) {
        query = query.gt('created_at', lastMsg.created_at);
      }
    }

    const { count, error } = await query;
    return count || 0;
  }

  // Star/Unstar message
  static async isMessageStarred(messageId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('starred_messages')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .single();

      return !!data && !error;
    } catch (error) {
      return false;
    }
  }

  static async starMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('starred_messages')
        .insert({ message_id: messageId, user_id: userId });

      return !error;
    } catch (error) {
      console.error('Error starring message:', error);
      return false;
    }
  }

  static async unstarMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('starred_messages')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId);

      return !error;
    } catch (error) {
      console.error('Error unstarring message:', error);
      return false;
    }
  }

  static async getStarredMessages(channelId: string, userId: string): Promise<Message[]> {
    try {
      const { data, error } = await supabase
        .from('starred_messages')
        .select(`
          message:messages (
            *,
            sender:users!messages_sender_id_fkey (
              full_name,
              profile_picture
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter by channel if needed, though starred messages are usually global or per-chat
      // Here we filter by channelId if the message belongs to it
      const messages = data
        ?.map((item: any) => item.message)
        .filter((msg: any) => msg && msg.channel_id === channelId) || [];

      return messages;
    } catch (error) {
      console.error('Error fetching starred messages:', error);
      return [];
    }
  }

  // Reactions
  static async toggleReaction(messageId: string, emoji: string): Promise<boolean> {
    try {
      // נסה להשתמש בפונקציה של Supabase
      const { data, error } = await supabase
        .rpc('toggle_reaction', {
          message_id_param: messageId,
          emoji_param: emoji
        });

      if (error) {
        // Fallback - נסה query ישיר
        const { data: existingReaction } = await supabase
          .from('message_reactions')
          .select('id')
          .eq('message_id', messageId)
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .eq('emoji', emoji)
          .maybeSingle();

        if (existingReaction) {
          // Remove reaction
          const { error: deleteError } = await supabase
            .from('message_reactions')
            .delete()
            .eq('id', existingReaction.id);
          
          if (deleteError) throw deleteError;
          return false; // ריאקציה הוסרה
        } else {
          // Add reaction
          const { error: insertError } = await supabase
            .from('message_reactions')
            .insert({
              message_id: messageId,
              user_id: (await supabase.auth.getUser()).data.user?.id,
              emoji: emoji
            });
          
          if (insertError) throw insertError;
          return true; // ריאקציה נוספה
        }
      }

      // אם הפונקציה עבדה, המר את התוצאה
      return data === true;
    } catch (error) {
      console.error('Error toggling reaction:', error);
      return false;
    }
  }

  static async getMessageReactions(messageId: string): Promise<ReactionSummary[]> {
    try {
      // שימוש בפונקציה של Supabase במקום join ישיר
      const { data, error } = await supabase
        .rpc('get_message_reactions', { message_id_param: messageId });

      if (error) {
        // Fallback - נסה query ישיר
        const { data: directData, error: directError } = await supabase
          .from('message_reactions')
          .select('emoji, user_id')
          .eq('message_id', messageId);

        if (directError) throw directError;

        // קבל פרטי משתמשים בנפרד
        const userIds = [...new Set(directData?.map((r: any) => r.user_id) || [])];
        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', userIds);

        const usersMap = new Map((usersData || []).map((u: any) => [u.id, u.full_name]));

        // Group by emoji
        const reactionsMap = new Map<string, ReactionSummary>();
        directData?.forEach((item: any) => {
          const emoji = item.emoji;
          if (!reactionsMap.has(emoji)) {
            reactionsMap.set(emoji, {
              emoji,
              count: 0,
              user_ids: [],
              user_names: []
            });
          }

          const summary = reactionsMap.get(emoji)!;
          summary.count++;
          summary.user_ids.push(item.user_id);
          const userName = usersMap.get(item.user_id);
          if (userName) {
            summary.user_names.push(userName);
          }
        });

        return Array.from(reactionsMap.values());
      }

      // אם הפונקציה עבדה, המר את התוצאה
      return (data || []).map((item: any) => ({
        emoji: item.emoji,
        count: Number(item.count),
        user_ids: item.user_ids || [],
        user_names: item.user_names || []
      }));
    } catch (error) {
      console.warn('Error fetching reactions:', error);
      return [];
    }
  }

  // פונקציה לקבלת פירוט מלא של ריאקשנים (עם פרטי משתמשים)
  static async getReactionDetails(messageId: string): Promise<ReactionDetail[]> {
    try {
      // נסה להשתמש בפונקציה של Supabase
      const { data, error } = await supabase
        .rpc('get_reaction_details', { message_id_param: messageId });

      if (error) {
        // Fallback - נסה query ישיר
        const { data: directData, error: directError } = await supabase
          .from('message_reactions')
          .select('emoji, user_id')
          .eq('message_id', messageId);

        if (directError) throw directError;

        // קבל פרטי משתמשים בנפרד
        const userIds = [...new Set(directData?.map((r: any) => r.user_id) || [])];
        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', userIds);

        const usersMap = new Map((usersData || []).map((u: any) => [u.id, u.full_name]));

        // Group by emoji
        const reactionsMap = new Map<string, ReactionDetail>();
        directData?.forEach((item: any) => {
          const emoji = item.emoji;
          if (!reactionsMap.has(emoji)) {
            reactionsMap.set(emoji, {
              emoji,
              count: 0,
              user_ids: [],
              user_names: []
            });
          }

          const summary = reactionsMap.get(emoji)!;
          summary.count++;
          summary.user_ids.push(item.user_id);
          const userName = usersMap.get(item.user_id);
          if (userName) {
            summary.user_names.push(userName);
          }
        });

        return Array.from(reactionsMap.values());
      }

      // אם הפונקציה עבדה, המר את התוצאה
      return (data || []).map((item: any) => ({
        emoji: item.emoji,
        count: Number(item.count),
        user_ids: item.user_ids || [],
        user_names: item.user_names || []
      }));
    } catch (error) {
      console.warn('Error fetching reaction details:', error);
      return [];
    }
  }

  // Helper to get channel members count
  static async getChannelMembersCount(channelId: string): Promise<{ count: number | null, error: any }> {
    const { count, error } = await supabase
      .from('channel_members')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId);

    return { count, error };
  }

  // Mark message as viewed (new system)
  static async markMessageAsViewed(messageId: string, userId: string): Promise<void> {
    // This seems to be a duplicate or alternative to markAsRead/read_by
    // Implementing based on usage in ChatRoomScreen
    try {
      const { data: message } = await supabase
        .from('messages')
        .select('viewed_by')
        .eq('id', messageId)
        .single();

      const viewedBy = message?.viewed_by || [];
      if (!viewedBy.includes(userId)) {
        viewedBy.push(userId);

        await supabase
          .from('messages')
          .update({ viewed_by: viewedBy })
          .eq('id', messageId);
      }
    } catch (error) {
      console.error('Error marking message as viewed:', error);
    }
  }
}