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

/** קריאה סינכרונית לקאש שולחים — ציור מיידי בלי RPC. */
export function peekCachedSender(userId: string | null | undefined): ChatSenderProfile | null {
  if (!userId) return null;
  const cached = userCache.get(userId);
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return {
    id: cached.data.id,
    display_name: cached.data.display_name,
    profile_picture: cached.data.profile_picture,
  };
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

/**
 * Broadcast מה-DB (ערוצים פרטיים) — במקום postgres_changes:
 * - `chat-group:<id>` — הודעות/ריאקציות/חברים/פרטי קבוצה/«מקליד...» (טריגרים ב-DB)
 * - `chat-user:<id>` — הצטרפות/הסרה מקבוצה + אישורי קריאה על ההודעות שלי
 * הרשאה נבדקת פעם אחת בהצטרפות (RLS על realtime.messages) — לא לכל הודעה ולכל מנוי.
 */
function groupTopic(groupId: string): string {
  return `chat-group:${groupId}`;
}

function userTopic(userId: string): string {
  return `chat-user:${userId}`;
}

/** True when the group's broadcast channel is actually joined (not a zombie Map entry). */
export function isGroupRealtimeSubscribed(groupId: string): boolean {
  return isChannelJoined(activeChannels.get(groupTopic(groupId)));
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

/** משתמש שהערוצים הנוכחיים שייכים לו (לסינון הודעות שלי / typing של עצמי) */
let hubUserId: string | null = null;
/** «מקליד...» לפי קבוצה — מצב מקומי מאירועי broadcast, פג אחרי TYPING_TTL_MS */
const TYPING_TTL_MS = 6000;
const typingByGroup = new Map<
  string,
  Map<string, { indicator: ChatTypingIndicator; timer: ReturnType<typeof setTimeout> }>
>();

function emitTyping(groupId: string): void {
  const cb = getGroupListeners(groupId)?.onTyping;
  if (!cb) return;
  const map = typingByGroup.get(groupId);
  cb(map ? [...map.values()].map((v) => v.indicator) : []);
}

function clearTypingForGroup(groupId: string): void {
  const map = typingByGroup.get(groupId);
  if (!map) return;
  map.forEach((v) => clearTimeout(v.timer));
  typingByGroup.delete(groupId);
}

function handleTypingEvent(groupId: string, payload: any): void {
  const uid = payload?.user_id as string | undefined;
  if (!uid || uid === hubUserId) return;
  let map = typingByGroup.get(groupId);
  if (!map) {
    map = new Map();
    typingByGroup.set(groupId, map);
  }
  const prev = map.get(uid);
  if (prev) clearTimeout(prev.timer);
  if (!payload.is_typing) {
    map.delete(uid);
    emitTyping(groupId);
    return;
  }
  const indicator = {
    id: `${groupId}-${uid}`,
    group_id: groupId,
    user_id: uid,
    started_typing_at: new Date().toISOString(),
    user: { id: uid, display_name: payload.display_name || peekCachedSender(uid)?.display_name || '' },
  } as unknown as ChatTypingIndicator;
  const timer = setTimeout(() => {
    typingByGroup.get(groupId)?.delete(uid);
    emitTyping(groupId);
  }, TYPING_TTL_MS);
  map.set(uid, { indicator, timer });
  emitTyping(groupId);
}

function handleGroupMessageEvent(groupId: string, kind: 'INSERT' | 'UPDATE' | 'DELETE', payload: any): void {
  const message = payload as ChatMessage;
  if (!message?.id) return;
  rtLog(`Message event: ${kind} ${message.id}`);

  // רשימת הצ'אטים (badge / preview) — כמו ה-membership channel הקודם
  if (kind === 'INSERT') {
    const cb = membershipCallbacks;
    if (
      cb &&
      hubUserId &&
      membershipCallbacksUserId === hubUserId &&
      message.sender_id !== hubUserId &&
      !message.is_silent &&
      !message.is_system_message
    ) {
      try {
        cb.onNewMessage(groupId, message);
      } catch (e) {
        logger.error(TAG, 'onNewMessage callback error', e);
      }
    }
    // הודעה מהמשתמש שהקליד — מנקים את ה«מקליד...» שלו מיד
    if (message.sender_id && typingByGroup.get(groupId)?.has(message.sender_id)) {
      handleTypingEvent(groupId, { user_id: message.sender_id, is_typing: false });
    }
  }

  // הצ'אט הפתוח
  const onMessage = getGroupListeners(groupId)?.onMessage;
  if (!onMessage) return;
  try {
    onMessage(message, kind);
  } catch (e) {
    logger.error(TAG, 'onMessage callback error', e);
  }
}

async function handleReactionEvent(groupId: string, payload: any): Promise<void> {
  const cb = getGroupListeners(groupId)?.onReaction;
  const row = payload?.row as ChatReaction | undefined;
  if (!cb || !row?.message_id) return;
  try {
    if (payload.op === 'INSERT') {
      if (row.user_id) {
        const userData = await getCachedUser(row.user_id);
        if (userData) {
          row.user = {
            id: userData.id,
            display_name: userData.display_name,
            profile_picture: userData.profile_picture,
          };
        }
      }
      cb(row, 'INSERT');
    } else if (payload.op === 'DELETE') {
      cb(row, 'DELETE');
    }
  } catch (e) {
    logger.error(TAG, 'onReaction callback error', e);
  }
}

/**
 * ערוץ broadcast אחד לקבוצה — משותף לרשימת הצ'אטים ולצ'אט הפתוח.
 * idempotent: ערוץ חי (joined/joining) מוחזר כמו שהוא.
 */
function ensureGroupTopic(groupId: string): RealtimeChannel {
  const key = groupTopic(groupId);
  const existing = activeChannels.get(key);
  if (existing && (existing.state === 'joined' || existing.state === 'joining')) {
    return existing;
  }
  if (existing) {
    activeChannels.delete(key);
    void supabase.removeChannel(existing).catch(() => undefined);
  }

  const generation = (groupSubscribeGeneration.get(groupId) ?? 0) + 1;
  groupSubscribeGeneration.set(groupId, generation);
  cancelRetry(key);

  const channel = supabase
    .channel(key, { config: { private: true, broadcast: { self: false, ack: false } } })
    .on('broadcast', { event: 'message_insert' }, ({ payload }) =>
      handleGroupMessageEvent(groupId, 'INSERT', payload),
    )
    .on('broadcast', { event: 'message_update' }, ({ payload }) =>
      handleGroupMessageEvent(groupId, 'UPDATE', payload),
    )
    .on('broadcast', { event: 'message_delete' }, ({ payload }) =>
      handleGroupMessageEvent(groupId, 'DELETE', payload),
    )
    .on('broadcast', { event: 'reaction' }, ({ payload }) => {
      void handleReactionEvent(groupId, payload);
    })
    .on('broadcast', { event: 'member' }, ({ payload }) => {
      const op = payload?.op as 'INSERT' | 'DELETE' | undefined;
      if (!op) return;
      getGroupListeners(groupId)?.onMember?.(payload.row, op);
    })
    .on('broadcast', { event: 'group' }, ({ payload }) => {
      if (payload) getGroupListeners(groupId)?.onGroup?.(payload, 'UPDATE');
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => handleTypingEvent(groupId, payload));

  channel.subscribe((status, err) => {
    if (groupSubscribeGeneration.get(groupId) !== generation) return;
    if (status === 'SUBSCRIBED') {
      rtLog(`Subscribed: ${key}`);
      failedChannels.delete(key);
      connectionStatusCallback?.('CONNECTED');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      logSubscribeFailure(key, err ?? status, status);
      if (activeChannels.get(key) === channel) activeChannels.delete(key);
      void supabase.removeChannel(channel).catch(() => undefined);
      // ממשיכים לנסות רק אם עדיין רלוונטי (חבר בקבוצה או צ'אט פתוח)
      scheduleRetry(key, () => {
        if (groupSubscribeGeneration.get(groupId) !== generation) return;
        const stillMember = hubUserId ? userGroupsCache.get(hubUserId)?.has(groupId) : false;
        if (!stillMember && !groupListenersMap.has(groupId)) return;
        ensureGroupTopic(groupId);
      });
    }
  });
  activeChannels.set(key, channel);
  return channel;
}

async function removeGroupTopic(groupId: string): Promise<void> {
  groupSubscribeGeneration.set(groupId, (groupSubscribeGeneration.get(groupId) ?? 0) + 1);
  cancelRetry(groupTopic(groupId));
  failedChannels.delete(groupTopic(groupId));
  clearTypingForGroup(groupId);
  await removeChannelByKey(groupTopic(groupId));
}

function teardownMembershipChannels(userId: string): Promise<void> {
  const groupIds = [...activeChannels.keys()]
    .filter((k) => k.startsWith('chat-group:'))
    .map((k) => k.slice('chat-group:'.length));
  return Promise.all([
    removeChannelByKey(userTopic(userId)),
    ...groupIds.filter((gid) => !groupListenersMap.has(gid)).map(removeGroupTopic),
  ]).then(() => undefined);
}

function getGroupListeners(groupId: string): GroupRealtimeListeners | undefined {
  return groupListenersMap.get(groupId);
}

export async function subscribeToGroup(
  groupId: string,
  userId: string,
  listeners: GroupRealtimeListeners
): Promise<RealtimeChannel | null> {
  // תמיד מעדכנים listeners — גם כשהערוץ כבר חי (מונע stale closures אחרי resume)
  groupListenersMap.set(groupId, listeners);
  hubUserId = hubUserId ?? userId;
  await waitForRealtimeSession();
  const channel = ensureGroupTopic(groupId);
  rtLog(`Group listeners attached: ${groupId} (state=${channel.state})`);
  return channel;
}

// ============================================
// Unsubscribe
// ============================================

export async function unsubscribeFromGroup(groupId: string): Promise<void> {
  // יציאה מהצ'אט: מנתקים רק את ה-listeners של המסך. הערוץ נשאר לרשימת הצ'אטים
  // (badge / preview) כל עוד המשתמש חבר — אלא אם הוא מת, ואז מפרקים כדי ש-subscribe הבא יבנה מחדש.
  groupListenersMap.delete(groupId);
  clearTypingForGroup(groupId);
  for (const [key, timer] of typingTimers.entries()) {
    if (key.startsWith(`${groupId}-`)) {
      clearTimeout(timer);
      typingTimers.delete(key);
    }
  }
  const stillMember = hubUserId ? userGroupsCache.get(hubUserId)?.has(groupId) : false;
  if (!stillMember || !isGroupRealtimeSubscribed(groupId)) {
    await removeGroupTopic(groupId);
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
  hubUserId = null;
  typingByGroup.forEach((map) => map.forEach((v) => clearTimeout(v.timer)));
  typingByGroup.clear();
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
  // «מקליד...» = broadcast רגעי בין לקוחות בערוץ הקבוצה. בלי כתיבה למסד.
  try {
    const timerKey = `${input.group_id}-${userId}`;
    const existingTimer = typingTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      typingTimers.delete(timerKey);
    }
    const channel = activeChannels.get(groupTopic(input.group_id));
    if (!isChannelJoined(channel)) return { error: null };
    await channel!.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: userId,
        display_name: input.display_name || peekCachedSender(userId)?.display_name || '',
        is_typing: input.is_typing,
      },
    });
    if (input.is_typing) {
      // עצירה אוטומטית אם המשתמש הפסיק להקליד בלי אירוע stop
      typingTimers.set(
        timerKey,
        setTimeout(() => {
          typingTimers.delete(timerKey);
          void setTypingStatus({ ...input, is_typing: false }, userId);
        }, 4000),
      );
    }
    return { error: null };
  } catch (error: any) {
    logger.warn(TAG, `typing broadcast failed: ${error?.message ?? error}`);
    return { error: { code: 'TYPING_ERROR', message: error?.message || 'typing failed' } };
  }
}

