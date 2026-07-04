import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from './queryClient';
import { appQueryKeys } from './appQueryKeys';
import { logger } from '../utils/logger';
import type { ChatMessage } from '../types/chat.types';

/**
 * גיבוי הודעות הצ'אט על המכשיר (AsyncStorage) — כדי שכניסה לקבוצה תהיה מיידית
 * גם בהפעלה קרה, בלי להמתין לרשת. נשמר רק batch קטן לכל קבוצה, חסום בגודל.
 *
 * שים לב: מדיה (תמונות) כבר נשמרת לדיסק ע"י expo-image (cachePolicy="memory-disk"),
 * כאן אנחנו מגבים את ההודעות עצמן (טקסט + מטא-דאטה + הפניות למדיה).
 */
const STORAGE_PREFIX = '@chat_messages_cache_v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // שבוע
const PER_GROUP_LIMIT = 50; // הודעות אחרונות לכל קבוצה
const MAX_GROUPS = 20; // תקרת קבוצות לגיבוי
const PERSIST_DEBOUNCE_MS = 1500;

/** מפתח אחסון מוצמד למשתמש — מונע דליפת הודעות בין חשבונות */
function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

type PersistedPayload = {
  savedAt: number;
  groups: Record<string, ChatMessage[]>;
};

/** מסנן הודעות אופטימיות (temp-) ומגביל לכמות לכל קבוצה */
function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => !m.id.startsWith('temp-'))
    .slice(0, PER_GROUP_LIMIT);
}

/** טוען את ההודעות השמורות מהדיסק לזיכרון (queryClient) — בהפעלת האפליקציה */
export async function hydrateChatMessages(userId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return;

    const payload = JSON.parse(raw) as PersistedPayload;
    if (!payload?.groups || Date.now() - payload.savedAt > MAX_AGE_MS) return;

    for (const [groupId, messages] of Object.entries(payload.groups)) {
      if (!Array.isArray(messages) || messages.length === 0) continue;
      // לא דורסים cache קיים (טרי יותר מ-realtime/רשת)
      if (queryClient.getQueryData(appQueryKeys.chatMessages(groupId))) continue;
      queryClient.setQueryData(appQueryKeys.chatMessages(groupId), messages);
    }
  } catch (error) {
    logger.warn('chatMessagePersist', 'hydrate failed', error);
  }
}

/** שומר את כל ה-cache של ההודעות לדיסק (מיידי) */
async function persistNow(userId: string): Promise<void> {
  try {
    const queries = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['chat', 'messages'] });

    if (queries.length === 0) return;

    // ממיינים לפי עדכניות כדי שאם נחתוך — נשמור את הקבוצות הפעילות
    const sorted = [...queries].sort(
      (a, b) => (b.state.dataUpdatedAt ?? 0) - (a.state.dataUpdatedAt ?? 0),
    );

    const groups: Record<string, ChatMessage[]> = {};
    let count = 0;
    for (const query of sorted) {
      if (count >= MAX_GROUPS) break;
      const groupId = query.queryKey[2];
      const data = query.state.data as ChatMessage[] | undefined;
      if (typeof groupId !== 'string' || !Array.isArray(data) || data.length === 0) continue;
      const sanitized = sanitizeMessages(data);
      if (sanitized.length === 0) continue;
      groups[groupId] = sanitized;
      count += 1;
    }

    if (count === 0) return;

    const payload: PersistedPayload = { savedAt: Date.now(), groups };
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(payload));
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
    await AsyncStorage.removeItem(storageKey(userId));
  } catch (error) {
    logger.warn('chatMessagePersist', 'clear failed', error);
  }
}
