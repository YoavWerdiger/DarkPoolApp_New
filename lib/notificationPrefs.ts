/**
 * מקור אמת יחיד להעדפות התראות.
 * מסך ההגדרות, מסכי פנים (מעקב / רשימה / צ'אט) וה-handler קוראים וכותבים כאן.
 * שכבת השתקת קבוצה — ראו notificationGroupMute.ts (אותו store לשני המסכים).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const NOTIFICATION_SETTINGS_STORAGE_KEY = 'notificationSettings';

/** מקורות ששולחים בפועל בקוד — בלי להמציא טיפוסים */
export const KNOWN_NOTIFICATION_SOURCES = [
  'chat_message',
  'community_mention',
  'community_post',
  'dark_pool_person_trade',
  'dark_pool_fund_13f',
  'dark_pool_follow',
  'dark_pool_signal',
  'watchlist_alert',
  'news',
  'earnings',
  'earnings_results',
  'economic_calendar',
  'economic_result',
] as const;

export type KnownNotificationSource = (typeof KNOWN_NOTIFICATION_SOURCES)[number];

export const NOTIFICATION_PREF_KEYS = [
  'notifications',
  'sound',
  'vibration',
  'messageNotifications',
  'communityNotifications',
  'darkPoolNotifications',
  'darkPoolTickerAlerts',
  'watchlistNotifications',
  'newsNotifications',
  'earningsNotifications',
  'economicCalendarNotifications',
] as const;

export type NotificationPrefKey = (typeof NOTIFICATION_PREF_KEYS)[number];

/** קטגוריות שנשלחות — כבוי-מאסטר מכבה אותן בפועל */
export const NOTIFICATION_CATEGORY_KEYS = [
  'messageNotifications',
  'communityNotifications',
  'darkPoolNotifications',
  'darkPoolTickerAlerts',
  'watchlistNotifications',
  'newsNotifications',
  'earningsNotifications',
  'economicCalendarNotifications',
] as const;

export type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORY_KEYS)[number];

export type NotificationPrefs = Record<NotificationPrefKey, boolean> & {
  newsSound: string;
  recordingSound: string;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  notifications: true,
  sound: true,
  vibration: true,
  messageNotifications: true,
  communityNotifications: true,
  darkPoolNotifications: true,
  darkPoolTickerAlerts: true,
  watchlistNotifications: true,
  newsNotifications: true,
  earningsNotifications: true,
  economicCalendarNotifications: true,
  newsSound: 'default',
  recordingSound: 'default',
};

export const PREF_TO_DB_COLUMN: Record<NotificationPrefKey, string> = {
  notifications: 'notifications_enabled',
  sound: 'sound_enabled',
  vibration: 'vibration_enabled',
  messageNotifications: 'message_notifications',
  communityNotifications: 'community_notifications',
  darkPoolNotifications: 'dark_pool_notifications',
  darkPoolTickerAlerts: 'dark_pool_ticker_alerts',
  watchlistNotifications: 'watchlist_notifications',
  newsNotifications: 'news_notifications',
  earningsNotifications: 'earnings_notifications',
  economicCalendarNotifications: 'economic_calendar_notifications',
};

const SOURCE_TO_PREF: Record<string, NotificationCategoryKey> = {
  chat_message: 'messageNotifications',
  community_mention: 'communityNotifications',
  community_post: 'communityNotifications',
  dark_pool_person_trade: 'darkPoolNotifications',
  dark_pool_fund_13f: 'darkPoolNotifications',
  dark_pool_follow: 'darkPoolNotifications',
  dark_pool_signal: 'darkPoolTickerAlerts',
  watchlist_alert: 'watchlistNotifications',
  news: 'newsNotifications',
  earnings: 'earningsNotifications',
  earnings_results: 'earningsNotifications',
  economic_calendar: 'economicCalendarNotifications',
  economic_result: 'economicCalendarNotifications',
};

export function prefKeyForSource(source: string): NotificationCategoryKey | null {
  return SOURCE_TO_PREF[source] ?? null;
}

export function knownSourcesCoveredByPrefs(): boolean {
  return KNOWN_NOTIFICATION_SOURCES.every((source) => prefKeyForSource(source) != null);
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function asSound(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value === false) return 'none';
  if (value === true) return 'default';
  return fallback;
}

export function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    notifications: asBool(src.notifications, DEFAULT_NOTIFICATION_PREFS.notifications),
    sound: asBool(src.sound, DEFAULT_NOTIFICATION_PREFS.sound),
    vibration: asBool(src.vibration, DEFAULT_NOTIFICATION_PREFS.vibration),
    messageNotifications: asBool(
      src.messageNotifications,
      DEFAULT_NOTIFICATION_PREFS.messageNotifications,
    ),
    communityNotifications: asBool(
      src.communityNotifications,
      DEFAULT_NOTIFICATION_PREFS.communityNotifications,
    ),
    darkPoolNotifications: asBool(
      src.darkPoolNotifications,
      DEFAULT_NOTIFICATION_PREFS.darkPoolNotifications,
    ),
    darkPoolTickerAlerts: asBool(
      src.darkPoolTickerAlerts,
      DEFAULT_NOTIFICATION_PREFS.darkPoolTickerAlerts,
    ),
    watchlistNotifications: asBool(
      src.watchlistNotifications,
      DEFAULT_NOTIFICATION_PREFS.watchlistNotifications,
    ),
    newsNotifications: asBool(src.newsNotifications, DEFAULT_NOTIFICATION_PREFS.newsNotifications),
    earningsNotifications: asBool(
      src.earningsNotifications,
      DEFAULT_NOTIFICATION_PREFS.earningsNotifications,
    ),
    economicCalendarNotifications: asBool(
      src.economicCalendarNotifications,
      DEFAULT_NOTIFICATION_PREFS.economicCalendarNotifications,
    ),
    newsSound: asSound(src.newsSound, DEFAULT_NOTIFICATION_PREFS.newsSound),
    recordingSound: asSound(src.recordingSound, DEFAULT_NOTIFICATION_PREFS.recordingSound),
  };
}

