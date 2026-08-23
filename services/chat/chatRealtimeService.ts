// ============================================
// Chat Realtime Service
// ============================================

import { Platform } from 'react-native';
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
const ANDROID_TAG = 'ChatRealtime][Android';

/** לוגים ממוקדים לדיבוג Android realtime (נשארים גם ב-iOS עם תגית רגילה). */
function rtLog(message: string, ...args: unknown[]): void {
  if (Platform.OS === 'android') {
    logger.debug(ANDROID_TAG, message, ...args);
  } else {
    logger.debug(TAG, message, ...args);
  }
}

/** ב־CHANNEL_ERROR לעיתים `err` מגיע undefined — לא לוגים כ־"undefined" בלבד */
function formatRealtimeSubscribeErr(err: unknown): string {
  if (err == null) return 'CHANNEL_ERROR (no error payload from Realtime client)';
  if (typeof err === 'string') return err;
  if (err instanceof Error && err.message) return err.message;
  try {
    const s = JSON.stringify(err);
    if (s && s !== '{}') return s;
  } catch {
    /* ignore */
  }
  return String(err);
}

/** כשלי WebSocket/רשת חולפים (Expo Go, Fast Refresh, רקע, Wi‑Fi) — לא לדווח ל־Sentry כ־error */
function isTransientRealtimeFailure(err: unknown, status?: string): boolean {
  // CLOSED נפוץ אחרי removeChannel / remount / recycle socket — צפוי, לא באג
  if (status === 'TIMED_OUT' || status === 'CLOSED') return true;
  const msg = formatRealtimeSubscribeErr(err).toLowerCase();
  if (msg === 'closed' || msg === 'timed_out') return true;
  return (
    msg.includes('transport failure') ||
    msg.includes('heartbeat timeout') ||
    msg.includes('socket closed') ||
    msg.includes('network request failed') ||
    msg.includes('network') ||
    msg.includes('websocket') ||
    msg.includes('connection') ||
    msg.includes('closed before') ||
    msg.includes('channel error (no error payload')
  );
}

function isTransientNetworkMessage(msg: string): boolean {
  return /network request failed|failed to fetch|networkerror|fetch failed|offline|timeout/i.test(
    msg || '',
  );
}

function logSubscribeFailure(channelKey: string, err: unknown, status?: string): void {
  const raw = formatRealtimeSubscribeErr(err);
  const detail =
    status && status !== raw ? `${status}: ${raw}` : status === 'TIMED_OUT' ? `TIMED_OUT: ${raw}` : raw;
  const message = `Error subscribing to ${channelKey}: ${detail}`;
  if (isTransientRealtimeFailure(err, status)) {
    logger.warn(TAG, message);
  } else {
    logger.error(TAG, message);
  }
}

