// ============================================
// Chat Message Service
// ============================================
// ניהול הודעות - שליחה, עריכה, מחיקה, ריאקציות, קריאה
// ============================================

import { supabase } from '../../lib/supabase';
import { isOptimisticChatMessageId, isPersistedChatMessageId } from './chatOfflineQueue';
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
  isChatMessageTypeAllowedInDb,
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
  validateEmoji,
} from './chatValidation';
import { retryWithBackoff } from './chatRetry';
import { logger } from '../../utils/logger';

// ============================================
// שליחת הודעה חדשה
// ============================================

export async function sendChatMessage(
  inputRaw: SendChatMessageInput,
  userId: string
): Promise<{ data: ChatMessage | null; error: ChatError | null }> {
  try {
    const input = { ...inputRaw };

    // ============================================
    // Validation
    // ============================================
    
    const userIdValidation = validateUserId(userId);
    if (!userIdValidation.valid) {
      return { data: null, error: userIdValidation.error! };
    }

    const groupIdValidation = validateGroupId(input.group_id);
    if (!groupIdValidation.valid) {
      return { data: null, error: groupIdValidation.error! };
    }

    if (!isChatMessageTypeAllowedInDb(String(input.message_type ?? ''))) {
      return {
        data: null,
        error: {
          code: 'INVALID_MESSAGE_TYPE',
          message: `סוג הודעה לא נתמך: ${String(input.message_type)}`,
        },
      };
    }

    if (input.message_type === ChatMessageType.TRADE) {
      const raw = input.content?.trim();
      if (!raw) {
        return { data: null, error: { code: 'EMPTY_TRADE', message: 'טרייד ריק' } };
      }
      try {
        const parsed = JSON.parse(raw) as { trade?: { symbol?: string } };
        if (!parsed.trade || typeof parsed.trade.symbol !== 'string' || !parsed.trade.symbol.trim()) {
          return { data: null, error: { code: 'INVALID_TRADE', message: 'נתוני טרייד לא תקינים' } };
        }
      } catch {
        return { data: null, error: { code: 'INVALID_TRADE_JSON', message: 'פורמט טרייד לא תקין' } };
      }
    } else if (input.message_type === 'text' && input.content) {
      const contentValidation = validateMessageContent(input.content);
      if (!contentValidation.valid) {
        return { data: null, error: contentValidation.error! };
      }
      input.content = sanitizeMessageContent(input.content);
    }

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
      return { data: null, error: { code: 'NOT_MEMBER', message: 'אינך חבר בקבוצה זו' } };
    }

    // בדיקה אם רק אדמינים יכולים לשלוח
    const groupSettings = (membership as any).chat_groups?.settings;
    if (groupSettings?.onlyAdminsCanSend && membership.role !== 'admin') {
      return { data: null, error: { code: 'PERMISSION_DENIED', message: 'רק אדמינים יכולים לשלוח הודעות' } };
    }

    // ============================================
    // Send Message (with retry)
    // ============================================
    
    let messageData: ChatMessage | null = null;
    let messageError: any = null;

    try {
      const result = await retryWithBackoff(async () => {
        
        // Workaround: Store waveform data in content field for audio messages
        // Format: {"waveform":[...],"waveformData":[...],"duration":n,"caption":"..."}
        let contentToStore = input.content;
        if (input.message_type === 'audio' && input.metadata?.waveformData) {
          let caption = '';
          let durationFromContent: number | undefined;
          const rawContent = (input.content || '').trim();
          if (rawContent.startsWith('{')) {
            try {
              const parsed = JSON.parse(rawContent) as Record<string, unknown>;
              if (typeof parsed.caption === 'string') caption = parsed.caption;
              else if (
                parsed.waveform == null &&
                parsed.waveformData == null &&
                typeof parsed.duration !== 'number'
              ) {
                caption = rawContent;
              }
              if (typeof parsed.duration === 'number') durationFromContent = parsed.duration;
            } catch {
              caption = rawContent;
            }
          } else {
            caption = rawContent;
          }
          const wave = input.metadata.waveformData;
          const audioContent: Record<string, unknown> = {
            waveform: wave,
            waveformData: wave,
            caption,
          };
          const duration = input.media_duration ?? durationFromContent ?? input.metadata?.media_duration;
          if (typeof duration === 'number' && duration > 0) {
            audioContent.duration = duration;
          }
          contentToStore = JSON.stringify(audioContent);
        }
        
        // Workaround: Store media_urls in content field for MEDIA_GROUP messages
        // Format: {"media_urls": [...], "caption": "optional"}
        if (input.message_type === 'media_group' && input.media_urls) {
          const mediaGroupContent = {
            media_urls: input.media_urls,
            caption: input.content || '',
          };
          contentToStore = JSON.stringify(mediaGroupContent);
        }
        
        const { data: insertData, error: insertError } = await supabase
          .from('chat_messages')
          .insert({
            group_id: input.group_id,
            sender_id: userId,
            content: contentToStore,
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
            // Note: metadata column needs to be added to Supabase first
            // metadata: input.metadata || null,
            // M7: let the DB set created_at via DEFAULT now() so server clock is authoritative
            //
            // NOTE: input.client_message_id is intentionally NOT forwarded to
            // the insert yet. It travels with retries inside the client
            // offline queue (chatOfflineQueue.ts) so the UI can match the
            // server's eventual response back to the placeholder bubble.
            // Persistent server-side dedupe requires migration 018 +
            // refactoring to an idempotent upsert; tracked in DELIVERY_PLAN.
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
      
    } catch (error: any) {
      messageError = error;
    }

    if (messageError || !messageData) {
      logger.error('ChatMessage', 'Error sending message', messageError);
      const pgCode = messageError?.code;
      const isTypeConstraint =
        pgCode === '23514' &&
        String(messageError?.message ?? '').includes('valid_message_type');
      return {
        data: null,
        error: {
          code: isTypeConstraint ? 'MESSAGE_TYPE_DB_CONSTRAINT' : 'SEND_MESSAGE_ERROR',
          message:
            isTypeConstraint
              ? 'סוג ההודעה לא מעודכן בשרת. הרץ ב-Supabase את המיגרציה 010 (קובץ 010_chat_message_type_trade_and_media_group.sql) כדי לאפשר trade ו-media_group.'
              : messageError?.message || 'שגיאה בשליחת הודעה',
        },
      };
    }

    // ============================================
    // Load reply_to data if exists
    // ============================================
    
    if (messageData.reply_to_message_id && !messageData.reply_to) {
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
        }
      } catch (e) {
        logger.warn('ChatMessage', 'Failed to enrich reply_to data', e);
      }
    }

    // עדכון unread_count: טריגר DB (database/chat_realtime_and_triggers.sql) מעדכן אוטומטית.
    // אם הטריגר לא הור בפרויקט, הרץ את chat_realtime_and_triggers.sql ב-Supabase.

    return { data: messageData, error: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Unexpected error sending message', error);
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

    // Cursor-based pagination: use before_cursor for loading older messages
    if (params?.before) {
      query = query.lt('created_at', params.before);
    }
    if (params?.after) {
      query = query.gt('created_at', params.after);
    }

    // Fallback to offset for backward compatibility
    const offset = params?.offset || 0;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { data: null, error: { code: 'FETCH_MESSAGES_ERROR', message: error.message } };
    }

    const messageIds = data.map(m => m.id);

    // Run all supplementary queries in parallel instead of sequentially (~5x faster)
    const [reactionsResult, starredResult, readResult, deletionsResult] = await Promise.all([
      supabase
        .from('chat_message_reactions')
        .select(`*, user:users (id, display_name, profile_picture)`)
        .in('message_id', messageIds),
      supabase
        .from('chat_starred_messages')
        .select('message_id')
        .eq('user_id', userId)
        .in('message_id', messageIds),
      supabase
        .from('chat_message_reads')
        .select('message_id')
        .eq('user_id', userId)
        .in('message_id', messageIds),
      supabase
        .from('chat_message_personal_deletions')
        .select('message_id')
        .eq('user_id', userId)
        .in('message_id', messageIds),
    ]);

    const reactions = reactionsResult.data;
    const starredIds = new Set(starredResult.data?.map(s => s.message_id) || []);
    const readIds = new Set(readResult.data?.map(r => r.message_id) || []);
    const deletedIds = new Set(deletionsResult.data?.map(d => d.message_id) || []);

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
      
    }

    // המרת הנתונים לפורמט הנכון - סינון הודעות שנמחקו אישית
    const filteredMessages = data.filter((msg: any) => !deletedIds.has(msg.id));
    
    const messages: ChatMessage[] = filteredMessages
      .map((msg: any) => {
      const messageReactions = reactionsMap.get(msg.id) || [];
      
      // קיבוץ ריאקציות לפי אימוג'י
      const reactionGroups = messageReactions.reduce((acc, r) => {
        const user = Array.isArray(r.user) ? r.user[0] : r.user;
        if (!user?.id) return acc;

        const existing = acc.find((g: any) => g.emoji === r.emoji);
        if (existing) {
          existing.count++;
          existing.users.push({
            id: user.id,
            name: user.display_name,
            profile_picture: user.profile_picture,
          });
          if (r.user_id === userId) {
            existing.reacted_by_me = true;
          }
        } else {
          acc.push({
            emoji: r.emoji,
            count: 1,
            users: [{
              id: user.id,
              name: user.display_name,
              profile_picture: user.profile_picture,
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

      // Parse media_urls from content for MEDIA_GROUP messages
      let media_urls = undefined;
      let parsedContent = msg.content;
      if (msg.message_type === 'media_group' && msg.content) {
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed.media_urls) {
            media_urls = parsed.media_urls;
            parsedContent = parsed.caption || '';
          }
        } catch {
          // Not JSON - keep as is
        }
      }

      return {
        ...msg,
        content: parsedContent,
        media_urls,
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

    return { data: response, error: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Error fetching messages', error);
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

    // Validate and sanitize edited content (same as send)
    if (input.content) {
      const contentValidation = validateMessageContent(input.content);
      if (!contentValidation.valid) {
        return { data: null, error: contentValidation.error || { code: 'VALIDATION_ERROR', message: 'תוכן לא תקין' } };
      }
      input.content = sanitizeMessageContent(input.content);
    }

    const updatePayload: Record<string, any> = {
      content: input.content,
      is_edited: true,
      edited_at: new Date().toISOString(),
    };
    if (input.mentioned_users !== undefined) {
      updatePayload.mentioned_users = input.mentioned_users;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .update(updatePayload)
      .eq('id', input.message_id)
      .select()
      .single();

    if (error) {
      return { data: null, error: { code: 'EDIT_MESSAGE_ERROR', message: error.message } };
    }

    return { data, error: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Error editing message', error);
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
        logger.error('ChatMessage', 'Error deleting message for everyone', error);
        return { error: { code: 'DELETE_MESSAGE_ERROR', message: error.message } };
      }
    } else {
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
          logger.error('ChatMessage', 'Error creating personal deletion', deleteError);
          return { error: { code: 'DELETE_MESSAGE_ERROR', message: deleteError.message } };
        }
      }
    }

    return { error: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Error deleting message', error);
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
      return { errors };
    }

    return { errors: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Error forwarding message', error);
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
    const emojiValidation = validateEmoji(input.emoji);
    if (!emojiValidation.valid) {
      return { error: emojiValidation.error! };
    }

    const { error } = await supabase
      .from('chat_message_reactions')
      .insert({
        message_id: input.message_id,
        user_id: userId,
        emoji: input.emoji,
      });

    if (error) {
      // אם כבר קיים, זה OK
      if (error.code === '23505') return { error: null };
      logger.error('ChatMessage', 'Error adding reaction', error);
      return { error: { code: 'ADD_REACTION_ERROR', message: error.message } };
    }

    return { error: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Error adding reaction', error);
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
      logger.error('ChatMessage', 'Error removing reaction', error);
      return { error: { code: 'REMOVE_REACTION_ERROR', message: error.message } };
    }

    return { error: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Error removing reaction', error);
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
    const persistedIds = input.message_ids.filter(isPersistedChatMessageId);
    if (persistedIds.length === 0) {
      return { error: null };
    }

    // הוספת אישורי קריאה
    const reads = persistedIds.map(messageId => ({
      message_id: messageId,
      user_id: userId,
      group_id: input.group_id,
    }));

    const { error: readError } = await supabase
      .from('chat_message_reads')
      .upsert(reads, { onConflict: 'message_id,user_id' });

    if (readError) {
      logger.error('ChatMessage', 'Error marking messages as read', readError);
      return { error: { code: 'MARK_READ_ERROR', message: readError.message } };
    }

    // עדכון last_read בחברות
    if (persistedIds.length > 0) {
      const lastMessageId = persistedIds[persistedIds.length - 1];
      
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
        logger.error('ChatMessage', 'Error updating chat_group_members', updateError);
        return { error: { code: 'UPDATE_MEMBER_ERROR', message: updateError.message } };
      }
    }

    return { error: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Error marking messages as read', error);
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
    let messageIdToMark =
      lastMessageId && !isOptimisticChatMessageId(lastMessageId) && isPersistedChatMessageId(lastMessageId)
        ? lastMessageId
        : undefined;
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
      return { error: null };
    }

    const { error: rpcError } = await supabase.rpc('reset_unread_count', {
      p_group_id: groupId,
      p_user_id: userId,
      p_last_read_message_id: messageIdToMark,
    });
    
    if (rpcError) {
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
        logger.error('ChatMessage', 'Error marking chat as read', updateError);
        return { error: { code: 'UPDATE_MEMBER_ERROR', message: updateError.message } };
      }
    }

    return { error: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Error marking chat as read', error);
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
      if (error.code === '23505') return { error: null };
      logger.error('ChatMessage', 'Error starring message', error);
      return { error: { code: 'STAR_MESSAGE_ERROR', message: error.message } };
    }

    return { error: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Error starring message', error);
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
      logger.error('ChatMessage', 'Error unstarring message', error);
      return { error: { code: 'UNSTAR_MESSAGE_ERROR', message: error.message } };
    }

    return { error: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Error unstarring message', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// קבלת הודעות מועדפות
// ============================================

export async function getStarredMessages(
  userId: string,
  groupId?: string,
  options?: { limit?: number; offset?: number }
): Promise<{ data: ChatStarredMessage[] | null; error: ChatError | null }> {
  try {
    const limit = Math.min(options?.limit ?? 50, 100);
    const offset = options?.offset ?? 0;

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
          chat_groups!chat_messages_group_id_fkey (
            id,
            name,
            avatar_url
          )
        )
      `)
      .eq('user_id', userId)
      .order('starred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (groupId) {
      query = query.eq('group_id', groupId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('ChatMessage', 'Error fetching starred messages', error);
      return { data: null, error: { code: 'FETCH_STARRED_ERROR', message: error.message } };
    }

    return { data: data as any, error: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Error fetching starred messages', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
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
      logger.error('ChatMessage', 'Error fetching reaction details', error);
      return { data: null, error: { code: 'FETCH_REACTIONS_ERROR', message: error.message } };
    }

    // קיבוץ ריאקציות לפי אימוג'י
    const reactionGroups = reactions?.reduce((acc, r) => {
      const user = Array.isArray(r.user) ? r.user[0] : r.user;
      if (!user?.id) return acc;

      const existing = acc.find((g: any) => g.emoji === r.emoji);
      if (existing) {
        existing.count++;
        existing.users.push({
          id: user.id,
          name: user.display_name,
          profile_picture: user.profile_picture,
          reacted_at: r.created_at,
        });
      } else {
        acc.push({
          emoji: r.emoji,
          count: 1,
          users: [{
            id: user.id,
            name: user.display_name,
            profile_picture: user.profile_picture,
            reacted_at: r.created_at,
          }],
          reacted_by_me: false,
        });
      }
      return acc;
    }, [] as ChatReactionGroup[]) || [];

    return { data: reactionGroups, error: null };
  } catch (error: any) {
    logger.error('ChatMessage', 'Error fetching reaction details', error);
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

