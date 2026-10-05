import { onlyGroupMessages } from './chatMessageCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from './queryClient';
import { appQueryKeys } from './appQueryKeys';
import { logger } from '../utils/logger';
import type { ChatMessage } from '../types/chat.types';

/**
 * גיבוי הודעות הצ'אט על המכשיר (AsyncStorage) — כדי שכניסה לקבוצה תהיה מיידית
 * גם בהפעלה קרה, בלי להמתין לרשת.
 *
 * v2: מפתח נפרד לכל קבוצה + אינדקס קטן. קודם (v1) הכל נשמר כ-JSON אחד שנכתב מחדש
 * בכל שינוי — כבד ל-JS thread, ובאנדרואיד שורה מעל ~2MB לא נקראת בכלל (CursorWindow),
 * כך שהגיבוי היה נעלם בשקט אצל משתמשים פעילים. עכשיו נכתבות רק קבוצות שהשתנו.
 *
 * מדיה (תמונות) נשמרת לדיסק ע"י expo-image (cachePolicy="memory-disk"); כאן — ההודעות עצמן.
 */
const LEGACY_V1_PREFIX = '@chat_messages_cache_v1';
const PREFIX = '@chat_messages_cache_v2';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // שבוע
const PER_GROUP_LIMIT = 200; // הודעות אחרונות לכל קבוצה (חלון unread + הקשר)
const MAX_GROUPS = 25; // תקרת קבוצות לגיבוי (LRU לפי עדכניות)
const PERSIST_DEBOUNCE_MS = 1500;

type IndexEntry = { groupId: string; savedAt: number };
type GroupPayload = { savedAt: number; messages: ChatMessage[] };

/** מפתחות מוצמדים למשתמש — מונע דליפת הודעות בין חשבונות */
function indexKey(userId: string): string {
  return `${PREFIX}:${userId}:index`;
}
function groupKey(userId: string, groupId: string): string {
  return `${PREFIX}:${userId}:g:${groupId}`;
}
function legacyKey(userId: string): string {
  return `${LEGACY_V1_PREFIX}:${userId}`;
}

/** מסנן הודעות אופטימיות (temp-), רק של הקבוצה, ומגביל לכמות לכל קבוצה */
function sanitizeMessages(messages: ChatMessage[], groupId: string): ChatMessage[] {
  return onlyGroupMessages(messages, groupId)
    .filter((m) => !m.id.startsWith('temp-'))
    .slice(0, PER_GROUP_LIMIT);
}

async function readIndex(userId: string): Promise<IndexEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(indexKey(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (e): e is IndexEntry =>
            !!e &&
            typeof (e as IndexEntry).groupId === 'string' &&
            typeof (e as IndexEntry).savedAt === 'number',
        )
      : [];
  } catch {
    return [];
  }
}

function applyToMemory(groupId: string, messages: ChatMessage[]): boolean {
  // לא דורסים cache קיים (טרי יותר מ-realtime/רשת)
  if (queryClient.getQueryData(appQueryKeys.chatMessages(groupId))) return false;
  const clean = onlyGroupMessages(messages, groupId);
  if (!clean.length) return false;
  queryClient.setQueryData(appQueryKeys.chatMessages(groupId), clean);
  return true;
}

/** קבוצות שהשתנו מאז השמירה האחרונה — נכתבות רק הן */
const dirtyGroups = new Set<string>();
/** dataUpdatedAt שנשמר לכל קבוצה — מזהה שינוי בלי להשוות תוכן */
const persistedAt = new Map<string, number>();

/** מעבר חד-פעמי מ-v1 (JSON אחד) — נטען לזיכרון, יישמר כ-v2 בשמירה הבאה, ונמחק */
async function migrateLegacy(userId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(legacyKey(userId));
    if (!raw) return;
    await AsyncStorage.removeItem(legacyKey(userId));
    const payload = JSON.parse(raw) as { savedAt?: number; groups?: Record<string, ChatMessage[]> };
    if (!payload?.groups || Date.now() - (payload.savedAt ?? 0) > MAX_AGE_MS) return;
    for (const [groupId, messages] of Object.entries(payload.groups)) {
      if (Array.isArray(messages) && applyToMemory(groupId, messages)) dirtyGroups.add(groupId);
    }
    if (dirtyGroups.size) scheduleChatMessagesPersist(userId);
  } catch (error) {
    // שורה גדולה מדי באנדרואיד וכו' — מוותרים על הגיבוי הישן
    logger.warn('chatMessagePersist', 'legacy migrate failed', error);
    void AsyncStorage.removeItem(legacyKey(userId)).catch(() => undefined);
  }
}

/** hydrate פעיל — כדי שכניסה מהירה לצ'אט תחכה לסיום במקום לפספס cache מהדיסק */
let hydrateInFlight: Promise<void> | null = null;