type MessageListener = (message: ChatMessage, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void;
type ReactionListener = (reaction: ChatReaction, eventType: 'INSERT' | 'DELETE') => void;
type TypingListener = (indicators: ChatTypingIndicator[]) => void;
type MemberListener = (data: any, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void;
type GroupListener = (data: any, eventType: 'UPDATE') => void;
type ReadReceiptListener = (read: { message_id: string; user_id: string; group_id: string }) => void;

type GroupRealtimeListeners = {
  onMessage?: MessageListener;
  onReaction?: ReactionListener;
  onTyping?: TypingListener;
  onMember?: MemberListener;
  onGroup?: GroupListener;
  onReadReceipt?: ReadReceiptListener;
};

const activeChannels = new Map<string, RealtimeChannel>();
/** Listeners מעודכנים בכל subscribe — handlers קוראים מכאן כדי למנוע stale closures. */
const groupListenersMap = new Map<string, GroupRealtimeListeners>();
const typingTimers = new Map<string, NodeJS.Timeout>();
const retryTimers = new Map<string, NodeJS.Timeout>();
const failedChannels = new Map<string, number>();
const MAX_RETRIES = 10;
const BASE_RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 30_000;

const USER_CACHE_TTL = 5 * 60 * 1000;
const USER_CACHE_MAX_SIZE = 200;
const userCache = new Map<string, { data: any; expiresAt: number }>();

let membershipSubscribeGeneration = 0;
/** דור subscribe per-group — מבטל CLOSED/retry אחרי unsubscribe או resubscribe חדש */
const groupSubscribeGeneration = new Map<string, number>();
let membershipCallbacksUserId: string | null = null;
let membershipCallbacks: {
  onNewMessage: (groupId: string, message: ChatMessage) => void;
  onGroupUpdate: (groupId: string, data: any) => void;
  onMembershipRemoved?: (groupId: string) => void;
} | null = null;

function isChannelJoined(channel: RealtimeChannel | undefined | null): boolean {
  return channel?.state === 'joined';
}

function areChannelsJoined(keys: string[]): boolean {
  if (keys.length === 0) return false;
  return keys.every((key) => isChannelJoined(activeChannels.get(key)));
}

/** joined או joining — לא לפרק באמצע subscribe (מונע thrash). */
function areChannelsAlive(keys: string[]): boolean {
  if (keys.length === 0) return false;
  return keys.every((key) => {
    const state = activeChannels.get(key)?.state;
    return state === 'joined' || state === 'joining';
  });
}

/**
 * דחיפת JWT ל-Realtime — רק כשהטוקן באמת השתנה.
 * setAuth עם אותו JWT סוגר את ה-WebSocket (code 1000) ב-Android → כל הערוצים
 * נכנסים ל-CLOSED → retry → setAuth שוב → לולאת מוות (ראיות מהלוגים).
 */
let lastRealtimeAuthToken: string | null = null;

export async function ensureRealtimeAuth(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logger.warn(TAG, 'ensureRealtimeAuth getSession error', error);
      return false;
    }
    const token = data.session?.access_token;
    if (!token) {
      rtLog('ensureRealtimeAuth: no session token');
      return false;
    }

    const clientToken =
      (supabase.realtime as { accessTokenValue?: string | null }).accessTokenValue ?? null;

    if (token === lastRealtimeAuthToken || token === clientToken) {
      lastRealtimeAuthToken = token;
      rtLog('ensureRealtimeAuth: token unchanged — skip setAuth');
      return true;
    }

    await supabase.realtime.setAuth(token);
    lastRealtimeAuthToken = token;
    rtLog('ensureRealtimeAuth: token applied');
    return true;
  } catch (e) {
    logger.warn(TAG, 'ensureRealtimeAuth failed', e);
    return false;
  }
}

/** רק מוודא שיש סשן; לא קורא setAuth (מונע סגירת socket באמצע subscribe). */
async function waitForRealtimeSession(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      rtLog('waitForRealtimeSession: no session yet');
      return;
    }
    const clientToken =
      (supabase.realtime as { accessTokenValue?: string | null }).accessTokenValue ?? null;
    // רק אם ל-Realtime אין טוקן בכלל — אחרת דילוג (גם אם last* לא מסונכרן)
    if (!clientToken) {
      await supabase.realtime.setAuth(token);
      lastRealtimeAuthToken = token;
      rtLog('waitForRealtimeSession: seeded missing realtime token');
    } else {
      lastRealtimeAuthToken = clientToken;
    }
  } catch (e) {
    logger.warn(TAG, 'waitForRealtimeSession failed', e);
  }
}

async function removeChannelByKey(key: string): Promise<void> {
  const channel = activeChannels.get(key);
  if (!channel) return;
  activeChannels.delete(key);
  try {
    await supabase.removeChannel(channel);
  } catch {
    try {
      await channel.unsubscribe();
    } catch {
      /* ignore */
    }
  }
}

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

export type ChatSenderProfile = NonNullable<ChatMessage['sender']>;

/** מנרמל embed של sender (אובייקט / מערך מ-PostgREST). */
export function normalizeChatSender(sender: unknown): ChatSenderProfile | undefined {
  if (!sender || typeof sender !== 'object') return undefined;
  const raw = Array.isArray(sender) ? sender[0] : sender;
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || !row.id) return undefined;
  const displayName =
    (typeof row.display_name === 'string' && row.display_name.trim()) ||
    (typeof row.full_name === 'string' && row.full_name.trim()) ||
    '';
  return {
    id: row.id,
    display_name: displayName,
    profile_picture:
      typeof row.profile_picture === 'string' ? row.profile_picture : undefined,
    is_online: typeof row.is_online === 'boolean' ? row.is_online : undefined,
  };
}

