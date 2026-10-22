import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

/**
 * אחסון הסשן של Supabase.
 * ב-Android ל-AsyncStorage יש תקרת DB (ברירת מחדל 6MB). כשהקאשים (צ׳אט / שאילתות / גרפים)
 * ממלאים אותה, שמירת הסשן נכשלת (SQLITE_FULL): verifyOtp שהצליח בשרת מחזיר שגיאה,
 * ו-RPC לא יוצא בכלל (getSession נכשל) — «שגיאה בבדיקת הטלפון» / «שגיאה באימות».
 * בכישלון כתיבה: מוחקים קאשים שאפשר לבנות מחדש ומנסים שוב.
 */
const DISPOSABLE_PREFIXES = [
  '@chat_messages_cache_v1',
  '@chat_messages_cache_v2',
  '@app_query_cache_v2:',
  '@app_yahoo_daily_v1:',
];

export async function purgeDisposableCaches(): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const drop = keys.filter((k) => DISPOSABLE_PREFIXES.some((p) => k.startsWith(p)));
    if (drop.length) await AsyncStorage.multiRemove(drop);
    return drop.length;
  } catch (e) {
    logger.warn('authSessionStorage', 'purge failed', e);
    return 0;
  }
}

export const authSessionStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      const purged = await purgeDisposableCaches();
      logger.error('authSessionStorage', `session write failed — purged ${purged} cache keys, retrying`, e);
      await AsyncStorage.setItem(key, value);
    }
  },
};
