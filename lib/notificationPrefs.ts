/**
 * מקור אמת יחיד להעדפות התראות.
 * מסך ההגדרות, מסכי פנים (מעקב / רשימה / צ'אט) וה-handler קוראים וכותבים כאן.
 * שכבת השתקת קבוצה — ראו notificationGroupMute.ts (אותו store לשני המסכים).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  asIndicatorKeys,
  asSymbolList,
  resolveAlertScope,
  type NotificationAlertScope,
} from './notificationAlertScope';
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
  'dark_pool_feed_trade',
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
  'insiderFeedAlerts',
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
  'insiderFeedAlerts',
  'darkPoolTickerAlerts',
  'watchlistNotifications',
  'newsNotifications',
  'earningsNotifications',
  'economicCalendarNotifications',
] as const;

export type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORY_KEYS)[number];

export type { NotificationAlertScope };

export type NotificationPrefs = Record<NotificationPrefKey, boolean> & {
  newsSound: string;
  recordingSound: string;
  earningsAlertScope: NotificationAlertScope;
  earningsAlertSymbols: string[];
  watchlistAlertScope: NotificationAlertScope;
  /** null = כל טיקרי המעקב דלוקים. מערך = המתגים שהמשתמש סימן. */
  watchlistAlertSymbols: string[] | null;
  economicAlertScope: NotificationAlertScope;
  economicAlertIndicators: string[];
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  notifications: true,
  sound: true,
  vibration: true,
  messageNotifications: true,
  communityNotifications: true,
  darkPoolNotifications: true,
  insiderFeedAlerts: false,
  darkPoolTickerAlerts: true,
  watchlistNotifications: true,
  newsNotifications: true,
  earningsNotifications: true,
  economicCalendarNotifications: true,
  newsSound: 'default',
  recordingSound: 'default',
  earningsAlertScope: 'all',
  earningsAlertSymbols: [],
  watchlistAlertScope: 'all',
  watchlistAlertSymbols: null,
  economicAlertScope: 'all',
  economicAlertIndicators: [],
};

export const PREF_TO_DB_COLUMN: Record<NotificationPrefKey, string> = {
  notifications: 'notifications_enabled',
  sound: 'sound_enabled',
  vibration: 'vibration_enabled',
  messageNotifications: 'message_notifications',
  communityNotifications: 'community_notifications',
  darkPoolNotifications: 'dark_pool_notifications',
  insiderFeedAlerts: 'insider_feed_alerts',
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
  dark_pool_feed_trade: 'insiderFeedAlerts',
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
    insiderFeedAlerts: asBool(
      src.insiderFeedAlerts,
      DEFAULT_NOTIFICATION_PREFS.insiderFeedAlerts,
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
    earningsAlertScope: resolveAlertScope(
      src.earningsAlertScope,
      asBool(src.earningsNotifications, DEFAULT_NOTIFICATION_PREFS.earningsNotifications),
    ),
    earningsAlertSymbols: asSymbolList(src.earningsAlertSymbols),
    watchlistAlertScope: resolveAlertScope(
      src.watchlistAlertScope,
      asBool(src.watchlistNotifications, DEFAULT_NOTIFICATION_PREFS.watchlistNotifications),
    ),
    watchlistAlertSymbols:
      src.watchlistAlertSymbols == null ? null : asSymbolList(src.watchlistAlertSymbols),
    economicAlertScope: resolveAlertScope(
      src.economicAlertScope,
      asBool(
        src.economicCalendarNotifications,
        DEFAULT_NOTIFICATION_PREFS.economicCalendarNotifications,
      ),
    ),
    economicAlertIndicators: asIndicatorKeys(src.economicAlertIndicators),
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
    insiderFeedAlerts: row.insider_feed_alerts,
    darkPoolTickerAlerts: row.dark_pool_ticker_alerts,
    watchlistNotifications: row.watchlist_notifications,
    newsNotifications: row.news_notifications,
    earningsNotifications: row.earnings_notifications,
    economicCalendarNotifications: row.economic_calendar_notifications,
    newsSound: row.news_sound,
    recordingSound: row.recording_sound,
    earningsAlertScope: row.earnings_alert_scope,
    earningsAlertSymbols: row.earnings_alert_symbols,
    watchlistAlertScope: row.watchlist_alert_scope,
    watchlistAlertSymbols: row.watchlist_alert_symbols,
    economicAlertScope: row.economic_alert_scope,
    economicAlertIndicators: row.economic_alert_indicators,
  });
}

/**
 * `news_sound` בטבלה הוא boolean, ו-`recording_sound` לא קיימת.
 * שליחת מחרוזת צליל או עמודה חסרה מפילה את כל ה-upsert, והבחירות נעלמות בטעינה מחדש.
 * צליל החדשות נשאר בעמודה הבוליאנית; שם הצליל נשמר רק מקומית.
 */
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
    insider_feed_alerts: prefs.insiderFeedAlerts,
    dark_pool_ticker_alerts: prefs.darkPoolTickerAlerts,
    watchlist_notifications: prefs.watchlistNotifications,
    news_notifications: prefs.newsNotifications,
    earnings_notifications: prefs.earningsNotifications,
    economic_calendar_notifications: prefs.economicCalendarNotifications,
    earnings_alert_scope: prefs.earningsAlertScope,
    earnings_alert_symbols: prefs.earningsAlertSymbols,
    watchlist_alert_scope: prefs.watchlistAlertScope,
    watchlist_alert_symbols: prefs.watchlistAlertSymbols,
    economic_alert_scope: prefs.economicAlertScope,
    economic_alert_indicators: prefs.economicAlertIndicators,
  };
}