export function hasUsableSender(sender: unknown): boolean {
  return Boolean(normalizeChatSender(sender)?.display_name);
}

function rememberUserProfile(profile: ChatSenderProfile): void {
  userCache.set(profile.id, {
    data: {
      id: profile.id,
      display_name: profile.display_name,
      profile_picture: profile.profile_picture,
    },
    expiresAt: Date.now() + USER_CACHE_TTL,
  });
  evictExpiredUserCache();
}

async function getCachedUser(userId: string): Promise<{ id: string; display_name: string; profile_picture: string } | null> {
  const cached = userCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const { data, error } = await supabase
    .from('v_public_profiles')
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
  // Exponential backoff with jitter, capped at MAX_RETRY_DELAY_MS
  const base = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, retries), MAX_RETRY_DELAY_MS);
  const jitter = Math.random() * base * 0.25;
  const delay = Math.floor(base + jitter);
  logger.debug(TAG, `Scheduling retry #${retries + 1} for ${groupId} in ${delay}ms`);
  connectionStatusCallback?.('RECONNECTING');
  const timer = setTimeout(retryFn, delay);
  retryTimers.set(groupId, timer);
}

// ============================================
// Subscribe to group
// ============================================

function groupChannelPrefix(groupId: string): string {
  return `group:${groupId}:`;
}

function listGroupChannelKeys(groupId: string): string[] {
  const prefix = groupChannelPrefix(groupId);
  return [...activeChannels.keys()].filter((key) => key.startsWith(prefix));
}

/** True when group realtime slots exist and are actually joined (not zombie Map entries). */
export function isGroupRealtimeSubscribed(groupId: string): boolean {
  const keys = listGroupChannelKeys(groupId);
  return areChannelsJoined(keys);
}

/**
 * Batch-enrich messages missing sender display_name / avatar.
 * postgres_changes rows omit joins; lean/fetch embeds can also return null.
 */
export async function enrichChatMessagesSenders(
  messages: ChatMessage[]
): Promise<ChatMessage[]> {
  if (messages.length === 0) return messages;

  const normalized = messages.map((m) => {
    const sender = normalizeChatSender(m.sender);
    return sender ? { ...m, sender } : { ...m, sender: undefined };
  });

  const missingIds = [
    ...new Set(
      normalized
        .filter((m) => m.sender_id && !m.sender?.display_name)
        .map((m) => m.sender_id as string),
    ),
  ];
  if (missingIds.length === 0) return normalized;

  const profiles = new Map<string, ChatSenderProfile>();
  const toFetch: string[] = [];
  const now = Date.now();

  for (const id of missingIds) {
    const cached = userCache.get(id);
    if (cached && cached.expiresAt > now && cached.data?.id) {
      const display_name = String(cached.data.display_name || '').trim();
      if (display_name) {
        profiles.set(id, {
          id: cached.data.id,
          display_name,
          profile_picture: cached.data.profile_picture,
        });
        continue;
      }
    }
    toFetch.push(id);
  }

  if (toFetch.length > 0) {
    const { data, error } = await supabase
      .from('v_public_profiles')
      .select('id, display_name, profile_picture')
      .in('id', toFetch);
    if (error) {
      logger.error(TAG, 'enrichChatMessagesSenders failed', error);
    } else {
      for (const row of data || []) {
        if (!row?.id) continue;
        const display_name = String(row.display_name || '').trim();
        const profile: ChatSenderProfile = {
          id: row.id,
          display_name,
          profile_picture: row.profile_picture || undefined,
        };
        if (display_name) {
          profiles.set(row.id, profile);
          rememberUserProfile(profile);
        } else if (row.profile_picture) {
          // שמירת אווטאר גם בלי שם — השם יימשך מ-RPC בהמשך
          profiles.set(row.id, profile);
        }
      }
    }

    const stillMissingNames = toFetch.filter((id) => !profiles.get(id)?.display_name);
    if (stillMissingNames.length > 0) {
      const { data: nameRows, error: nameError } = await supabase.rpc(
        'get_user_display_names',
        { user_ids: stillMissingNames },
      );
      if (nameError) {
        logger.error(TAG, 'get_user_display_names fallback failed', nameError);
      } else {
        for (const row of (nameRows || []) as Array<{
          id: string;
          display_name: string;
        }>) {
          if (!row?.id) continue;
          const display_name = String(row.display_name || '').trim();
          if (!display_name) continue;
          const prev = profiles.get(row.id);
          const profile: ChatSenderProfile = {
            id: row.id,
            display_name,
            profile_picture: prev?.profile_picture,
          };
          profiles.set(row.id, profile);
          rememberUserProfile(profile);
        }
      }
    }
  }

  return normalized.map((m) => {
    if (m.sender?.display_name || !m.sender_id) return m;
    const profile = profiles.get(m.sender_id);
    return profile ? { ...m, sender: profile } : m;
  });
}

