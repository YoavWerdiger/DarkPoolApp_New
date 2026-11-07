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

/* ── כללי: כל query (מערך או אובייקט) — למשל מדפי «חקור» ── */

const hasData = (v: unknown): boolean =>
  Array.isArray(v) ? v.length > 0 : v != null && typeof v === 'object' ? Object.keys(v as object).length > 0 : v != null;

/**
 * טוען query שמור מהדיסק. דורס גם placeholder (initialData עם dataUpdatedAt 0) — לא נתונים אמיתיים מהרשת.
 */
export function hydrateQueryFromDisk(queryKey: readonly unknown[]): Promise<void> {
  const key = storageKey(queryKey);
  const existing = hydrated.get(key);
  if (existing) return existing;
  const isReal = () => {
    const st = queryClient.getQueryState(queryKey);
    return !!st && st.dataUpdatedAt > 0 && hasData(st.data);
  };
  const run = (async () => {
    try {
      if (isReal()) return;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return;
      const stored = JSON.parse(raw) as { savedAt: number; data: unknown };
      if (!hasData(stored?.data) || Date.now() - stored.savedAt > MAX_AGE_MS) return;
      if (isReal()) return;
      queryClient.setQueryData(queryKey, stored.data, { updatedAt: stored.savedAt });
    } catch {
      /* קאש בלבד */
    }
  })();
  hydrated.set(key, run);
  return run;
}

export function persistQueryToDisk(queryKey: readonly unknown[], data: unknown, updatedAt: number): void {
  if (!hasData(data) || !(updatedAt > 0)) return;
  const key = storageKey(queryKey);
  const prev = saveTimers.get(key);
  if (prev) clearTimeout(prev);
  saveTimers.set(
    key,
    setTimeout(() => {
      saveTimers.delete(key);
      AsyncStorage.setItem(key, JSON.stringify({ savedAt: updatedAt, data })).catch(() => undefined);
    }, SAVE_DEBOUNCE_MS),
  );
}
