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
import {
  checkRateLimit,
  validateMessageContent,
  validateMediaType,
  validateMediaSize,
  validateFileName,
  validateGroupId,
  validateUserId,
  sanitizeMessageContent,
  sanitizeFileName,
} from './chatValidation';
import { retryWithBackoff } from './chatRetry';

// ============================================
// שליחת הודעה חדשה
// ============================================

export async function sendChatMessage(
  input: SendChatMessageInput,
  userId: string
): Promise<{ data: ChatMessage | null; error: ChatError | null }> {
  // #region agent log
  const logData7 = {location:'chatMessageService.ts:47',message:'sendChatMessage called',data:{userId,groupId:input.group_id,content:input.content?.substring(0,50),messageType:input.message_type,replyTo:input.reply_to_message_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
  console.log('🔍 DEBUG [A]:', JSON.stringify(logData7));
  fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData7)}).catch(()=>{});
  // #endregion
  try {
    // ============================================
    // Validation
    // ============================================
    
    // Validate user ID
    const userIdValidation = validateUserId(userId);
    if (!userIdValidation.valid) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chatMessageService.ts:54',message:'User ID validation failed',data:{error:userIdValidation.error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return { data: null, error: userIdValidation.error! };
    }

    // Validate group ID
    const groupIdValidation = validateGroupId(input.group_id);
    if (!groupIdValidation.valid) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chatMessageService.ts:60',message:'Group ID validation failed',data:{error:groupIdValidation.error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return { data: null, error: groupIdValidation.error! };
    }

    // Validate message content (if text message)
    if (input.message_type === 'text' && input.content) {
      const contentValidation = validateMessageContent(input.content);
      if (!contentValidation.valid) {
        return { data: null, error: contentValidation.error! };
      }
      // Sanitize content
      input.content = sanitizeMessageContent(input.content);
    }

    // Validate media (if media message)
    const isMediaMessage = ['image', 'video', 'audio', 'document'].includes(input.message_type);
    if (isMediaMessage) {
      if (input.media_type) {
        const mediaTypeValidation = validateMediaType(input.media_type, input.message_type);
        if (!mediaTypeValidation.valid) {
          return { data: null, error: mediaTypeValidation.error! };
        }
      }

      if (input.media_size) {
        const mediaSizeValidation = validateMediaSize(input.media_size);
        if (!mediaSizeValidation.valid) {
          return { data: null, error: mediaSizeValidation.error! };
        }
      }

      if (input.media_file_name) {
        const fileNameValidation = validateFileName(input.media_file_name);
        if (!fileNameValidation.valid) {
          return { data: null, error: fileNameValidation.error! };
        }
        // Sanitize file name
        input.media_file_name = sanitizeFileName(input.media_file_name);
      }
    }

    // ============================================
    // Rate Limiting
    // ============================================
    
    const rateLimitCheck = checkRateLimit(userId, isMediaMessage);
    if (!rateLimitCheck.allowed) {
      return { data: null, error: rateLimitCheck.error! };
    }

    // ============================================
    // Permissions Check
    // ============================================
    
    const { data: membership } = await supabase
      .from('chat_group_members')
      .select('role, chat_groups(settings)')
      .eq('group_id', input.group_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chatMessageService.ts:121',message:'User not member of group',data:{userId,groupId:input.group_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return { data: null, error: { code: 'NOT_MEMBER', message: 'אינך חבר בקבוצה זו' } };
    }

    // בדיקה אם רק אדמינים יכולים לשלוח
    const groupSettings = (membership as any).chat_groups?.settings;
    if (groupSettings?.onlyAdminsCanSend && membership.role !== 'admin') {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chatMessageService.ts:127',message:'Permission denied - only admins',data:{userId,groupId:input.group_id,role:membership.role},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return { data: null, error: { code: 'PERMISSION_DENIED', message: 'רק אדמינים יכולים לשלוח הודעות' } };
    }

    // ============================================
    // Send Message (with retry)
    // ============================================
    
    let messageData: ChatMessage | null = null;
    let messageError: any = null;

    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chatMessageService.ts:138',message:'Inserting message to DB',data:{groupId:input.group_id,userId,hasReplyTo:!!input.reply_to_message_id,replyToId:input.reply_to_message_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const result = await retryWithBackoff(async () => {
        // Ensure created_at is set explicitly to current UTC time
        const now = new Date().toISOString();
        const { data: insertData, error: insertError } = await supabase
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
            created_at: now, // Set explicitly to ensure correct time
          })
          .select(`
            *,
            sender:users!chat_messages_sender_id_fkey (
              id,
              display_name,
              profile_picture,
              is_online
            )
          `)
          .single();

        if (insertError) {
          throw insertError;
        }

        return insertData;
      }, {
        maxRetries: 3,
        retryableErrors: ['PGRST301', 'PGRST302', 'NETWORK_ERROR', 'TIMEOUT'],
      });

      messageData = result as ChatMessage;
      
      // Ensure sender data is properly formatted (handle array case from Supabase)
      if (messageData.sender && Array.isArray(messageData.sender)) {
        messageData.sender = messageData.sender[0];
      }
      
      // #region agent log
      const logData8 = {location:'chatMessageService.ts:171',message:'Message inserted successfully',data:{messageId:messageData.id,hasReplyTo:!!messageData.reply_to_message_id,replyToId:messageData.reply_to_message_id,hasReplyToData:!!messageData.reply_to,hasSender:!!messageData.sender},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
      console.log('🔍 DEBUG [A]:', JSON.stringify(logData8));
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData8)}).catch(()=>{});
      // #endregion
    } catch (error: any) {
      messageError = error;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chatMessageService.ts:173',message:'Error inserting message',data:{error:error.message,errorCode:error.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }

    if (messageError || !messageData) {
      console.error('❌ Error sending message:', messageError);
      return { 
        data: null, 
        error: { 
          code: 'SEND_MESSAGE_ERROR', 
          message: messageError?.message || 'שגיאה בשליחת הודעה' 
        } 
      };
    }

    // ============================================
    // Load reply_to data if exists
    // ============================================
    
    if (messageData.reply_to_message_id && !messageData.reply_to) {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chatMessageService.ts:203',message:'Loading reply_to data',data:{messageId:messageData.id,replyToId:messageData.reply_to_message_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
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
          .eq('id', messageData.reply_to_message_id)
          .single();
        
        if (replyToMessage) {
          const sender = Array.isArray(replyToMessage.sender) 
            ? replyToMessage.sender[0] 
            : replyToMessage.sender;
          messageData = {
            ...messageData,
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
          fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chatMessageService.ts:228',message:'Loaded reply_to data successfully',data:{messageId:messageData.id,hasReplyTo:!!messageData.reply_to},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          console.log('📎 Loaded reply_to data for message:', messageData.id);
        }
      } catch (error: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chatMessageService.ts:231',message:'Error loading reply_to data',data:{error:error.message,messageId:messageData.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.error('❌ Error loading reply_to data:', error);
        // Continue without reply_to data - not critical
      }
    }

    // ============================================
    // Update Unread Counts
    // ============================================
    
    // Don't await - fire and forget to not block the response
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chatMessageService.ts:192',message:'Updating unread counts',data:{groupId:input.group_id,userId,hasMentions:!!input.mentioned_users?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    updateUnreadCounts(input.group_id, userId, input.mentioned_users).catch(err => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chatMessageService.ts:194',message:'Error updating unread counts',data:{error:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.error('❌ Error updating unread counts:', err);
    });

    return { data: messageData, error: null };
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

    // קבלת הודעות שנמחקו אישית על ידי המשתמש
    const { data: personalDeletions, error: personalDeletionsError } = await supabase
      .from('chat_message_personal_deletions')
      .select('message_id')
      .eq('user_id', userId)
      .in('message_id', messageIds);

    if (personalDeletionsError) {
      console.error('❌ Error fetching personal deletions:', personalDeletionsError);
    }

    const deletedIds = new Set(personalDeletions?.map(d => d.message_id) || []);
    console.log(`🗑️ Personal deletions for user ${userId.slice(0, 8)}...: ${deletedIds.size} messages`);

    // ארגון הריאקציות לפי הודעה
    const reactionsMap = new Map<string, any[]>();
    reactions?.forEach(r => {
      if (!reactionsMap.has(r.message_id)) {
        reactionsMap.set(r.message_id, []);
      }
      reactionsMap.get(r.message_id)!.push(r);
    });

    // קבלת הודעות המקור עבור reply_to
    const replyToMessageIds = data
      .filter((msg: any) => msg.reply_to_message_id)
      .map((msg: any) => msg.reply_to_message_id);
    
    let replyToMessagesMap = new Map<string, any>();
    if (replyToMessageIds.length > 0) {
      const { data: replyToMessages } = await supabase
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
        .in('id', replyToMessageIds);
      
      replyToMessages?.forEach((msg: any) => {
        const sender = Array.isArray(msg.sender) ? msg.sender[0] : msg.sender;
        replyToMessagesMap.set(msg.id, {
          message_id: msg.id,
          content: msg.content,
          message_type: msg.message_type,
          media_url: msg.media_url,
          sender_id: msg.sender_id,
          sender_name: sender?.display_name || 'משתמש',
        });
      });
      
      console.log(`📎 Loaded ${replyToMessagesMap.size} reply-to messages`);
    }

    // המרת הנתונים לפורמט הנכון - סינון הודעות שנמחקו אישית
    const totalMessages = data.length;
    const filteredMessages = data.filter((msg: any) => !deletedIds.has(msg.id));
    console.log(`🗑️ Filtered messages: ${totalMessages} total, ${filteredMessages.length} after filtering personal deletions`);
    
    const messages: ChatMessage[] = filteredMessages
      .map((msg: any) => {
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

      // מילוי reply_to אם יש reply_to_message_id
      const replyTo = msg.reply_to_message_id 
        ? replyToMessagesMap.get(msg.reply_to_message_id)
        : undefined;

      return {
        ...msg,
        reply_to: replyTo,
        reactions: reactionGroups,
        is_starred_by_me: starredIds.has(msg.id),
        is_read_by_me: readIds.has(msg.id),
      };
    });

    const response: ChatMessagesResponse = {
      messages: messages, // נשאיר בסדר יורד (חדשה לישנה) עבור FlatList inverted
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
      // מחיקה אישית - נשמור בטבלת מחיקות אישיות
      // נשתמש ב-group_id שכבר יש לנו מה-message שקיבלנו קודם
      console.log('🗑️ Personal deletion - message.group_id:', message.group_id);
      
      // הוספה לטבלת מחיקות אישיות
      const { data: deletionData, error: deleteError } = await supabase
        .from('chat_message_personal_deletions')
        .insert({
          message_id: input.message_id,
          user_id: userId,
          group_id: message.group_id,
        })
        .select()
        .single();

      if (deleteError) {
        // אם כבר קיים, זה OK (idempotent)
        if (deleteError.code !== '23505') {
          console.error('❌ Error creating personal deletion:', deleteError);
          console.error('❌ Delete error details:', JSON.stringify(deleteError, null, 2));
          return { error: { code: 'DELETE_MESSAGE_ERROR', message: deleteError.message } };
        } else {
          console.log('✅ Personal deletion already exists (idempotent)');
        }
      } else {
        console.log('✅ Personal deletion created successfully:', deletionData);
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
    console.log('📖 markMessagesAsRead called:', { 
      groupId: input.group_id, 
      userId, 
      messageCount: input.message_ids.length 
    });

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
      // לא נכשיל את כל התהליך, נמשיך לעדכן את chat_group_members
    }

    // עדכון last_read בחברות
    if (input.message_ids.length > 0) {
      const lastMessageId = input.message_ids[input.message_ids.length - 1];
      
      const { error: updateError } = await supabase
        .from('chat_group_members')
        .update({
          last_read_message_id: lastMessageId,
          last_read_at: new Date().toISOString(),
          unread_count: 0, // אפס את המונה
        })
        .eq('group_id', input.group_id)
        .eq('user_id', userId);

      if (updateError) {
        console.error('❌ Error updating chat_group_members:', updateError);
        return { error: { code: 'UPDATE_MEMBER_ERROR', message: updateError.message } };
      }
      
      console.log('✅ Updated last_read_message_id:', lastMessageId, 'and reset unread_count to 0');
    }

    console.log(`✅ Marked ${input.message_ids.length} messages as read`);
    return { error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error marking messages as read:', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// סימון צ'אט כנקרא (עדכון last_read ואיפוס unread)
// ============================================

export async function markChatAsRead(
  groupId: string,
  userId: string,
  lastMessageId?: string
): Promise<{ error: ChatError | null }> {
  try {
    console.log('📖 markChatAsRead called:', { groupId, userId, lastMessageId });

    // אם לא נשלח lastMessageId, נמצא את ההודעה האחרונה
    let messageIdToMark = lastMessageId;
    if (!messageIdToMark) {
      const { data: lastMessage } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('group_id', groupId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      messageIdToMark = lastMessage?.id;
    }

    if (!messageIdToMark) {
      console.log('📖 No messages in chat, nothing to mark as read');
      return { error: null };
    }

    // עדכון chat_group_members - ננסה קודם עם RPC function שמעקף RLS
    try {
      const { error: rpcError } = await supabase.rpc('reset_unread_count', {
        p_group_id: groupId,
        p_user_id: userId,
        p_last_read_message_id: messageIdToMark,
      });
      
      if (rpcError) {
        console.warn('⚠️ RPC reset_unread_count failed, trying direct update:', rpcError);
        // Fallback: עדכון ישיר
        const { error: updateError } = await supabase
          .from('chat_group_members')
          .update({
            last_read_message_id: messageIdToMark,
            last_read_at: new Date().toISOString(),
            unread_count: 0,
            mentioned_count: 0,
          })
          .eq('group_id', groupId)
          .eq('user_id', userId);

        if (updateError) {
          console.error('❌ Error updating chat_group_members:', updateError);
          console.error('❌ Update error details:', JSON.stringify(updateError, null, 2));
          console.error('❌ Update params:', { groupId, userId, lastMessageId: messageIdToMark });
          return { error: { code: 'UPDATE_MEMBER_ERROR', message: updateError.message } };
        }
      } else {
        console.log('✅ Successfully reset unread count using RPC function');
      }
    } catch (rpcException: any) {
      console.error('❌ Exception calling RPC reset_unread_count:', rpcException);
      // Fallback: עדכון ישיר
      const { error: updateError } = await supabase
        .from('chat_group_members')
        .update({
          last_read_message_id: messageIdToMark,
          last_read_at: new Date().toISOString(),
          unread_count: 0,
          mentioned_count: 0,
        })
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('❌ Error updating chat_group_members:', updateError);
        console.error('❌ Update error details:', JSON.stringify(updateError, null, 2));
        return { error: { code: 'UPDATE_MEMBER_ERROR', message: updateError.message } };
      }
    }

    console.log('✅ Chat marked as read:', { groupId, userId, lastMessageId: messageIdToMark });
    return { error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error marking chat as read:', error);
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
    console.log('📊 updateUnreadCounts called:', { groupId, senderId });
    
    // ננסה להשתמש ב-RPC function שמעקף את ה-RLS
    // זה יעבוד גם אם יש בעיה ב-RLS policies
    try {
      console.log('📊 Attempting to call RPC increment_unread_count...');
      console.log('📊 RPC params:', { p_group_id: groupId, p_exclude_user_id: senderId });
      const { data: rpcData, error: rpcError } = await supabase.rpc('increment_unread_count', {
        p_group_id: groupId,
        p_exclude_user_id: senderId,
      });
      
      console.log('📊 RPC response:', { data: rpcData, error: rpcError });
      
      if (rpcError) {
        console.warn('⚠️ RPC increment_unread_count failed, trying manual update:', rpcError);
        console.warn('⚠️ RPC error code:', rpcError.code);
        console.warn('⚠️ RPC error message:', rpcError.message);
        console.warn('⚠️ RPC error details:', JSON.stringify(rpcError, null, 2));
        // Fallback: עדכון ידני
        const { data: members, error: fetchError } = await supabase
          .from('chat_group_members')
          .select('user_id, unread_count')
          .eq('group_id', groupId)
          .neq('user_id', senderId);

        if (fetchError) {
          console.error('❌ Error fetching members for unread count update:', fetchError);
          console.error('❌ Fetch error details:', JSON.stringify(fetchError, null, 2));
          return;
        }

        console.log('📊 Members to update (excluding sender):', members?.length || 0);
        if (members && members.length > 0) {
          members.forEach(m => {
            console.log(`📊   - Member ${m.user_id.slice(0, 8)}...: current unread_count=${m.unread_count || 0}`);
          });
          
          // עדכון כל משתמש בנפרד
          for (const member of members) {
            const newCount = (member.unread_count || 0) + 1;
            console.log(`📊 Attempting to update unread_count for ${member.user_id.slice(0, 8)}... from ${member.unread_count || 0} to ${newCount}`);
            
            const { error: updateError } = await supabase
              .from('chat_group_members')
              .update({ unread_count: newCount })
              .eq('group_id', groupId)
              .eq('user_id', member.user_id);
              
            if (updateError) {
              console.error('❌ Error updating unread count for user:', member.user_id, updateError);
              console.error('❌ Update error details:', JSON.stringify(updateError, null, 2));
            } else {
              console.log('✅ Updated unread count for user:', member.user_id.slice(0, 8) + '...', 'new count:', newCount);
            }
          }
        } else {
          console.warn('⚠️ No members found to update unread count for group:', groupId);
          console.warn('⚠️ This could mean:');
          console.warn('   1. The sender is the only member in the group');
          console.warn('   2. RLS policies are blocking access to other members');
          console.warn('   3. Other members are not actually in the group');
          
          // בוא נבדוק כמה חברים יש בקבוצה בכלל
          const { data: allMembers, error: allMembersError } = await supabase
            .from('chat_group_members')
            .select('user_id, unread_count')
            .eq('group_id', groupId);
          
          if (allMembersError) {
            console.error('❌ Error fetching all members:', allMembersError);
          } else {
            console.log('📊 All members in group (including sender):', allMembers?.length || 0);
            allMembers?.forEach(m => {
              const isSender = m.user_id === senderId;
              console.log(`📊   - ${isSender ? '[SENDER]' : ''} Member ${m.user_id.slice(0, 8)}...: unread_count=${m.unread_count || 0}`);
            });
          }
        }
      } else {
        console.log('✅ Successfully updated unread counts using RPC function');
        console.log('📊 RPC updated', rpcData || 0, 'members');
        // אם ה-RPC הצליח, אין צורך ב-fallback
        return;
      }
    } catch (rpcException: any) {
      console.error('❌ Exception calling RPC increment_unread_count:', rpcException);
      // Fallback: עדכון ידני
      const { data: members, error: fetchError } = await supabase
        .from('chat_group_members')
        .select('user_id, unread_count')
        .eq('group_id', groupId)
        .neq('user_id', senderId);

      if (fetchError) {
        console.error('❌ Error fetching members for unread count update:', fetchError);
        return;
      }

      if (members && members.length > 0) {
        for (const member of members) {
          const newCount = (member.unread_count || 0) + 1;
          const { error: updateError } = await supabase
            .from('chat_group_members')
            .update({ unread_count: newCount })
            .eq('group_id', groupId)
            .eq('user_id', member.user_id);
            
          if (updateError) {
            console.error('❌ Error updating unread count for user:', member.user_id, updateError);
          } else {
            console.log('✅ Updated unread count for user:', member.user_id.slice(0, 8) + '...', 'new count:', newCount);
          }
        }
      }
    }

    // עדכון mentioned_count למי שתויג
    if (mentionedUsers && mentionedUsers.length > 0) {
      // קריאת הערכים הנוכחיים
      const { data: mentionedMembers, error: fetchMentionedError } = await supabase
        .from('chat_group_members')
        .select('user_id, mentioned_count')
        .eq('group_id', groupId)
        .in('user_id', mentionedUsers);

      if (fetchMentionedError) {
        console.error('❌ Error fetching mentioned members for count update:', fetchMentionedError);
        return;
      }

      if (mentionedMembers && mentionedMembers.length > 0) {
        // עדכון כל משתמש בנפרד
        const updatePromises = mentionedMembers.map(member =>
          supabase
            .from('chat_group_members')
            .update({ mentioned_count: (member.mentioned_count || 0) + 1 })
            .eq('group_id', groupId)
            .eq('user_id', member.user_id)
        );

        const results = await Promise.all(updatePromises);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
          console.error('❌ Some mentioned count updates failed:', errors);
        }
      }
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
  markChatAsRead,
  starMessage,
  unstarMessage,
  getStarredMessages,
};