/** postgres_changes rows omit joins — attach sender for list UI. */
export async function enrichChatMessageSender(
  message: ChatMessage
): Promise<ChatMessage> {
  const [enriched] = await enrichChatMessagesSenders([message]);
  return enriched ?? message;
}

function teardownGroupChannels(groupId: string): Promise<void> {
  return Promise.all(listGroupChannelKeys(groupId).map(removeChannelByKey)).then(() => undefined);
}

function teardownMembershipChannels(userId: string): Promise<void> {
  const baseName = `user-membership:${userId}`;
  return Promise.all([
    removeChannelByKey(`${baseName}:messages`),
    removeChannelByKey(`${baseName}:members`),
  ]).then(() => undefined);
}

function subscribeGroupSlot(
  channelKey: string,
  build: () => RealtimeChannel,
  onSubscribed: () => void,
  onError: (err: unknown, status: string) => void
): RealtimeChannel {
  const channel = build();
  channel.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      rtLog(`Subscribed: ${channelKey}`);
      onSubscribed();
    } else if (
      status === 'CHANNEL_ERROR' ||
      status === 'TIMED_OUT' ||
      status === 'CLOSED'
    ) {
      rtLog(`Channel status ${status}: ${channelKey}`);
      onError(err ?? status, status);
    }
  });
  activeChannels.set(channelKey, channel);
  return channel;
}

function getGroupListeners(groupId: string): GroupRealtimeListeners | undefined {
  return groupListenersMap.get(groupId);
}