export function prefsFromDbRow(row: Record<string, unknown> | null | undefined): NotificationPrefs {
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFS };
  return parseNotificationPrefs({
    notifications: row.notifications_enabled,
    sound: row.sound_enabled,
    vibration: row.vibration_enabled,
    messageNotifications: row.message_notifications,
    communityNotifications: row.community_notifications,
    darkPoolNotifications: row.dark_pool_notifications,
    darkPoolTickerAlerts: row.dark_pool_ticker_alerts,
    watchlistNotifications: row.watchlist_notifications,
    newsNotifications: row.news_notifications,
    earningsNotifications: row.earnings_notifications,
    economicCalendarNotifications: row.economic_calendar_notifications,
    newsSound: row.news_sound,
    recordingSound: row.recording_sound,
  });
}

export function prefsToDbRow(
  prefs: NotificationPrefs,
  userId: string,
): Record<string, unknown> {
  return {
    user_id: userId,
    notifications_enabled: prefs.notifications,
    sound_enabled: prefs.sound,
    vibration_enabled: prefs.vibration,
    message_notifications: prefs.messageNotifications,
    community_notifications: prefs.communityNotifications,
    dark_pool_notifications: prefs.darkPoolNotifications,
    dark_pool_ticker_alerts: prefs.darkPoolTickerAlerts,
    watchlist_notifications: prefs.watchlistNotifications,
    news_notifications: prefs.newsNotifications,
    earnings_notifications: prefs.earningsNotifications,
    economic_calendar_notifications: prefs.economicCalendarNotifications,
    news_sound: prefs.newsSound,
    recording_sound: prefs.recordingSound,
  };
}

/** מאסטר כבוי → כל קטגוריית שליחה כבויה בפועל. צליל/רטט נשארים העדפת מכשיר. */
export function isPrefEffective(prefs: NotificationPrefs, key: NotificationPrefKey): boolean {
  if (key === 'notifications') return prefs.notifications;
  if (key === 'sound' || key === 'vibration') return prefs[key];
  return prefs.notifications && prefs[key];
}

export function shouldDeliverNotification(
  prefs: NotificationPrefs,
  source: string,
): boolean {
  if (!prefs.notifications) return false;
  const key = prefKeyForSource(source);
  if (!key) return prefs.notifications;
  return prefs[key] !== false;
}

export function applyPrefToggle(
  prefs: NotificationPrefs,
  key: NotificationPrefKey,
  value: boolean,
): NotificationPrefs {
  return { ...prefs, [key]: value };
}

let cachedPrefs: NotificationPrefs | null = null;
const listeners = new Set<(prefs: NotificationPrefs) => void>();

export function getCachedNotificationPrefs(): NotificationPrefs | null {
  return cachedPrefs ? { ...cachedPrefs } : null;
}

export function subscribeNotificationPrefs(
  fn: (prefs: NotificationPrefs) => void,
): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emitPrefs(prefs: NotificationPrefs) {
  cachedPrefs = prefs;
  for (const fn of listeners) fn(prefs);
}

export function resetNotificationPrefsCache() {
  cachedPrefs = null;
}

async function writeLocal(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(prefs));
}

async function resolveUserId(userId?: string | null): Promise<string | null> {
  if (userId) return userId;
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function writeDb(userId: string, prefs: NotificationPrefs): Promise<void> {
  const { error } = await supabase.from('user_notification_settings').upsert(
    prefsToDbRow(prefs, userId),
    { onConflict: 'user_id' },
  );
  if (error) {
    throw error;
  }
}

export async function loadNotificationPrefs(userId?: string | null): Promise<NotificationPrefs> {
  const uid = await resolveUserId(userId);
  try {
    if (uid) {
      const { data, error } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
      if (data && !error) {
        const prefs = prefsFromDbRow(data as Record<string, unknown>);
        await writeLocal(prefs);
        emitPrefs(prefs);
        return prefs;
      }
    }
    const saved = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
    if (saved) {
      const prefs = parseNotificationPrefs(JSON.parse(saved));
      emitPrefs(prefs);
      if (uid) {
        try {
          await writeDb(uid, prefs);
        } catch {
          /* offline / missing columns — local still wins */
        }
      }
      return prefs;
    }
  } catch {
    /* fall through to defaults */
  }
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS };
  emitPrefs(prefs);
  return prefs;
}

export async function saveNotificationPrefs(
  prefs: NotificationPrefs,
  userId?: string | null,
): Promise<void> {
  emitPrefs(prefs);
  await writeLocal(prefs);
  const uid = await resolveUserId(userId);
  if (uid) {
    try {
      await writeDb(uid, prefs);
    } catch {
      /* local cache already updated */
    }
  }
}

export async function updateNotificationPref(
  key: NotificationPrefKey,
  value: boolean,
  userId?: string | null,
): Promise<NotificationPrefs> {
  const current = cachedPrefs ?? (await loadNotificationPrefs(userId));
  const next = applyPrefToggle(current, key, value);
  await saveNotificationPrefs(next, userId);
  return next;
}

/** מסך פנימי שמדליק התראה — כותב לאותו store, בלי לגעת במאסטר */
export async function ensureNotificationCategoryOn(
  key: NotificationCategoryKey,
  userId?: string | null,
): Promise<NotificationPrefs> {
  const current = cachedPrefs ?? (await loadNotificationPrefs(userId));
  if (current[key]) return current;
  return updateNotificationPref(key, true, userId);
}