/** טוען את ההודעות השמורות מהדיסק לזיכרון (queryClient) — בהפעלת האפליקציה */
export async function hydrateChatMessages(userId: string): Promise<void> {
  const run = (async () => {
    try {
      await migrateLegacy(userId);
      const index = (await readIndex(userId)).filter((e) => Date.now() - e.savedAt <= MAX_AGE_MS);
      if (!index.length) return;
      const pairs = await AsyncStorage.multiGet(index.map((e) => groupKey(userId, e.groupId)));
      pairs.forEach(([key, raw], i) => {
        if (!raw) return;
        try {
          const payload = JSON.parse(raw) as GroupPayload;
          if (Array.isArray(payload?.messages)) applyToMemory(index[i].groupId, payload.messages);
        } catch {
          void AsyncStorage.removeItem(key).catch(() => undefined);
        }
      });
    } catch (error) {
      logger.warn('chatMessagePersist', 'hydrate failed', error);
    }
  })();

  hydrateInFlight = run.finally(() => {
    if (hydrateInFlight === run) hydrateInFlight = null;
  });
  return hydrateInFlight;
}

/**
 * הודעות מקאש לכניסה מיידית: זיכרון → ממתין ל-hydrate אם רץ → קריאה ישירה מהדיסק.
 */
export async function readCachedMessagesForGroup(
  userId: string,
  groupId: string,
): Promise<ChatMessage[] | null> {
  if (!userId || !groupId) return null;

  const fromMemory = () => {
    const mem = onlyGroupMessages(
      queryClient.getQueryData<ChatMessage[]>(appQueryKeys.chatMessages(groupId)) ?? [],
      groupId,
    );
    return mem.length ? mem : null;
  };

  const hit = fromMemory();
  if (hit) return hit;

  if (hydrateInFlight) {
    await hydrateInFlight;
    const afterHydrate = fromMemory();
    if (afterHydrate) return afterHydrate;
  }

  try {
    const raw = await AsyncStorage.getItem(groupKey(userId, groupId));
    if (!raw) return null;
    const payload = JSON.parse(raw) as GroupPayload;
    if (!Array.isArray(payload?.messages) || Date.now() - payload.savedAt > MAX_AGE_MS) return null;
    // מסננים לקבוצה (הגנה גם מפני נתונים ישנים/מזוהמים)
    const messages = onlyGroupMessages(payload.messages, groupId);
    if (messages.length === 0) return null;
    queryClient.setQueryData(appQueryKeys.chatMessages(groupId), messages);
    return messages;
  } catch (error) {
    logger.warn('chatMessagePersist', 'readCachedMessagesForGroup failed', error);
    return null;
  }
}

/** שומר לדיסק רק קבוצות שהשתנו (מיידי) */
async function persistNow(userId: string): Promise<void> {
  try {
    const queries = queryClient.getQueryCache().findAll({ queryKey: ['chat', 'messages'] });
    if (queries.length === 0) return;

    // LRU: הקבוצות העדכניות ביותר
    const sorted = [...queries]
      .filter(
        (q) =>
          typeof q.queryKey[2] === 'string' &&
          Array.isArray(q.state.data) &&
          (q.state.data as unknown[]).length > 0,
      )
      .sort((a, b) => (b.state.dataUpdatedAt ?? 0) - (a.state.dataUpdatedAt ?? 0))
      .slice(0, MAX_GROUPS);

    const now = Date.now();
    const writes: [string, string][] = [];
    const nextIndex: IndexEntry[] = [];
    const prevIndex = await readIndex(userId);
    const prevSavedAt = new Map(prevIndex.map((e) => [e.groupId, e.savedAt]));

    for (const query of sorted) {
      const groupId = query.queryKey[2] as string;
      const updatedAt = query.state.dataUpdatedAt ?? 0;
      const changed =
        dirtyGroups.has(groupId) || persistedAt.get(groupId) !== updatedAt || !prevSavedAt.has(groupId);
      if (changed) {
        const messages = sanitizeMessages(query.state.data as ChatMessage[], groupId);
        if (messages.length === 0) continue;
        const payload: GroupPayload = { savedAt: now, messages };
        writes.push([groupKey(userId, groupId), JSON.stringify(payload)]);
        persistedAt.set(groupId, updatedAt);
        nextIndex.push({ groupId, savedAt: now });
      } else {
        nextIndex.push({ groupId, savedAt: prevSavedAt.get(groupId) ?? now });
      }
    }
    dirtyGroups.clear();

    // קבוצות שיצאו מה-LRU — מוחקים מהדיסק
    const keep = new Set(nextIndex.map((e) => e.groupId));
    const evicted = prevIndex
      .filter((e) => !keep.has(e.groupId))
      .map((e) => groupKey(userId, e.groupId));

    if (writes.length) await AsyncStorage.multiSet(writes);
    await AsyncStorage.setItem(indexKey(userId), JSON.stringify(nextIndex));
    if (evicted.length) await AsyncStorage.multiRemove(evicted);
  } catch (error) {
    logger.warn('chatMessagePersist', 'persist failed', error);
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** מתזמן שמירה לדיסק (debounce) — בטוח לקרוא לעיתים תכופות (realtime/שליחה) */
export function scheduleChatMessagesPersist(userId: string): void {
  if (!userId) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistNow(userId);
  }, PERSIST_DEBOUNCE_MS);
}

/** ניקוי הגיבוי (בעת logout) */
export async function clearChatMessagesCache(userId: string): Promise<void> {
  try {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    dirtyGroups.clear();
    persistedAt.clear();
    const index = await readIndex(userId);
    await AsyncStorage.multiRemove([
      indexKey(userId),
      legacyKey(userId),
      ...index.map((e) => groupKey(userId, e.groupId)),
    ]);
  } catch (error) {
    logger.warn('chatMessagePersist', 'clear failed', error);
  }
}
