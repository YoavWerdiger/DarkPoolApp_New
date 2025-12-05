// ============================================
// Chat Realtime Service
// ============================================
// ניהול חיבורי Real-time - הודעות, ריאקציות, typing, online status
// ============================================

import { supabase } from '../../lib/supabase';
import {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import {
  ChatMessage,
  ChatReaction,
  ChatTypingIndicator,
  ChatRealtimeEventType,
  SetTypingStatusInput,
  ChatError,
} from '../../types/chat.types';

// ============================================
// Types למאזינים
// ============================================

type MessageListener = (message: ChatMessage, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void;
type ReactionListener = (reaction: ChatReaction, eventType: 'INSERT' | 'DELETE') => void;
type TypingListener = (indicators: ChatTypingIndicator[]) => void;
type MemberListener = (data: any, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void;
type GroupListener = (data: any, eventType: 'UPDATE') => void;

// ============================================
// ניהול Channels
// ============================================

const activeChannels = new Map<string, RealtimeChannel>();
const typingTimers = new Map<string, NodeJS.Timeout>();

// ============================================
// הרשמה לקבוצה
// ============================================

export function subscribeToGroup(
  groupId: string,
  userId: string,
  listeners: {
    onMessage?: MessageListener;
    onReaction?: ReactionListener;
    onTyping?: TypingListener;
    onMember?: MemberListener;
    onGroup?: GroupListener;
  }
): RealtimeChannel {
  console.log(`🔌 Subscribing to group: ${groupId}`);

  // אם כבר יש channel פעיל, נסגור אותו
  if (activeChannels.has(groupId)) {
    unsubscribeFromGroup(groupId);
  }

  // יצירת channel חדש
  const channel = supabase.channel(`group:${groupId}`, {
    config: {
      broadcast: { self: false }, // לא לקבל את ההודעות שלי
      presence: { key: userId },
    },
  });

  // מאזין להודעות חדשות/מעודכנות
  if (listeners.onMessage) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `group_id=eq.${groupId}`,
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        console.log('📩 Message event:', payload.eventType, payload.new?.id);
        
        if (payload.eventType === 'INSERT') {
          // הודעה חדשה
          listeners.onMessage!(payload.new as ChatMessage, 'INSERT');
        } else if (payload.eventType === 'UPDATE') {
          // הודעה עודכנה (נערכה או נמחקה)
          listeners.onMessage!(payload.new as ChatMessage, 'UPDATE');
        } else if (payload.eventType === 'DELETE') {
          // הודעה נמחקה
          listeners.onMessage!(payload.old as ChatMessage, 'DELETE');
        }
      }
    );
  }

  // מאזין לריאקציות
  if (listeners.onReaction) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_message_reactions',
        filter: `message_id=in.(select id from chat_messages where group_id='${groupId}')`,
      },
      async (payload: RealtimePostgresChangesPayload<any>) => {
        console.log('👍 Reaction event:', payload.eventType);
        
        if (payload.eventType === 'INSERT') {
          // טעינת פרטי המשתמש
          const reaction = payload.new as ChatReaction;
          if (reaction.user_id) {
            const { data: userData } = await supabase
              .from('users')
              .select('id, display_name, profile_picture')
              .eq('id', reaction.user_id)
              .single();
            
            if (userData) {
              reaction.user = {
                id: userData.id,
                display_name: userData.display_name,
                profile_picture: userData.profile_picture,
              };
            }
          }
          listeners.onReaction!(reaction, 'INSERT');
        } else if (payload.eventType === 'DELETE') {
          listeners.onReaction!(payload.old as ChatReaction, 'DELETE');
        }
      }
    );
  }

  // מאזין לאינדיקטורי הקלדה
  if (listeners.onTyping) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_typing_indicators',
        filter: `group_id=eq.${groupId}`,
      },
      async () => {
        // קבלת כל המקלידים הנוכחיים
        const { data } = await supabase
          .from('chat_typing_indicators')
          .select(`
            *,
            user:users (
              id,
              display_name
            )
          `)
          .eq('group_id', groupId)
          .neq('user_id', userId); // לא להראות את עצמי

        if (data) {
          console.log('⌨️ Typing indicators updated:', data.length);
          listeners.onTyping!(data as any);
        }
      }
    );
  }

  // מאזין לשינויים בחברים
  if (listeners.onMember) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_group_members',
        filter: `group_id=eq.${groupId}`,
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        console.log('👥 Member event:', payload.eventType);
        
        if (payload.eventType === 'INSERT') {
          listeners.onMember!(payload.new, 'INSERT');
        } else if (payload.eventType === 'UPDATE') {
          listeners.onMember!(payload.new, 'UPDATE');
        } else if (payload.eventType === 'DELETE') {
          listeners.onMember!(payload.old, 'DELETE');
        }
      }
    );
  }

  // מאזין לשינויים בפרטי הקבוצה
  if (listeners.onGroup) {
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_groups',
        filter: `id=eq.${groupId}`,
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        console.log('📝 Group updated');
        listeners.onGroup!(payload.new, 'UPDATE');
      }
    );
  }

  // הרשמה ל-channel
  channel.subscribe((status) => {
    console.log(`📡 Channel status for ${groupId}:`, status);
    
    if (status === 'SUBSCRIBED') {
      console.log(`✅ Successfully subscribed to group ${groupId}`);
    } else if (status === 'CHANNEL_ERROR') {
      console.error(`❌ Error subscribing to group ${groupId}`);
    }
  });

  // שמירת ה-channel
  activeChannels.set(groupId, channel);

  return channel;
}