function listColumnEmpty(value: unknown): boolean {
  return value == null || (Array.isArray(value) && value.length === 0);
}

/** עמודה חסרה, NULL, או עדיין ברירת המחדל של המיגרציה — הבחירה לא נכתבה לשרת. */
function alertScopeUnpersisted(
  row: Record<string, unknown>,
  scopeKey: string,
  listKey: string | null,
  categoryOn: boolean,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(row, scopeKey) || row[scopeKey] == null) {
    return true;
  }
  const list = listKey == null ? null : row[listKey];
  if (!listColumnEmpty(list)) return false;
  return categoryOn ? row[scopeKey] === 'all' : row[scopeKey] === 'selected';
}

/**
 * כשהשרת לא קיבל את הבחירה (עמודה חסרה, או upsert שנכשל והשאיר «הכול»),
 * נשארים עם מה שנשמר במכשיר.
 */
export function mergeUnpersistedAlertChoices(
  fromDb: NotificationPrefs,
  local: NotificationPrefs,
  row: Record<string, unknown>,
): NotificationPrefs {
  const next = { ...fromDb };
  if (row.recording_sound == null) {
    next.recordingSound = local.recordingSound;
  }
  if (
    alertScopeUnpersisted(
      row,
      'earnings_alert_scope',
      'earnings_alert_symbols',
      next.earningsNotifications,
    )
  ) {
    next.earningsAlertScope = local.earningsAlertScope;
    next.earningsAlertSymbols = local.earningsAlertSymbols;
  }
  if (
    alertScopeUnpersisted(row, 'watchlist_alert_scope', 'watchlist_alert_symbols', next.watchlistNotifications)
  ) {
    next.watchlistAlertScope = local.watchlistAlertScope;
  }
  if (listColumnEmpty(row.watchlist_alert_symbols) && local.watchlistAlertSymbols != null) {
    next.watchlistAlertSymbols = local.watchlistAlertSymbols;
  }
  if (
    alertScopeUnpersisted(
      row,
      'economic_alert_scope',
      'economic_alert_indicators',
      next.economicCalendarNotifications,
    )
  ) {
    next.economicAlertScope = local.economicAlertScope;
    next.economicAlertIndicators = local.economicAlertIndicators;
  }
  return next;
}

function alertChoicesDiffer(a: NotificationPrefs, b: NotificationPrefs): boolean {
  return (
    a.earningsAlertScope !== b.earningsAlertScope ||
    a.watchlistAlertScope !== b.watchlistAlertScope ||
    a.economicAlertScope !== b.economicAlertScope ||
    JSON.stringify(a.earningsAlertSymbols) !== JSON.stringify(b.earningsAlertSymbols) ||
    JSON.stringify(a.watchlistAlertSymbols) !== JSON.stringify(b.watchlistAlertSymbols) ||
    JSON.stringify(a.economicAlertIndicators) !== JSON.stringify(b.economicAlertIndicators)
  );
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
let prefsRevision = 0;
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
  prefsRevision = 0;
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
  const revisionAtStart = prefsRevision;
  const stale = () => prefsRevision !== revisionAtStart && cachedPrefs != null;
  try {
    if (uid) {
      const { data, error } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
      if (stale()) return { ...cachedPrefs! };
      if (data && !error) {
        const row = data as Record<string, unknown>;
        let prefs = prefsFromDbRow(row);
        const saved = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
        if (stale()) return { ...cachedPrefs! };
        if (saved) {
          const local = parseNotificationPrefs(JSON.parse(saved));
          prefs = mergeUnpersistedAlertChoices(prefs, local, row);
        }
        if (stale()) return { ...cachedPrefs! };
        const shouldWriteBack = alertChoicesDiffer(prefs, prefsFromDbRow(row));
        await writeLocal(prefs);
        if (stale()) {
          await writeLocal(cachedPrefs!);
          return { ...cachedPrefs! };
        }
        emitPrefs(prefs);
        if (shouldWriteBack) {
          try {
            await writeDb(uid, prefs);
          } catch {
            /* columns still missing — local already has the choice */
          }
        }
        return prefs;
      }
    }
    const saved = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
    if (stale()) return { ...cachedPrefs! };
    if (saved) {
      const prefs = parseNotificationPrefs(JSON.parse(saved));
      if (stale()) return { ...cachedPrefs! };
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
    if (cachedPrefs) return { ...cachedPrefs };
  }
  if (cachedPrefs && prefsRevision !== revisionAtStart) return { ...cachedPrefs };
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS };
  emitPrefs(prefs);
  return prefs;
}

export async function saveNotificationPrefs(
  prefs: NotificationPrefs,
  userId?: string | null,
): Promise<void> {
  prefsRevision += 1;
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

export type NotificationScopePatch = Partial<
  Pick<
    NotificationPrefs,
    | 'earningsAlertScope'
    | 'earningsAlertSymbols'
    | 'watchlistAlertScope'
    | 'watchlistAlertSymbols'
    | 'economicAlertScope'
    | 'economicAlertIndicators'
  >
>;

export async function patchNotificationPrefs(
  patch: NotificationScopePatch,
  userId?: string | null,
): Promise<NotificationPrefs> {
  const current = cachedPrefs ?? (await loadNotificationPrefs(userId));
  const next = { ...current, ...patch };
  await saveNotificationPrefs(next, userId);
  return next;
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