export async function subscribeToGroup(
  groupId: string,
  userId: string,
  listeners: GroupRealtimeListeners
): Promise<RealtimeChannel | null> {
  rtLog(`Subscribing to group: ${groupId}`);

  // תמיד מעדכנים listeners — גם ב-early return (מונע stale closures אחרי resume)
  groupListenersMap.set(groupId, listeners);

  await waitForRealtimeSession();

  const retryCount = failedChannels.get(groupId) ?? 0;
  if (retryCount >= MAX_RETRIES) {
    logger.warn(TAG, `Skipping subscription to ${groupId} - max retries reached`);
    return null;
  }

  const slotKeys: string[] = [];
  if (listeners.onMessage) slotKeys.push(`${groupChannelPrefix(groupId)}messages`);
  if (listeners.onReaction) slotKeys.push(`${groupChannelPrefix(groupId)}reactions`);
  if (listeners.onReadReceipt) slotKeys.push(`${groupChannelPrefix(groupId)}reads`);
  if (listeners.onTyping) slotKeys.push(`${groupChannelPrefix(groupId)}typing`);
  if (listeners.onMember) {
    slotKeys.push(`${groupChannelPrefix(groupId)}members-in`);
    slotKeys.push(`${groupChannelPrefix(groupId)}members-out`);
  }
  if (listeners.onGroup) slotKeys.push(`${groupChannelPrefix(groupId)}group`);

  if (slotKeys.length === 0) {
    logger.warn(TAG, `No listeners for group ${groupId} — skipping subscription`);
    return null;
  }

  const slotsPresent = slotKeys.every((key) => activeChannels.has(key));
  if (slotsPresent && areChannelsAlive(slotKeys)) {
    rtLog(`Group channels alive — listeners refreshed: ${groupId}`);
    return activeChannels.get(slotKeys[0]) ?? null;
  }

  if (slotsPresent) {
    rtLog(`Group channels zombie/closed — tearing down: ${groupId}`);
  }

  const generation = (groupSubscribeGeneration.get(groupId) ?? 0) + 1;
  groupSubscribeGeneration.set(groupId, generation);
  cancelRetry(groupId);
  await teardownGroupChannels(groupId);

  if (groupSubscribeGeneration.get(groupId) !== generation) {
    rtLog(`Stale group subscribe aborted for ${groupId}`);
    return null;
  }

  let subscribedSlots = 0;
  let errorHandled = false;
  const requiredSlots = slotKeys.length;

  const onSlotSubscribed = () => {
    if (groupSubscribeGeneration.get(groupId) !== generation) return;
    subscribedSlots += 1;
    if (subscribedSlots === requiredSlots) {
      failedChannels.delete(groupId);
      connectionStatusCallback?.('CONNECTED');
      logger.debug(TAG, `All ${requiredSlots} realtime slots ready for group ${groupId}`);
    }
  };

  const onSlotError = (slotKey: string, err: unknown, status: string) => {
    // teardown/resubscribe intentional — אל תדווח ותאלץ retry מתחרה
    if (groupSubscribeGeneration.get(groupId) !== generation) return;
    if (errorHandled) return;
    errorHandled = true;
    logSubscribeFailure(slotKey, err, status);
    void teardownGroupChannels(groupId).then(() => {
      if (groupSubscribeGeneration.get(groupId) !== generation) return;
      scheduleRetry(groupId, () => {
        if (groupSubscribeGeneration.get(groupId) !== generation) return;
        const latest = groupListenersMap.get(groupId);
        if (!latest) return;
        void subscribeToGroup(groupId, userId, latest);
      });
    });
  };

  let primaryChannel: RealtimeChannel | null = null;

  if (listeners.onMessage) {
    const key = `${groupChannelPrefix(groupId)}messages`;
    primaryChannel = subscribeGroupSlot(
      key,
      () =>
        supabase.channel(key).on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_messages',
            filter: `group_id=eq.${groupId}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            try {
              const cb = getGroupListeners(groupId)?.onMessage;
              if (!cb) return;
              const changedId =
                payload.eventType === 'DELETE' ? payload.old?.id : payload.new?.id;
              rtLog(`Message event: ${payload.eventType} ${changedId}`);
              if (payload.eventType === 'INSERT') {
                cb(payload.new as ChatMessage, 'INSERT');
              } else if (payload.eventType === 'UPDATE') {
                cb(payload.new as ChatMessage, 'UPDATE');
              } else if (payload.eventType === 'DELETE') {
                cb(payload.old as ChatMessage, 'DELETE');
              }
            } catch (e) {
              logger.error(TAG, 'onMessage callback error', e);
            }
          }
        ),
      onSlotSubscribed,
      (err, status) => onSlotError(key, err, status)
    );
  }

  if (listeners.onReaction) {
    const key = `${groupChannelPrefix(groupId)}reactions`;
    const ch = subscribeGroupSlot(
      key,
      () =>
        supabase.channel(key).on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_message_reactions',
            filter: `group_id=eq.${groupId}`,
          },
          async (payload: RealtimePostgresChangesPayload<any>) => {
            try {
              const cb = getGroupListeners(groupId)?.onReaction;
              if (!cb) return;
              const reactionData = payload.new || payload.old;
              if (!reactionData?.message_id) return;
              rtLog(`Reaction event: ${payload.eventType}`);
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
                cb(reaction, 'INSERT');
              } else if (payload.eventType === 'DELETE') {
                cb(payload.old as ChatReaction, 'DELETE');
              }
            } catch (e) {
              logger.error(TAG, 'onReaction callback error', e);
            }
          }
        ),
      onSlotSubscribed,
      (err, status) => onSlotError(key, err, status)
    );
    if (!primaryChannel) primaryChannel = ch;
  }

  if (listeners.onReadReceipt) {
    const key = `${groupChannelPrefix(groupId)}reads`;
    subscribeGroupSlot(
      key,
      () =>
        supabase.channel(key).on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_message_reads',
            filter: `group_id=eq.${groupId}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            try {
              const cb = getGroupListeners(groupId)?.onReadReceipt;
              if (!cb) return;
              const read = payload.new as { message_id: string; user_id: string; group_id: string };
              if (read?.message_id && read?.user_id) {
                cb(read);
              }
            } catch (e) {
              logger.error(TAG, 'onReadReceipt callback error', e);
            }
          }
        ),
      onSlotSubscribed,
      (err, status) => onSlotError(key, err, status)
    );
  }

  if (listeners.onTyping) {
    const key = `${groupChannelPrefix(groupId)}typing`;
    subscribeGroupSlot(
      key,
      () =>
        supabase.channel(key).on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_typing_indicators',
            filter: `group_id=eq.${groupId}`,
          },
          async () => {
            try {
              const cb = getGroupListeners(groupId)?.onTyping;
              if (!cb) return;
              const { data } = await supabase
                .from('chat_typing_indicators')
                .select(`*, user:users (id, display_name)`)
                .eq('group_id', groupId)
                .neq('user_id', userId);
              if (data) {
                cb(data as any);
              }
            } catch (e) {
              logger.error(TAG, 'onTyping callback error', e);
            }
          }
        ),
      onSlotSubscribed,
      (err, status) => onSlotError(key, err, status)
    );
  }

  if (listeners.onMember) {
    const keyIn = `${groupChannelPrefix(groupId)}members-in`;
    subscribeGroupSlot(
      keyIn,
      () =>
        supabase.channel(keyIn).on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_group_members', filter: `group_id=eq.${groupId}` },
          (payload: RealtimePostgresChangesPayload<any>) => {
            getGroupListeners(groupId)?.onMember?.(payload.new, 'INSERT');
          }
        ),
      onSlotSubscribed,
      (err, status) => onSlotError(keyIn, err, status)
    );

    const keyOut = `${groupChannelPrefix(groupId)}members-out`;
    subscribeGroupSlot(
      keyOut,
      () =>
        supabase.channel(keyOut).on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'chat_group_members', filter: `group_id=eq.${groupId}` },
          (payload: RealtimePostgresChangesPayload<any>) => {
            getGroupListeners(groupId)?.onMember?.(payload.old, 'DELETE');
          }
        ),
      onSlotSubscribed,
      (err, status) => onSlotError(keyOut, err, status)
    );
  }

  if (listeners.onGroup) {
    const key = `${groupChannelPrefix(groupId)}group`;
    subscribeGroupSlot(
      key,
      () =>
        supabase.channel(key).on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'chat_groups', filter: `id=eq.${groupId}` },
          (payload: RealtimePostgresChangesPayload<any>) => {
            getGroupListeners(groupId)?.onGroup?.(payload.new, 'UPDATE');
          }
        ),
      onSlotSubscribed,
      (err, status) => onSlotError(key, err, status)
    );
  }

  return primaryChannel ?? activeChannels.get(slotKeys[0]) ?? null;
}