// ============================================
// ביטול הרשמה מקבוצה
// ============================================

export function unsubscribeFromGroup(groupId: string): void {
  console.log(`🔌 Unsubscribing from group: ${groupId}`);

  const channel = activeChannels.get(groupId);
  if (channel) {
    channel.unsubscribe();
    activeChannels.delete(groupId);
  }

  // ניקוי טיימר typing
  const timer = typingTimers.get(groupId);
  if (timer) {
    clearTimeout(timer);
    typingTimers.delete(groupId);
  }
}

// ============================================
// ביטול כל ההרשמות
// ============================================

export function unsubscribeAll(): void {
  console.log('🔌 Unsubscribing from all groups');

  activeChannels.forEach((channel, groupId) => {
    channel.unsubscribe();
  });

  activeChannels.clear();

  typingTimers.forEach((timer) => {
    clearTimeout(timer);
  });

  typingTimers.clear();
}

// ============================================
// סטטוס הקלדה
// ============================================

export async function setTypingStatus(
  input: SetTypingStatusInput,
  userId: string
): Promise<{ error: ChatError | null }> {
  try {
    if (input.is_typing) {
      // התחלת הקלדה
      console.log(`⌨️ User ${userId} started typing in group ${input.group_id}`);

      // הוספה/עדכון ב-DB
      const { error } = await supabase
        .from('chat_typing_indicators')
        .upsert({
          group_id: input.group_id,
          user_id: userId,
          started_typing_at: new Date().toISOString(),
        }, {
          onConflict: 'group_id,user_id',
        });

      if (error) {
        console.error('❌ Error setting typing status:', error);
        return { error: { code: 'TYPING_ERROR', message: error.message } };
      }

      // הגדרת טיימר אוטומטי להסרה אחרי 10 שניות
      const existingTimer = typingTimers.get(`${input.group_id}-${userId}`);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        setTypingStatus({ ...input, is_typing: false }, userId);
      }, 10000);

      typingTimers.set(`${input.group_id}-${userId}`, timer);

    } else {
      // סיום הקלדה
      console.log(`⌨️ User ${userId} stopped typing in group ${input.group_id}`);

      // הסרה מ-DB
      const { error } = await supabase
        .from('chat_typing_indicators')
        .delete()
        .eq('group_id', input.group_id)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error removing typing status:', error);
        return { error: { code: 'TYPING_ERROR', message: error.message } };
      }

      // ניקוי טיימר
      const timer = typingTimers.get(`${input.group_id}-${userId}`);
      if (timer) {
        clearTimeout(timer);
        typingTimers.delete(`${input.group_id}-${userId}`);
      }
    }

    return { error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error setting typing status:', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// קבלת מקלידים נוכחיים
// ============================================

export async function getTypingUsers(
  groupId: string,
  excludeUserId?: string
): Promise<{ data: ChatTypingIndicator[] | null; error: ChatError | null }> {
  try {
    let query = supabase
      .from('chat_typing_indicators')
      .select(`
        *,
        user:users (
          id,
          display_name
        )
      `)
      .eq('group_id', groupId);

    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching typing users:', error);
      return { data: null, error: { code: 'FETCH_TYPING_ERROR', message: error.message } };
    }

    return { data: data as any, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error fetching typing users:', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// עדכון סטטוס אונליין
// ============================================

export async function updateOnlineStatus(
  userId: string,
  isOnline: boolean
): Promise<{ error: ChatError | null }> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        is_online: isOnline,
        last_active: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('❌ Error updating online status:', error);
      return { error: { code: 'UPDATE_STATUS_ERROR', message: error.message } };
    }

    console.log(`✅ Updated online status for user ${userId}: ${isOnline}`);
    return { error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error updating online status:', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// הרשמה לשינויי סטטוס של משתמש
// ============================================

export function subscribeToUserStatus(
  userId: string,
  onStatusChange: (isOnline: boolean, lastActive: string) => void
): RealtimeChannel {
  console.log(`🔌 Subscribing to user status: ${userId}`);

  const channelName = `user-status:${userId}`;
  
  // ביטול channel קיים
  if (activeChannels.has(channelName)) {
    unsubscribeFromUserStatus(userId);
  }

  const channel = supabase.channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        console.log('👤 User status changed:', payload.new.is_online);
        onStatusChange(payload.new.is_online, payload.new.last_active);
      }
    )
    .subscribe();

  activeChannels.set(channelName, channel);
  return channel;
}

// ============================================
// ביטול הרשמה לסטטוס משתמש
// ============================================

export function unsubscribeFromUserStatus(userId: string): void {
  const channelName = `user-status:${userId}`;
  const channel = activeChannels.get(channelName);
  
  if (channel) {
    channel.unsubscribe();
    activeChannels.delete(channelName);
  }
}

// ============================================
// הרשמה לכל הקבוצות של המשתמש
// ============================================

export function subscribeToAllUserGroups(
  userId: string,
  onNewMessage: (groupId: string, message: ChatMessage) => void,
  onGroupUpdate: (groupId: string, data: any) => void
): RealtimeChannel {
  console.log(`🔌 Subscribing to all groups for user: ${userId}`);

  const channelName = `user-groups:${userId}`;

  // ביטול channel קיים
  if (activeChannels.has(channelName)) {
    const channel = activeChannels.get(channelName);
    channel?.unsubscribe();
  }

  const channel = supabase.channel(channelName)
    // הודעות חדשות בכל הקבוצות שלי
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `group_id=in.(select group_id from chat_group_members where user_id='${userId}')`,
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        const message = payload.new as ChatMessage;
        // לא להציג הודעות שלי
        if (message.sender_id !== userId) {
          console.log('📩 New message in group:', message.group_id);
          onNewMessage(message.group_id, message);
        }
      }
    )
    // עדכוני קבוצות
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_groups',
        filter: `id=in.(select group_id from chat_group_members where user_id='${userId}')`,
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        console.log('📝 Group updated:', payload.new.id);
        onGroupUpdate(payload.new.id, payload.new);
      }
    )
    .subscribe();

  activeChannels.set(channelName, channel);
  return channel;
}

