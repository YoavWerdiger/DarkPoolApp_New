import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { silent } from '../utils/silentError';

/**
 * אנליטיקס (PostHog דרך HTTP — בלי ספרייה native). פעיל רק כש-EXPO_PUBLIC_POSTHOG_KEY מוגדר;
 * בלי מפתח — no-op. החלפת ספק = שינוי הקובץ הזה בלבד.
 *
 * פרטיות: לא שולחים אימייל / שם / טלפון / סכומים. מזהה = user id (UUID) או מזהה אנונימי מקומי.
 */
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com').replace(/\/$/, '');
const ENABLED = !!KEY && (Platform.OS === 'ios' || Platform.OS === 'android');
const ANON_KEY = 'analytics_anon_id_v1';

export type AnalyticsEvent =
  | 'screen_view'
  | 'signup_step'
  | 'signup_completed'
  | 'login'
  | 'purchase_started'
  | 'purchase_completed'
  | 'purchase_failed'
  | 'tab_opened'
  | 'push_permission'
  | 'watchlist_added'
  | 'message_sent'
  | 'lesson_completed';

type Props = Record<string, string | number | boolean | null | undefined>;

let distinctId: string | null = null;
let queue: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function getDistinctId(): Promise<string> {
  if (distinctId) return distinctId;
  try {
    let anon = await AsyncStorage.getItem(ANON_KEY);
    if (!anon) {
      anon = `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem(ANON_KEY, anon);
    }
    distinctId = anon;
  } catch {
    distinctId = 'anon-unknown';
  }
  return distinctId;
}

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!ENABLED || queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    await fetch(`${HOST}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: KEY, batch }),
    });
  } catch {
    // רשת נפלה — מחזירים לתור (עד 200 אירועים)
    queue = [...batch, ...queue].slice(-200);
  }
}

export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (!ENABLED) return;
  void getDistinctId().then((id) => {
    queue.push({
      event,
      distinct_id: id,
      timestamp: new Date().toISOString(),
      properties: {
        ...props,
        $os: Platform.OS,
        $app_version: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? null,
      },
    });
    if (queue.length >= 20) void flush();
    else if (!timer) timer = setTimeout(() => void flush(), 10_000);
  });
}

/** אחרי התחברות — מקשר אירועים אנונימיים קודמים למשתמש */
export function identify(userId: string): void {
  if (!ENABLED) return;
  void getDistinctId().then((prev) => {
    distinctId = userId;
    if (prev !== userId) {
      queue.push({ event: '$identify', distinct_id: userId, properties: { $anon_distinct_id: prev } });
    }
  });
}

export function resetAnalytics(): void {
  distinctId = null;
  void AsyncStorage.removeItem(ANON_KEY).catch(silent('analytics'));
}

if (ENABLED) {
  AppState.addEventListener('change', (s) => {
    if (s !== 'active') void flush();
  });
}