// ============================================
// Unsubscribe
// ============================================

export async function unsubscribeFromGroup(groupId: string): Promise<void> {
  groupSubscribeGeneration.set(
    groupId,
    (groupSubscribeGeneration.get(groupId) ?? 0) + 1,
  );
  cancelRetry(groupId);
  failedChannels.delete(groupId);
  groupListenersMap.delete(groupId);
  await teardownGroupChannels(groupId);

  // Clean up all typing timers for this group (keyed as groupId-userId)
  for (const [key, timer] of typingTimers.entries()) {
    if (key.startsWith(`${groupId}-`)) {
      clearTimeout(timer);
      typingTimers.delete(key);
    }
  }
}

export function unsubscribeAll(): void {
  membershipSubscribeGeneration += 1;
  for (const groupId of groupSubscribeGeneration.keys()) {
    groupSubscribeGeneration.set(
      groupId,
      (groupSubscribeGeneration.get(groupId) ?? 0) + 1,
    );
  }
  membershipCallbacks = null;
  membershipCallbacksUserId = null;
  retryTimers.forEach((timer) => { clearTimeout(timer); });
  retryTimers.clear();
  failedChannels.clear();
  activeChannels.clear();
  groupListenersMap.clear();
  void supabase.removeAllChannels().catch(() => {
    /* ignore */
  });
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
    // אחרי signOut אין סשן — RLS על users דוחה; לא מציפים לוג שגיאה ב-logout
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      logger.debug(TAG, 'Skipping online status update — no session');
      return { error: null };
    }

    const { error } = await supabase
      .from('users')
      .update({ is_online: isOnline, last_active: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      const msg = error.message || '';
      const softFail =
        /permission denied|row-level security|JWT|not authenticated|401|42501/i.test(msg) ||
        isTransientNetworkMessage(msg);
      if (softFail) {
        // רשת/רקע/logout — presence best-effort; לא LogBox/Sentry Error
        logger.debug(TAG, `Online status update soft-failed: ${msg}`);
        return { error: null };
      }
      logger.error(TAG, `Error updating online status: ${msg}`);
      return { error: { code: 'UPDATE_STATUS_ERROR', message: msg } };
    }
    return { error: null };
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (
      /permission denied|row-level security|JWT|not authenticated/i.test(msg) ||
      isTransientNetworkMessage(msg)
    ) {
      logger.debug(TAG, `Online status update soft-failed: ${msg}`);
      return { error: null };
    }
    logger.error(TAG, `Unexpected error updating online status: ${msg}`);
    return { error: { code: 'UNEXPECTED_ERROR', message: msg } };
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
  onGroupUpdate: (groupId: string, data: any) => void,
  onMembershipRemoved?: (groupId: string) => void,
  options?: { force?: boolean }
): Promise<RealtimeChannel | null> {
  /**
   * שני מנויי postgres_changes על אותו channel מפיקים אצל Supabase
   * "mismatch between server and client bindings for postgres changes" — לכן
   * מפרידים ל־2 ערוצים.
   */
  const baseName = `user-membership:${userId}`;
  const nameMessages = `${baseName}:messages`;
  const nameMembers = `${baseName}:members`;

  membershipCallbacks = { onNewMessage, onGroupUpdate, onMembershipRemoved };
  membershipCallbacksUserId = userId;

  const retryCount = failedChannels.get(baseName) ?? 0;
  if (retryCount >= MAX_RETRIES && !options?.force) {
    logger.warn(TAG, `Skipping subscription to ${baseName} - max retries reached`);
    return null;
  }

  const membershipKeys = [nameMessages, nameMembers];
  const alreadyLive =
    areChannelsAlive(membershipKeys) &&
    !retryTimers.has(baseName);

  if (!options?.force && alreadyLive) {
    rtLog(`Membership channels already alive for ${userId} — callbacks refreshed`);
    return activeChannels.get(nameMessages) ?? null;
  }

  if (!options?.force && activeChannels.has(nameMessages) && !alreadyLive) {
    rtLog(`Membership channels zombie — forcing resubscribe for ${userId}`);
  }

  const generation = ++membershipSubscribeGeneration;
  cancelRetry(baseName);
  if (options?.force) {
    failedChannels.delete(baseName);
  }
  await teardownMembershipChannels(userId);

  await waitForRealtimeSession();
  if (generation !== membershipSubscribeGeneration) {
    rtLog(`Stale membership subscribe aborted for ${userId}`);
    return null;
  }

  const { data: memberships } = await supabase
    .from('chat_group_members')
    .select('group_id')
    .eq('user_id', userId);

  const userGroups = new Set<string>(memberships?.map(m => m.group_id) || []);
  userGroupsCache.set(userId, userGroups);

  if (generation !== membershipSubscribeGeneration) {
    logger.debug(TAG, `Stale membership subscribe aborted after fetch for ${userId}`);
    return null;
  }

  rtLog(`User is member of ${userGroups.size} groups — subscribing membership`);

  let errorTeardownOnce = false;
  const handleError = (from: string, err: unknown, status: string) => {
    if (generation !== membershipSubscribeGeneration) return;
    if (errorTeardownOnce) return;
    errorTeardownOnce = true;
    logSubscribeFailure(from, err, status);
    rtLog(`Membership channel failure (${status}) from ${from} — scheduling retry`);
    void teardownMembershipChannels(userId).then(() => {
      if (generation !== membershipSubscribeGeneration) return;
      scheduleRetry(baseName, () => {
        const cb = membershipCallbacks;
        if (!cb || membershipCallbacksUserId !== userId) return;
        void subscribeToAllUserGroups(
          userId,
          cb.onNewMessage,
          cb.onGroupUpdate,
          cb.onMembershipRemoved
        );
      });
    });
  };

  let subMessagesOk = false;
  let subMembersOk = false;
  const onBothSubscribed = () => {
    if (subMessagesOk && subMembersOk) {
      failedChannels.delete(baseName);
      connectionStatusCallback?.('CONNECTED');
      rtLog(`Membership channels ready for ${userId}`);
    }
  };

  const chMessages = supabase
    .channel(nameMessages)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      async (payload: RealtimePostgresChangesPayload<any>) => {
        const cb = membershipCallbacks;
        if (!cb || membershipCallbacksUserId !== userId) return;

        const newMessage = payload.new as ChatMessage;
        const groupId = newMessage.group_id;
        const currentUserGroups = userGroupsCache.get(userId);

        if (!currentUserGroups?.has(groupId)) return;
        if (newMessage.sender_id === userId) return;
        if (newMessage.is_silent || newMessage.is_system_message) return;

        rtLog(`Membership INSERT msg=${newMessage.id} group=${groupId}`);
        cb.onNewMessage(groupId, newMessage);
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        handleError(nameMessages, err ?? status, status);
      } else if (status === 'SUBSCRIBED') {
        subMessagesOk = true;
        rtLog(`Subscribed: ${nameMessages}`);
        onBothSubscribed();
      }
    });

  const chMembers = supabase
    .channel(nameMembers)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_group_members',
        filter: `user_id=eq.${userId}`,
      },
      async (payload: RealtimePostgresChangesPayload<any>) => {
        const cb = membershipCallbacks;
        if (!cb || membershipCallbacksUserId !== userId) return;

        if (payload.eventType === 'INSERT') {
          userGroupsCache.get(userId)?.add(payload.new.group_id);
        } else if (payload.eventType === 'DELETE') {
          const removedGroupId = payload.old?.group_id;
          if (removedGroupId) {
            userGroupsCache.get(userId)?.delete(removedGroupId);
            cb.onMembershipRemoved?.(removedGroupId);
          }
        } else if (payload.eventType === 'UPDATE') {
          rtLog(
            `Membership UPDATE group=${payload.new.group_id} unread=${payload.new.unread_count}`,
          );
          cb.onGroupUpdate(payload.new.group_id, {
            unread_count: payload.new.unread_count,
            mentioned_count: payload.new.mentioned_count,
          });
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        handleError(nameMembers, err ?? status, status);
      } else if (status === 'SUBSCRIBED') {
        subMembersOk = true;
        rtLog(`Subscribed: ${nameMembers}`);
        onBothSubscribed();
      }
    });

  activeChannels.set(nameMessages, chMessages);
  activeChannels.set(nameMembers, chMembers);
  return chMessages;
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