// ============================================
// ניקוי אוטומטי של typing indicators ישנים
// ============================================

let cleanupInterval: NodeJS.Timeout | null = null;

export function startTypingCleanup(): void {
  if (cleanupInterval) {
    return;
  }

  console.log('🧹 Starting typing indicators cleanup');

  cleanupInterval = setInterval(async () => {
    try {
      // מחיקת indicators מעל 10 שניות
      const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
      
      await supabase
        .from('chat_typing_indicators')
        .delete()
        .lt('started_typing_at', tenSecondsAgo);
    } catch (error) {
      console.error('⚠️ Warning: Error cleaning up typing indicators:', error);
    }
  }, 5000); // כל 5 שניות
}

export function stopTypingCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('🧹 Stopped typing indicators cleanup');
  }
}

// ============================================
// בדיקת חיבור
// ============================================

export function getConnectionStatus(): 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' {
  // Supabase לא חושף את הסטטוס ישירות, אבל נוכל לבדוק אם יש channels פעילים
  if (activeChannels.size > 0) {
    return 'CONNECTED';
  }
  return 'DISCONNECTED';
}

// ============================================
// Export
// ============================================

export const chatRealtimeService = {
  subscribeToGroup,
  unsubscribeFromGroup,
  unsubscribeAll,
  setTypingStatus,
  getTypingUsers,
  updateOnlineStatus,
  subscribeToUserStatus,
  unsubscribeFromUserStatus,
  subscribeToAllUserGroups,
  startTypingCleanup,
  stopTypingCleanup,
  getConnectionStatus,
};

