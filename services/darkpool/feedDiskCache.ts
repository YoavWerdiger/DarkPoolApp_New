/**
 * קאש דיסק לפידי האינסיידרים (קונגרס + Form 4) — כניסה אופטימיסטית:
 * הפיד האחרון נשמר ל-AsyncStorage, ובפתיחה הבאה של האפליקציה נטען ל-React Query עוד לפני הרשת
 * (עם updatedAt של השמירה — כך הוא stale ומתרענן ברקע בשקט, בלי ספינר ובלי מסך ריק).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '../../lib/queryClient';

const PREFIX = 'darkpool:feedcache:v1:';
/** פיד ישן מזה לא מוצג (עדיף שלד מעסקאות של לפני שבוע) */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 1500;

type Stored<T> = { savedAt: number; data: T[] };

const storageKey = (queryKey: readonly unknown[]) => PREFIX + JSON.stringify(queryKey);
const hydrated = new Map<string, Promise<void>>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** טוען את הפיד השמור לקאש של React Query — רק אם עדיין אין שם נתונים. פעם אחת לכל key. */
export function hydrateFeedFromDisk(queryKey: readonly unknown[]): Promise<void> {
  const key = storageKey(queryKey);
  const existing = hydrated.get(key);
  if (existing) return existing;
  const run = (async () => {
    try {
      const current = queryClient.getQueryData<unknown[]>(queryKey);
      if (current && current.length > 0) return;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return;
      const stored = JSON.parse(raw) as Stored<unknown>;
      if (!Array.isArray(stored?.data) || stored.data.length === 0) return;
      if (Date.now() - stored.savedAt > MAX_AGE_MS) return;
      // ייתכן שהרשת הקדימה אותנו בזמן הקריאה מהדיסק — לא דורסים נתונים טריים
      const now = queryClient.getQueryData<unknown[]>(queryKey);
      if (now && now.length > 0) return;
      queryClient.setQueryData(queryKey, stored.data, { updatedAt: stored.savedAt });
    } catch {
      /* קאש בלבד — שגיאה = פשוט נטען מהרשת */
    }
  })();
  hydrated.set(key, run);
  return run;
}

/** שומר את הפיד (debounced — ה-enrichment של הציטוטים מעדכן את אותו key שוב אחרי רגע) */
export function persistFeedToDisk<T>(queryKey: readonly unknown[], data: T[] | undefined, updatedAt: number): void {
  if (!data || data.length === 0) return;
  const key = storageKey(queryKey);
  const prev = saveTimers.get(key);
  if (prev) clearTimeout(prev);
  saveTimers.set(
    key,
    setTimeout(() => {
      saveTimers.delete(key);
      // זמן הנתונים עצמם (dataUpdatedAt) — כך אחרי hydrate הם stale ומתרעננים
      const payload: Stored<T> = { savedAt: updatedAt || Date.now(), data };
      AsyncStorage.setItem(key, JSON.stringify(payload)).catch(() => undefined);
    }, SAVE_DEBOUNCE_MS),
  );
}