/** איפוס מונה כשלונות וניסיון חיבור מחדש (למשל אחרי חזרה ל-foreground) */
export async function reconnectChatRealtime(
  userId: string,
  onNewMessage: (groupId: string, message: ChatMessage) => void,
  onGroupUpdate: (groupId: string, data: any) => void,
  onMembershipRemoved?: (groupId: string) => void,
  activeGroupId?: string | null,
  activeGroupListeners?: GroupRealtimeListeners
): Promise<void> {
  rtLog(`reconnectChatRealtime start user=${userId} activeGroup=${activeGroupId ?? 'none'}`);
  clearFailedChannels();
  await ensureRealtimeAuth();

  // קודם group (await teardown→subscribe) ואז membership — מונע race על אותו socket ב-Android
  if (activeGroupId && activeGroupListeners) {
    clearFailedChannel(activeGroupId);
    await unsubscribeFromGroup(activeGroupId);
    await subscribeToGroup(activeGroupId, userId, activeGroupListeners);
  }

  await subscribeToAllUserGroups(
    userId,
    onNewMessage,
    onGroupUpdate,
    onMembershipRemoved,
    { force: true }
  );
  rtLog('reconnectChatRealtime done');
}

export function clearFailedChannel(groupId: string): void {
  failedChannels.delete(groupId);
}

/** Health check — true אם membership channels joined. */
export function isMembershipRealtimeHealthy(userId: string): boolean {
  const baseName = `user-membership:${userId}`;
  return areChannelsJoined([`${baseName}:messages`, `${baseName}:members`]);
}

export const chatRealtimeService = {
  subscribeToGroup,
  isGroupRealtimeSubscribed,
  isMembershipRealtimeHealthy,
  enrichChatMessageSender,
  enrichChatMessagesSenders,
  normalizeChatSender,
  hasUsableSender,
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
  reconnectChatRealtime,
  ensureRealtimeAuth,
  onConnectionStatusChange,
  clearUserGroupsCache,
};
