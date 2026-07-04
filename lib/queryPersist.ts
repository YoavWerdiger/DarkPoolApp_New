import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from './queryClient';
import { logger } from '../utils/logger';

/**
 * Persistence גנרי ל-React Query: כל query שה-key שלו תואם prefix מאושר
 * נשמר ל-AsyncStorage תחת מפתח נפרד (כדי לא לחרוג ממגבלת גודל באנדרואיד),
 * וב-hydrate נטען חזרה לזיכרון לפני שהמסכים עולים — כך הכל optimistic ושורד הפעלה קרה.
 */
const KEY_PREFIX = '@app_query_cache_v2:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** דילוג על payloads ענקיים — לא שווה לשמור ולהאט את ה-IO */
const MAX_ENTRY_BYTES = 512 * 1024;

/**
 * רק query keys שמתחילים באחד מה-prefixes האלה נשמרים לדיסק.
 * (chat messages מטופלים בנפרד ב-chatMessagePersist; per-entity profiles לא נשמרים בכוונה)
 */
const PERSIST_PREFIXES: readonly (readonly unknown[])[] = [
  ['market', 'fearGreed'],
  ['learning', 'courses'],
  ['chat', 'groups'],
  ['uw', 'explore'],
  ['uw', 'signals'],
  ['uw', 'featured'],
  ['darkpool', 'feed'],
  ['darkpool', 'congress'],
  ['darkpool', 'insider'],
  ['darkpool', 'following'],
  ['darkpool', 'followed'],
  ['news', 'list'],
  ['news', 'earnings'],
  ['portfolios', 'list'],
  ['economic', 'events'],
  ['trades', 'list'],
];

type PersistedEntry = {
  data: unknown;
  updatedAt: number;
};

function matchesPrefix(queryKey: readonly unknown[]): boolean {
  return PERSIST_PREFIXES.some(
    (prefix) =>
      prefix.length <= queryKey.length &&
      prefix.every((part, i) => part === queryKey[i]),
  );
}

function storageKeyFor(queryKey: readonly unknown[]): string {
  return KEY_PREFIX + JSON.stringify(queryKey);
}

/** טוען cache מ-AsyncStorage לזיכרון — לפני שהמשתמש נכנס למסכים */
export async function hydrateQueryCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const ourKeys = allKeys.filter((k) => k.startsWith(KEY_PREFIX));
    if (ourKeys.length === 0) return;

    const pairs = await AsyncStorage.multiGet(ourKeys);
    const now = Date.now();
    const expired: string[] = [];

    for (const [storageKey, raw] of pairs) {
      if (!raw) continue;
      try {
        const entry = JSON.parse(raw) as PersistedEntry;
        if (now - entry.updatedAt > MAX_AGE_MS) {
          expired.push(storageKey);
          continue;
        }
        const queryKey = JSON.parse(storageKey.slice(KEY_PREFIX.length)) as readonly unknown[];
        queryClient.setQueryData(queryKey, entry.data);
      } catch {
        expired.push(storageKey);
      }
    }

    if (expired.length) {
      await AsyncStorage.multiRemove(expired).catch(() => undefined);
    }
  } catch (error) {
    logger.warn('queryPersist', 'hydrate failed', error);
  }
}

/** שומר את כל ה-queries המאושרים לדיסק — שורדים סגירת אפליקציה */
export async function persistQueryCache(_userId?: string): Promise<void> {
  try {
    const now = Date.now();
    const toSet: [string, string][] = [];

    for (const query of queryClient.getQueryCache().getAll()) {
      const queryKey = query.queryKey as readonly unknown[];
      if (!matchesPrefix(queryKey)) continue;
      const data = query.state.data;
      if (data == null) continue;

      const serialized = JSON.stringify({ data, updatedAt: now } satisfies PersistedEntry);
      if (serialized.length > MAX_ENTRY_BYTES) continue;
      toSet.push([storageKeyFor(queryKey), serialized]);
    }

    if (toSet.length === 0) return;
    await AsyncStorage.multiSet(toSet);
  } catch (error) {
    logger.warn('queryPersist', 'persist failed', error);
  }
}

/** ניקוי כל ה-cache השמור (logout / החלפת חשבון) */
export async function clearPersistedQueryCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const ourKeys = allKeys.filter((k) => k.startsWith(KEY_PREFIX));
    if (ourKeys.length) await AsyncStorage.multiRemove(ourKeys);
  } catch (error) {
    logger.warn('queryPersist', 'clear failed', error);
  }
}
