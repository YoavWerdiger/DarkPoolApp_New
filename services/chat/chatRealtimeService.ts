// ============================================
// Chat Realtime Service
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
import { logger } from '../../utils/logger';

const TAG = 'ChatRealtime';

type MessageListener = (message: ChatMessage, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void;
type ReactionListener = (reaction: ChatReaction, eventType: 'INSERT' | 'DELETE') => void;
type TypingListener = (indicators: ChatTypingIndicator[]) => void;
type MemberListener = (data: any, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void;
type GroupListener = (data: any, eventType: 'UPDATE') => void;

const activeChannels = new Map<string, RealtimeChannel>();
const typingTimers = new Map<string, NodeJS.Timeout>();
const retryTimers = new Map<string, NodeJS.Timeout>();
const failedChannels = new Map<string, number>();
const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 2000;

const USER_CACHE_TTL = 5 * 60 * 1000;
const USER_CACHE_MAX_SIZE = 200;
const userCache = new Map<string, { data: any; expiresAt: number }>();

function evictExpiredUserCache(): void {
  if (userCache.size <= USER_CACHE_MAX_SIZE) return;
  const now = Date.now();
  for (const [key, val] of userCache) {
    if (val.expiresAt < now) userCache.delete(key);
    if (userCache.size <= USER_CACHE_MAX_SIZE) break;
  }
  // If still over limit, remove oldest entries (FIFO — Map preserves insertion order)
  if (userCache.size > USER_CACHE_MAX_SIZE) {
    const excess = userCache.size - USER_CACHE_MAX_SIZE;
    let removed = 0;
    for (const key of userCache.keys()) {
      if (removed >= excess) break;
      userCache.delete(key);
      removed++;
    }
  }
}

async function getCachedUser(userId: string): Promise<{ id: string; display_name: string; profile_picture: string } | null> {
  const cached = userCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, profile_picture')
    .eq('id', userId)
    .single();
  if (error) {
    logger.error(TAG, 'getCachedUser failed', error);
    return null;
  }
  if (data) {
    userCache.set(userId, { data, expiresAt: Date.now() + USER_CACHE_TTL });
    evictExpiredUserCache();
  }
  return data;
}
let connectionStatusCallback: ((status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING') => void) | null = null;

export function onConnectionStatusChange(
  cb: ((status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING') => void) | null
) {
  connectionStatusCallback = cb;
}

function cancelRetry(groupId: string) {
  const timer = retryTimers.get(groupId);
  if (timer) {
    clearTimeout(timer);
    retryTimers.delete(groupId);
  }
}

function scheduleRetry(groupId: string, retryFn: () => void) {
  cancelRetry(groupId);
  const retries = failedChannels.get(groupId) ?? 0;
  if (retries >= MAX_RETRIES) {
    logger.warn(TAG, `Max retries (${MAX_RETRIES}) reached for ${groupId}`);
    connectionStatusCallback?.('DISCONNECTED');
    return;
  }
  failedChannels.set(groupId, retries + 1);
  // Exponential backoff with jitter to prevent thundering herd
  const base = BASE_RETRY_DELAY_MS * Math.pow(2, retries);
  const jitter = Math.random() * base * 0.3;
  const delay = Math.floor(base + jitter);
  logger.debug(TAG, `Scheduling retry #${retries + 1} for ${groupId} in ${delay}ms`);
  connectionStatusCallback?.('RECONNECTING');
  const timer = setTimeout(retryFn, delay);
  retryTimers.set(groupId, timer);
}

// ============================================
// Subscribe to group
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
): RealtimeChannel | null {
  logger.debug(TAG, `Subscribing to group: ${groupId}`);

  const retryCount = failedChannels.get(groupId) ?? 0;
  if (retryCount >= MAX_RETRIES) {
    logger.warn(TAG, `Skipping subscription to ${groupId} - max retries reached`);
    return null;
  }

  if (activeChannels.has(groupId)) {
    return activeChannels.get(groupId)!;
  }

  const channel = supabase.channel(`group:${groupId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: userId },
    },
  });

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
        try {
          logger.debug(TAG, `Message event: ${payload.eventType} ${payload.new?.id}`);

          if (payload.eventType === 'INSERT') {
            listeners.onMessage!(payload.new as ChatMessage, 'INSERT');
          } else if (payload.eventType === 'UPDATE') {
            listeners.onMessage!(payload.new as ChatMessage, 'UPDATE');
          } else if (payload.eventType === 'DELETE') {
            listeners.onMessage!(payload.old as ChatMessage, 'DELETE');
          }
        } catch (e) {
          logger.error(TAG, 'onMessage callback error', e);
        }
      }
    );
  }

  if (listeners.onReaction) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_message_reactions',
        filter: `group_id=eq.${groupId}`,
      },
      async (payload: RealtimePostgresChangesPayload<any>) => {
        try {
          const reactionData = payload.new || payload.old;
          if (!reactionData?.message_id) return;

          logger.debug(TAG, `Reaction event: ${payload.eventType}`);

          if (payload.eventType === 'INSERT') {
            const reaction = payload.new as ChatReaction;
            if (reaction.user_id) {
              const userData = await getCachedUser(reaction.user_id);
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
        } catch (e) {
          logger.error(TAG, 'onReaction callback error', e);
        }
      }
    );
  }

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
        try {
          const { data } = await supabase
            .from('chat_typing_indicators')
            .select(`*, user:users (id, display_name)`)
            .eq('group_id', groupId)
            .neq('user_id', userId);

          if (data) {
            listeners.onTyping!(data as any);
          }
        } catch (e) {
          logger.error(TAG, 'onTyping callback error', e);
        }
      }
    );
  }

  if (listeners.onMember) {
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_group_members', filter: `group_id=eq.${groupId}` },
      (payload: RealtimePostgresChangesPayload<any>) => { listeners.onMember!(payload.new, 'INSERT'); }
    );
    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'chat_group_members', filter: `group_id=eq.${groupId}` },
      (payload: RealtimePostgresChangesPayload<any>) => { listeners.onMember!(payload.old, 'DELETE'); }
    );
  }

  if (listeners.onGroup) {
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_groups', filter: `id=eq.${groupId}` },
      (payload: RealtimePostgresChangesPayload<any>) => {
        listeners.onGroup!(payload.new, 'UPDATE');
      }
    );
  }

  channel.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      logger.debug(TAG, `Subscribed to group ${groupId}`);
      failedChannels.delete(groupId);
      connectionStatusCallback?.('CONNECTED');
    } else if (status === 'CHANNEL_ERROR') {
      logger.error(TAG, `Error subscribing to group ${groupId}: ${err?.message ?? 'Unknown'}`);
      activeChannels.delete(groupId);
      try { channel.unsubscribe(); } catch (_) { /* ignore */ }
      scheduleRetry(groupId, () => {
        subscribeToGroup(groupId, userId, listeners);
      });
    }
  });

  activeChannels.set(groupId, channel);
  return channel;
}

// ============================================
// Unsubscribe
// ============================================

export function unsubscribeFromGroup(groupId: string): void {
  cancelRetry(groupId);
  failedChannels.delete(groupId);

  const channel = activeChannels.get(groupId);
  if (channel) {
    channel.unsubscribe();
    activeChannels.delete(groupId);
  }

  // Clean up all typing timers for this group (keyed as groupId-userId)
  for (const [key, timer] of typingTimers.entries()) {
    if (key.startsWith(`${groupId}-`)) {
      clearTimeout(timer);
      typingTimers.delete(key);
    }
  }
}

export function unsubscribeAll(): void {
  retryTimers.forEach((timer) => { clearTimeout(timer); });
  retryTimers.clear();
  failedChannels.clear();
  activeChannels.forEach((channel) => { channel.unsubscribe(); });
  activeChannels.clear();
  typingTimers.forEach((timer) => { clearTimeout(timer); });
  typingTimers.clear();
  userGroupsCache.clear();
  userCache.clear();
  stopTypingCleanup();
}

// ============================================
// Typing status
// ============================================

export async function setTypingStatus(
  input: SetTypingStatusInput,
  userId: string
): Promise<{ error: ChatError | null }> {
  try {
    if (input.is_typing) {
      const { error } = await supabase
        .from('chat_typing_indicators')
        .upsert({
          group_id: input.group_id,
          user_id: userId,
          started_typing_at: new Date().toISOString(),
        }, { onConflict: 'group_id,user_id' });

      if (error) {
        const isCommonError = error.code === '42501' || error.code === '23505' || error.message?.includes('permission');
        if (!isCommonError) {
          logger.error(TAG, `Error setting typing status: ${error.message}`);
        }
        return { error: { code: 'TYPING_ERROR', message: error.message || 'Unknown error' } };
      }

      const existingTimer = typingTimers.get(`${input.group_id}-${userId}`);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        setTypingStatus({ ...input, is_typing: false }, userId);
      }, 4000);
      typingTimers.set(`${input.group_id}-${userId}`, timer);
    } else {
      const timer = typingTimers.get(`${input.group_id}-${userId}`);
      if (timer) {
        clearTimeout(timer);
        typingTimers.delete(`${input.group_id}-${userId}`);
      }

      try {
        await supabase
          .from('chat_typing_indicators')
          .delete()
          .eq('group_id', input.group_id)
          .eq('user_id', userId);
      } catch (_) {
        // Harmless – record may already be gone
      }
    }

    return { error: null };
  } catch (error: any) {
    logger.error(TAG, `Unexpected error setting typing status: ${error.message}`);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// Get typing users
// ============================================

export async function getTypingUsers(
  groupId: string,
  excludeUserId?: string
): Promise<{ data: ChatTypingIndicator[] | null; error: ChatError | null }> {
  try {
    let query = supabase
      .from('chat_typing_indicators')
      .select(`*, user:users (id, display_name)`)
      .eq('group_id', groupId);

    if (excludeUserId) query = query.neq('user_id', excludeUserId);

    const { data, error } = await query;
    if (error) {
      logger.error(TAG, `Error fetching typing users: ${error.message}`);
      return { data: null, error: { code: 'FETCH_TYPING_ERROR', message: error.message } };
    }
    return { data: data as any, error: null };
  } catch (error: any) {
    logger.error(TAG, `Unexpected error fetching typing users: ${error.message}`);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// Online status
// ============================================

export async function updateOnlineStatus(
  userId: string,
  isOnline: boolean
): Promise<{ error: ChatError | null }> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ is_online: isOnline, last_active: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      logger.error(TAG, `Error updating online status: ${error.message}`);
      return { error: { code: 'UPDATE_STATUS_ERROR', message: error.message } };
    }
    return { error: null };
  } catch (error: any) {
    logger.error(TAG, `Unexpected error updating online status: ${error.message}`);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// User status subscription
// ============================================

export function subscribeToUserStatus(
  userId: string,
  onStatusChange: (isOnline: boolean, lastActive: string) => void
): RealtimeChannel {
  const channelName = `user-status:${userId}`;

  if (activeChannels.has(channelName)) {
    unsubscribeFromUserStatus(userId);
  }

  const channel = supabase.channel(channelName)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
      (payload: RealtimePostgresChangesPayload<any>) => {
        onStatusChange(payload.new.is_online, payload.new.last_active);
      }
    )
    .subscribe();

  activeChannels.set(channelName, channel);
  return channel;
}

export function unsubscribeFromUserStatus(userId: string): void {
  const channelName = `user-status:${userId}`;
  const channel = activeChannels.get(channelName);
  if (channel) {
    channel.unsubscribe();
    activeChannels.delete(channelName);
  }
}

// ============================================
// Subscribe to all user groups
// ============================================

const userGroupsCache = new Map<string, Set<string>>();

export async function subscribeToAllUserGroups(
  userId: string,
  onNewMessage: (groupId: string, message: ChatMessage) => void,
  onGroupUpdate: (groupId: string, data: any) => void
): Promise<RealtimeChannel | null> {
  const channelName = `user-membership:${userId}`;

  const retryCount = failedChannels.get(channelName) ?? 0;
  if (retryCount >= MAX_RETRIES) {
    logger.warn(TAG, `Skipping subscription to ${channelName} - max retries reached`);
    return null;
  }

  if (activeChannels.has(channelName)) {
    const existingChannel = activeChannels.get(channelName);
    existingChannel?.unsubscribe();
    activeChannels.delete(channelName);
  }

  const { data: memberships } = await supabase
    .from('chat_group_members')
    .select('group_id')
    .eq('user_id', userId);

  const userGroups = new Set<string>(memberships?.map(m => m.group_id) || []);
  userGroupsCache.set(userId, userGroups);

  logger.debug(TAG, `User is member of ${userGroups.size} groups`);

  const channel = supabase.channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      async (payload: RealtimePostgresChangesPayload<any>) => {
        const newMessage = payload.new as ChatMessage;
        const groupId = newMessage.group_id;
        const currentUserGroups = userGroupsCache.get(userId);

        if (!currentUserGroups?.has(groupId)) return;
        if (newMessage.sender_id === userId) return;
        if (newMessage.is_silent || newMessage.is_system_message) return;

        onNewMessage(groupId, newMessage);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_group_members', filter: `user_id=eq.${userId}` },
      async (payload: RealtimePostgresChangesPayload<any>) => {
        if (payload.eventType === 'INSERT') {
          userGroupsCache.get(userId)?.add(payload.new.group_id);
        } else if (payload.eventType === 'DELETE') {
          userGroupsCache.get(userId)?.delete(payload.old.group_id);
        } else if (payload.eventType === 'UPDATE') {
          onGroupUpdate(payload.new.group_id, {
            unread_count: payload.new.unread_count,
            mentioned_count: payload.new.mentioned_count,
          });
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        logger.error(TAG, `Error subscribing to user groups channel: ${err?.message ?? 'Unknown'}`);
        activeChannels.delete(channelName);
        try { channel.unsubscribe(); } catch (_) { /* ignore */ }
        scheduleRetry(channelName, () => {
          subscribeToAllUserGroups(userId, onNewMessage, onGroupUpdate);
        });
      } else if (status === 'SUBSCRIBED') {
        logger.debug(TAG, 'Subscribed to user groups channel');
        failedChannels.delete(channelName);
        connectionStatusCallback?.('CONNECTED');
      }
    });

  activeChannels.set(channelName, channel);
  return channel;
}

export function updateUserGroupsCache(userId: string, groupId: string, action: 'add' | 'remove'): void {
  const groups = userGroupsCache.get(userId) || new Set<string>();
  if (action === 'add') groups.add(groupId);
  else groups.delete(groupId);
  userGroupsCache.set(userId, groups);
}

export function clearUserGroupsCache(userId?: string): void {
  if (userId) {
    userGroupsCache.delete(userId);
  } else {
    userGroupsCache.clear();
  }
}

// ============================================
// Typing cleanup
// ============================================

let cleanupInterval: NodeJS.Timeout | null = null;

export function startTypingCleanup(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(async () => {
    try {
      const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
      await supabase
        .from('chat_typing_indicators')
        .delete()
        .lt('started_typing_at', tenSecondsAgo);
    } catch (_) {
      // Non-critical cleanup failure
    }
  }, 5000);
}

export function stopTypingCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// ============================================
// Connection status
// ============================================

export function getConnectionStatus(): 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' {
  if (activeChannels.size === 0) return 'DISCONNECTED';
  if (failedChannels.size > 0 && failedChannels.size >= activeChannels.size) return 'CONNECTING';
  return 'CONNECTED';
}

export function clearFailedChannels(): void {
  failedChannels.clear();
  connectionStatusCallback?.('DISCONNECTED');
}

export function clearFailedChannel(groupId: string): void {
  failedChannels.delete(groupId);
}

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
  updateUserGroupsCache,
  startTypingCleanup,
  stopTypingCleanup,
  getConnectionStatus,
  clearFailedChannels,
  clearFailedChannel,
  onConnectionStatusChange,
  clearUserGroupsCache,
};
