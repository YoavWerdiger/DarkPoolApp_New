// ============================================
// Chat Message Service
// ============================================
// ניהול הודעות - שליחה, עריכה, מחיקה, ריאקציות, קריאה
// ============================================

import { supabase } from '../../lib/supabase';
import {
  ChatMessage,
  SendChatMessageInput,
  EditChatMessageInput,
  DeleteChatMessageInput,
  ForwardChatMessageInput,
  AddReactionInput,
  RemoveReactionInput,
  MarkMessagesAsReadInput,
  ChatMessagesResponse,
  ChatPaginationParams,
  ChatMessageFilters,
  ChatStarredMessage,
  ChatReactionGroup,
  ChatError,
  ChatMessageType,
} from '../../types/chat.types';

// ============================================
// שליחת הודעה חדשה
// ============================================

export async function sendChatMessage(
  input: SendChatMessageInput,
  userId: string
): Promise<{ data: ChatMessage | null; error: ChatError | null }> {
  try {
    // בדיקת הרשאות
    const { data: membership } = await supabase
      .from('chat_group_members')
      .select('role, chat_groups(settings)')
      .eq('group_id', input.group_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return { data: null, error: { code: 'NOT_MEMBER', message: 'אינך חבר בקבוצה זו' } };
    }

    // בדיקה אם רק אדמינים יכולים לשלוח
    const groupSettings = (membership as any).chat_groups?.settings;
    if (groupSettings?.onlyAdminsCanSend && membership.role !== 'admin') {
      return { data: null, error: { code: 'PERMISSION_DENIED', message: 'רק אדמינים יכולים לשלוח הודעות' } };
    }

    // יצירת ההודעה
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        group_id: input.group_id,
        sender_id: userId,
        content: input.content,
        message_type: input.message_type,
        media_url: input.media_url,
        media_thumbnail_url: input.media_thumbnail_url,
        media_type: input.media_type,
        media_size: input.media_size,
        media_duration: input.media_duration,
        media_width: input.media_width,
        media_height: input.media_height,
        media_file_name: input.media_file_name,
        reply_to_message_id: input.reply_to_message_id,
        mentioned_users: input.mentioned_users || [],
        is_silent: input.is_silent || false,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error sending message:', error);
      return { data: null, error: { code: 'SEND_MESSAGE_ERROR', message: error.message } };
    }

    // עדכון unread_count לכל החברים (חוץ מהשולח)
    await updateUnreadCounts(input.group_id, userId, input.mentioned_users);

    console.log('✅ Message sent successfully:', data.id);
    return { data, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error sending message:', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// קבלת הודעות מקבוצה
// ============================================

export async function getChatMessages(
  groupId: string,
  userId: string,
  params?: ChatPaginationParams,
  filters?: ChatMessageFilters
): Promise<{ data: ChatMessagesResponse | null; error: ChatError | null }> {
  try {
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    // בניית השאילתה הבסיסית
    let query = supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          profile_picture,
          is_online
        )
      `, { count: 'exact' })
      .eq('group_id', groupId)
      .eq('is_deleted', false);

    // פילטרים
    if (filters?.message_type && filters.message_type.length > 0) {
      query = query.in('message_type', filters.message_type);
    }
    if (filters?.sender_id) {
      query = query.eq('sender_id', filters.sender_id);
    }
    if (filters?.has_media) {
      query = query.not('media_url', 'is', null);
    }
    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    // מיון וקבלת הנתונים
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Error fetching messages:', error);
      return { data: null, error: { code: 'FETCH_MESSAGES_ERROR', message: error.message } };
    }

    // קבלת ריאקציות לכל ההודעות
    const messageIds = data.map(m => m.id);
    const { data: reactions } = await supabase
      .from('chat_message_reactions')
      .select(`
        *,
        user:users (
          id,
          display_name,
          profile_picture
        )
      `)
      .in('message_id', messageIds);

    // קבלת הודעות מועדפות של המשתמש
    const { data: starred } = await supabase
      .from('chat_starred_messages')
      .select('message_id')
      .eq('user_id', userId)
      .in('message_id', messageIds);

    const starredIds = new Set(starred?.map(s => s.message_id) || []);

    // קבלת אישורי קריאה של המשתמש
    const { data: readReceipts } = await supabase
      .from('chat_message_reads')
      .select('message_id')
      .eq('user_id', userId)
      .in('message_id', messageIds);

    const readIds = new Set(readReceipts?.map(r => r.message_id) || []);

    // ארגון הריאקציות לפי הודעה
    const reactionsMap = new Map<string, any[]>();
    reactions?.forEach(r => {
      if (!reactionsMap.has(r.message_id)) {
        reactionsMap.set(r.message_id, []);
      }
      reactionsMap.get(r.message_id)!.push(r);
    });

    // המרת הנתונים לפורמט הנכון
    const messages: ChatMessage[] = data.map((msg: any) => {
      const messageReactions = reactionsMap.get(msg.id) || [];
      
      // קיבוץ ריאקציות לפי אימוג'י
      const reactionGroups = messageReactions.reduce((acc, r) => {
        const existing = acc.find((g: any) => g.emoji === r.emoji);
        if (existing) {
          existing.count++;
          existing.users.push({
            id: r.user.id,
            name: r.user.display_name,
            profile_picture: r.user.profile_picture,
          });
          if (r.user_id === userId) {
            existing.reacted_by_me = true;
          }
        } else {
          acc.push({
            emoji: r.emoji,
            count: 1,
            users: [{
              id: r.user.id,
              name: r.user.display_name,
              profile_picture: r.user.profile_picture,
            }],
            reacted_by_me: r.user_id === userId,
          });
        }
        return acc;
      }, [] as any[]);

      return {
        ...msg,
        reactions: reactionGroups,
        is_starred_by_me: starredIds.has(msg.id),
        is_read_by_me: readIds.has(msg.id),
      };
    });

    const response: ChatMessagesResponse = {
      messages: messages.reverse(), // להחזיר לסדר כרונולוגי
      has_more: (count || 0) > offset + limit,
      next_offset: offset + limit,
      total_count: count || 0,
    };

    console.log(`✅ Fetched ${messages.length} messages from group ${groupId}`);
    return { data: response, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error fetching messages:', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// עריכת הודעה
// ============================================

export async function editChatMessage(
  input: EditChatMessageInput,
  userId: string
): Promise<{ data: ChatMessage | null; error: ChatError | null }> {
  try {
    // בדיקה שהמשתמש הוא השולח
    const { data: message } = await supabase
      .from('chat_messages')
      .select('sender_id, created_at')
      .eq('id', input.message_id)
      .single();

    if (!message) {
      return { data: null, error: { code: 'MESSAGE_NOT_FOUND', message: 'ההודעה לא נמצאה' } };
    }

    if (message.sender_id !== userId) {
      return { data: null, error: { code: 'PERMISSION_DENIED', message: 'ניתן לערוך רק הודעות שלך' } };
    }

    // בדיקת זמן - אפשר לערוך רק עד 48 שעות
    const messageTime = new Date(message.created_at).getTime();
    const now = Date.now();
    const hoursDiff = (now - messageTime) / (1000 * 60 * 60);
    
    if (hoursDiff > 48) {
      return { data: null, error: { code: 'EDIT_TIME_EXPIRED', message: 'ניתן לערוך הודעה רק עד 48 שעות' } };
    }

    // עדכון
    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        content: input.content,
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', input.message_id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error editing message:', error);
      return { data: null, error: { code: 'EDIT_MESSAGE_ERROR', message: error.message } };
    }

    console.log('✅ Message edited successfully:', input.message_id);
    return { data, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error editing message:', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// מחיקת הודעה
// ============================================

export async function deleteChatMessage(
  input: DeleteChatMessageInput,
  userId: string
): Promise<{ error: ChatError | null }> {
  try {
    // בדיקה שהמשתמש הוא השולח או אדמין
    const { data: message } = await supabase
      .from('chat_messages')
      .select('sender_id, group_id')
      .eq('id', input.message_id)
      .single();

    if (!message) {
      return { error: { code: 'MESSAGE_NOT_FOUND', message: 'ההודעה לא נמצאה' } };
    }

    const isSender = message.sender_id === userId;
    
    // אם רוצה למחוק לכולם, צריך להיות שולח
    if (input.delete_for_everyone && !isSender) {
      // בדיקה אם אדמין
      const { data: membership } = await supabase
        .from('chat_group_members')
        .select('role')
        .eq('group_id', message.group_id)
        .eq('user_id', userId)
        .single();

      if (membership?.role !== 'admin') {
        return { error: { code: 'PERMISSION_DENIED', message: 'רק השולח או אדמין יכולים למחוק את ההודעה' } };
      }
    }

    if (input.delete_for_everyone) {
      // מחיקה לכולם - סימון כמחוק
      const { error } = await supabase
        .from('chat_messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_for_everyone: true,
          content: null,
          media_url: null,
        })
        .eq('id', input.message_id);

      if (error) {
        console.error('❌ Error deleting message for everyone:', error);
        return { error: { code: 'DELETE_MESSAGE_ERROR', message: error.message } };
      }
    } else {
      // מחיקה רק למשתמש - נשמור רשומה של מי מחק
      // TODO: ליישם מחיקה אישית (צריך טבלה נוספת)
      // בינתיים נעשה מחיקה לכולם אם השולח
      if (isSender) {
        const { error } = await supabase
          .from('chat_messages')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_for_everyone: false,
          })
          .eq('id', input.message_id);

        if (error) {
          console.error('❌ Error deleting message:', error);
          return { error: { code: 'DELETE_MESSAGE_ERROR', message: error.message } };
        }
      }
    }

    console.log('✅ Message deleted successfully:', input.message_id);
    return { error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error deleting message:', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// העברת הודעה
// ============================================

export async function forwardChatMessage(
  input: ForwardChatMessageInput,
  userId: string
): Promise<{ errors: Map<string, ChatError> | null }> {
  try {
    // קבלת ההודעה המקורית
    const { data: originalMessage } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', input.message_id)
      .single();

    if (!originalMessage) {
      const error = { code: 'MESSAGE_NOT_FOUND', message: 'ההודעה לא נמצאה' };
      const errors = new Map<string, ChatError>();
      input.to_group_ids.forEach(groupId => errors.set(groupId, error));
      return { errors };
    }

    const errors = new Map<string, ChatError>();

    // העברה לכל קבוצה
    for (const groupId of input.to_group_ids) {
      // בדיקה שהמשתמש חבר בקבוצה
      const { data: membership } = await supabase
        .from('chat_group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      if (!membership) {
        errors.set(groupId, { code: 'NOT_MEMBER', message: 'אינך חבר בקבוצה זו' });
        continue;
      }

      // יצירת ההודעה המועברת
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          group_id: groupId,
          sender_id: userId,
          content: originalMessage.content,
          message_type: originalMessage.message_type,
          media_url: originalMessage.media_url,
          media_thumbnail_url: originalMessage.media_thumbnail_url,
          media_type: originalMessage.media_type,
          media_size: originalMessage.media_size,
          media_duration: originalMessage.media_duration,
          media_width: originalMessage.media_width,
          media_height: originalMessage.media_height,
          media_file_name: originalMessage.media_file_name,
          is_forwarded: true,
          forwarded_from_group_id: originalMessage.group_id,
          forwarded_from_message_id: originalMessage.id,
        });

      if (error) {
        errors.set(groupId, { code: 'FORWARD_ERROR', message: error.message });
      }
    }

    if (errors.size > 0) {
      console.log(`⚠️ Forwarded with ${errors.size} errors`);
      return { errors };
    }

    console.log('✅ Message forwarded successfully to all groups');
    return { errors: null };
  } catch (error: any) {
    console.error('❌ Unexpected error forwarding message:', error);
    const errors = new Map<string, ChatError>();
    input.to_group_ids.forEach(groupId => 
      errors.set(groupId, { code: 'UNEXPECTED_ERROR', message: error.message })
    );
    return { errors };
  }
}

// ============================================
// הוספת ריאקציה
// ============================================

export async function addReaction(
  input: AddReactionInput,
  userId: string
): Promise<{ error: ChatError | null }> {
  try {
    const { error } = await supabase
      .from('chat_message_reactions')
      .insert({
        message_id: input.message_id,
        user_id: userId,
        emoji: input.emoji,
      });

    if (error) {
      // אם כבר קיים, זה OK
      if (error.code === '23505') {
        console.log('✅ Reaction already exists');
        return { error: null };
      }
      console.error('❌ Error adding reaction:', error);
      return { error: { code: 'ADD_REACTION_ERROR', message: error.message } };
    }

    console.log('✅ Reaction added successfully');
    return { error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error adding reaction:', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// הסרת ריאקציה
// ============================================

export async function removeReaction(
  input: RemoveReactionInput,
  userId: string
): Promise<{ error: ChatError | null }> {
  try {
    const { error } = await supabase
      .from('chat_message_reactions')
      .delete()
      .eq('message_id', input.message_id)
      .eq('user_id', userId)
      .eq('emoji', input.emoji);

    if (error) {
      console.error('❌ Error removing reaction:', error);
      return { error: { code: 'REMOVE_REACTION_ERROR', message: error.message } };
    }

    console.log('✅ Reaction removed successfully');
    return { error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error removing reaction:', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// סימון הודעות כנקראו
// ============================================

export async function markMessagesAsRead(
  input: MarkMessagesAsReadInput,
  userId: string
): Promise<{ error: ChatError | null }> {
  try {
    // הוספת אישורי קריאה
    const reads = input.message_ids.map(messageId => ({
      message_id: messageId,
      user_id: userId,
      group_id: input.group_id,
    }));

    const { error: readError } = await supabase
      .from('chat_message_reads')
      .upsert(reads, { onConflict: 'message_id,user_id' });

    if (readError) {
      console.error('❌ Error marking messages as read:', readError);
      return { error: { code: 'MARK_READ_ERROR', message: readError.message } };
    }

    // עדכון last_read בחברות
    if (input.message_ids.length > 0) {
      const lastMessageId = input.message_ids[input.message_ids.length - 1];
      
      await supabase
        .from('chat_group_members')
        .update({
          last_read_message_id: lastMessageId,
          last_read_at: new Date().toISOString(),
          unread_count: 0, // אפס את המונה
        })
        .eq('group_id', input.group_id)
        .eq('user_id', userId);
    }

    console.log(`✅ Marked ${input.message_ids.length} messages as read`);
    return { error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error marking messages as read:', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// הוספת הודעה למועדפות
// ============================================

export async function starMessage(
  messageId: string,
  groupId: string,
  userId: string
): Promise<{ error: ChatError | null }> {
  try {
    const { error } = await supabase
      .from('chat_starred_messages')
      .insert({
        message_id: messageId,
        user_id: userId,
        group_id: groupId,
      });

    if (error) {
      if (error.code === '23505') {
        console.log('✅ Message already starred');
        return { error: null };
      }
      console.error('❌ Error starring message:', error);
      return { error: { code: 'STAR_MESSAGE_ERROR', message: error.message } };
    }

    console.log('✅ Message starred successfully');
    return { error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error starring message:', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// הסרת הודעה ממועדפות
// ============================================

export async function unstarMessage(
  messageId: string,
  userId: string
): Promise<{ error: ChatError | null }> {
  try {
    const { error } = await supabase
      .from('chat_starred_messages')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error unstarring message:', error);
      return { error: { code: 'UNSTAR_MESSAGE_ERROR', message: error.message } };
    }

    console.log('✅ Message unstarred successfully');
    return { error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error unstarring message:', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// קבלת הודעות מועדפות
// ============================================

export async function getStarredMessages(
  userId: string,
  groupId?: string
): Promise<{ data: ChatStarredMessage[] | null; error: ChatError | null }> {
  try {
    let query = supabase
      .from('chat_starred_messages')
      .select(`
        *,
        message:chat_messages (
          *,
          sender:users!chat_messages_sender_id_fkey (
            id,
            display_name,
            profile_picture
          ),
          chat_groups (
            id,
            name,
            avatar_url
          )
        )
      `)
      .eq('user_id', userId)
      .order('starred_at', { ascending: false });

    if (groupId) {
      query = query.eq('group_id', groupId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching starred messages:', error);
      return { data: null, error: { code: 'FETCH_STARRED_ERROR', message: error.message } };
    }

    console.log(`✅ Fetched ${data.length} starred messages`);
    return { data: data as any, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error fetching starred messages:', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// פונקציות עזר
// ============================================

async function updateUnreadCounts(
  groupId: string,
  senderId: string,
  mentionedUsers?: string[]
): Promise<void> {
  try {
    // עדכון unread_count לכל מי שלא השולח
    try {
      await supabase.rpc('increment_unread_count', {
        p_group_id: groupId,
        p_exclude_user_id: senderId,
      });
    } catch (rpcError) {
      // אם ה-RPC לא קיים, נעשה זאת ידנית
      await supabase
        .from('chat_group_members')
        .update({ unread_count: supabase.sql`unread_count + 1` } as any)
        .eq('group_id', groupId)
        .neq('user_id', senderId);
    }

    // עדכון mentioned_count למי שתויג
    if (mentionedUsers && mentionedUsers.length > 0) {
      await supabase
        .from('chat_group_members')
        .update({ mentioned_count: supabase.sql`mentioned_count + 1` } as any)
        .eq('group_id', groupId)
        .in('user_id', mentionedUsers);
    }
  } catch (error) {
    console.error('⚠️ Warning: Error updating unread counts:', error);
  }
}

// ============================================
// קבלת פרטי ריאקציות להודעה
// ============================================

export async function getMessageReactionDetails(
  messageId: string
): Promise<{ data: ChatReactionGroup[] | null; error: ChatError | null }> {
  try {
    const { data: reactions, error } = await supabase
      .from('chat_message_reactions')
      .select(`
        *,
        user:users (
          id,
          display_name,
          profile_picture
        )
      `)
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching reaction details:', error);
      return { data: null, error: { code: 'FETCH_REACTIONS_ERROR', message: error.message } };
    }

    // קיבוץ ריאקציות לפי אימוג'י
    const reactionGroups = reactions?.reduce((acc, r) => {
      const existing = acc.find((g: any) => g.emoji === r.emoji);
      if (existing) {
        existing.count++;
        existing.users.push({
          id: r.user.id,
          name: r.user.display_name,
          profile_picture: r.user.profile_picture,
        });
      } else {
        acc.push({
          emoji: r.emoji,
          count: 1,
          users: [{
            id: r.user.id,
            name: r.user.display_name,
            profile_picture: r.user.profile_picture,
          }],
          reacted_by_me: false, // לא רלוונטי כאן
        });
      }
      return acc;
    }, [] as ChatReactionGroup[]) || [];

    return { data: reactionGroups, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error fetching reaction details:', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// Export
// ============================================

export const chatMessageService = {
  sendChatMessage,
  getChatMessages,
  editChatMessage,
  deleteChatMessage,
  forwardChatMessage,
  addReaction,
  removeReaction,
  getMessageReactionDetails,
  markMessagesAsRead,
  starMessage,
  unstarMessage,
  getStarredMessages,
};