// ============================================
// Get typing users
// ============================================

export async function getTypingUsers(
  groupId: string,
  excludeUserId?: string
): Promise<{ data: ChatTypingIndicator[] | null; error: ChatError | null }> {
  const map = typingByGroup.get(groupId);
  const list = map ? [...map.values()].map((v) => v.indicator) : [];
  return {
    data: excludeUserId ? list.filter((t) => t.user_id !== excludeUserId) : list,
    error: null,
  };
}

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
   * ערוץ broadcast לכל קבוצה שהמשתמש חבר בה (הודעות חדשות → badge/preview ברשימה)
   * + ערוץ אישי (הצטרפות/הסרה, אישורי קריאה). כל הודעה = שידור אחד לקבוצה,
   * לא בדיקת RLS לכל משתמש מחובר כמו ה-postgres_changes הגלובלי הקודם.
   */
  membershipCallbacks = { onNewMessage, onGroupUpdate, onMembershipRemoved };
  membershipCallbacksUserId = userId;
  hubUserId = userId;

  const userKey = userTopic(userId);
  const retryCount = failedChannels.get(userKey) ?? 0;
  if (retryCount >= MAX_RETRIES && !options?.force) {
    logger.warn(TAG, `Skipping subscription to ${userKey} - max retries reached`);
    return null;
  }

  if (!options?.force && isMembershipRealtimeHealthy(userId) && !retryTimers.has(userKey)) {
    rtLog(`Membership channels alive for ${userId} — callbacks refreshed`);
    return activeChannels.get(userKey) ?? null;
  }

  const generation = ++membershipSubscribeGeneration;
  cancelRetry(userKey);
  if (options?.force) {
    failedChannels.delete(userKey);
    await teardownMembershipChannels(userId);
  }

  await waitForRealtimeSession();
  if (generation !== membershipSubscribeGeneration) {
    rtLog(`Stale membership subscribe aborted for ${userId}`);
    return null;
  }

  const { data: memberships, error } = await supabase
    .from('chat_group_members')
    .select('group_id')
    .eq('user_id', userId);
  if (error) {
    logger.warn(TAG, 'membership fetch failed', error);
  }
  if (generation !== membershipSubscribeGeneration) return null;

  const userGroups = new Set<string>(memberships?.map((m) => m.group_id) || []);
  userGroupsCache.set(userId, userGroups);
  rtLog(`User is member of ${userGroups.size} groups — joining group topics`);

  // קבוצות שהמשתמש כבר לא חבר בהן (ולא פתוחות) — מפרקים
  for (const key of [...activeChannels.keys()]) {
    if (!key.startsWith('chat-group:')) continue;
    const gid = key.slice('chat-group:'.length);
    if (!userGroups.has(gid) && !groupListenersMap.has(gid)) void removeGroupTopic(gid);
  }
  userGroups.forEach((gid) => ensureGroupTopic(gid));

  // ערוץ אישי
  const existingUser = activeChannels.get(userKey);
  if (existingUser && (existingUser.state === 'joined' || existingUser.state === 'joining')) {
    return existingUser;
  }
  if (existingUser) await removeChannelByKey(userKey);

  const channel = supabase
    .channel(userKey, { config: { private: true, broadcast: { self: false, ack: false } } })
    .on('broadcast', { event: 'read' }, ({ payload }) => {
      const read = payload as { message_id: string; user_id: string; group_id: string };
      if (!read?.message_id || !read?.user_id) return;
      try {
        getGroupListeners(read.group_id)?.onReadReceipt?.(read);
      } catch (e) {
        logger.error(TAG, 'onReadReceipt callback error', e);
      }
    })
    .on('broadcast', { event: 'membership' }, ({ payload }) => {
      const cb = membershipCallbacks;
      const gid = payload?.group_id as string | undefined;
      if (!gid || membershipCallbacksUserId !== userId) return;
      if (payload.op === 'INSERT') {
        userGroupsCache.get(userId)?.add(gid);
        ensureGroupTopic(gid);
      } else if (payload.op === 'DELETE') {
        userGroupsCache.get(userId)?.delete(gid);
        if (!groupListenersMap.has(gid)) void removeGroupTopic(gid);
        cb?.onMembershipRemoved?.(gid);
      }
    });

  channel.subscribe((status, err) => {
    if (generation !== membershipSubscribeGeneration) return;
    if (status === 'SUBSCRIBED') {
      failedChannels.delete(userKey);
      connectionStatusCallback?.('CONNECTED');
      rtLog(`Subscribed: ${userKey}`);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      logSubscribeFailure(userKey, err ?? status, status);
      if (activeChannels.get(userKey) === channel) activeChannels.delete(userKey);
      void supabase.removeChannel(channel).catch(() => undefined);
      scheduleRetry(userKey, () => {
        const cb = membershipCallbacks;
        if (!cb || membershipCallbacksUserId !== userId) return;
        void subscribeToAllUserGroups(userId, cb.onNewMessage, cb.onGroupUpdate, cb.onMembershipRemoved);
      });
    }
  });
  activeChannels.set(userKey, channel);
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

/** «מקליד...» עבר ל-broadcast — אין יותר טבלה לנקות. נשמר כ-no-op לתאימות API. */
export function startTypingCleanup(): void {
  /* no-op */
}

export function stopTypingCleanup(): void {
  /* no-op */
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

/** Health check — הערוץ האישי וערוצי כל הקבוצות joined. */
export function isMembershipRealtimeHealthy(userId: string): boolean {
  if (!isChannelJoined(activeChannels.get(userTopic(userId)))) return false;
  const groups = userGroupsCache.get(userId);
  if (!groups) return false;
  for (const gid of groups) {
    if (!isChannelJoined(activeChannels.get(groupTopic(gid)))) return false;
  }
  return true;
}

export const chatRealtimeService = {
  subscribeToGroup,
  isGroupRealtimeSubscribed,
  isMembershipRealtimeHealthy,
  enrichChatMessageSender,
  enrichChatMessagesSenders,
  normalizeChatSender,
  hasUsableSender,
  peekCachedSender,
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
