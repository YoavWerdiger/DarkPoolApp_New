import { queryClient } from '../lib/queryClient';
import { appQueryKeys } from '../lib/appQueryKeys';
import { persistQueryCache } from '../lib/queryPersist';
import { scheduleChatMessagesPersist } from '../lib/chatMessagePersist';
import {
  CHAT_AROUND_AFTER,
  CHAT_AROUND_BEFORE,
  CHAT_DELTA_MAX,
  CHAT_DELTA_PAGE,
  CHAT_OPEN_WINDOW_DEFAULT,
  CHAT_OPEN_WINDOW_MAX,
  getNewestPersistedCursor,
  mergeChatMessages,
  messageIdInCache,
  readGroupMessagesCache,
  writeGroupMessagesCache,
} from '../lib/chatMessageCache';
import { fearAndGreedService } from './fearAndGreedService';
import { LearningService } from './learningService';
import { chatGroupService, chatMessageService } from './chat';
import { loadExplore } from '../hooks/useDarkPoolExplore';
import { loadCongress } from '../hooks/useCongressFeed';
import { loadInsider } from '../hooks/useDarkPoolInsiderFeed';
import { fetchExplorePeopleMerged } from './darkpool/featuredProfilesService';
import { logger } from '../utils/logger';
import type { ChatGroup, ChatMessage } from '../types/chat.types';
import type { CourseListResponse } from '../types/learning';
import { Image as ExpoImage } from 'expo-image';
import { ACADEMY_COURSES_STALE_MS } from '../hooks/useLearning';

/** תואם DarkPoolHomeScreen — כדי שהמסך יקרא מאותו cache */
const INSIDERS_HOME_FEED_LIMIT = 80;

/** מספר הקבוצות שעבורן נמשוך הודעות מראש (unread קודם, אז פעילות) */
const PREFETCH_MESSAGES_GROUP_LIMIT = 12;
/** עמוד קטן + lean — מחמם cache מהר בלי enrichment מלא */
const PREFETCH_MESSAGES_LIMIT = 30;
/** מקסימום prefetch מקבילי — לא לחנוק את ה-UI / הרשת */
const PREFETCH_CONCURRENCY = 3;
/** debounce בין קריאות prefetch חוזרות מרשימת הקבוצות */
const PREFETCH_DEBOUNCE_MS = 220;
/** דילוג על קבוצה שחוממה לאחרונה (resume / stampede) */
const PREFETCH_FRESH_MS = 2 * 60 * 1000;
/** מניעת warm כפול מ-bootstrap + AppState + loadGroups */
const WARM_DEBOUNCE_MS = 30 * 1000;

type PrefetchOpts = { groupIds?: string[]; limit?: number };

let prefetchTimer: ReturnType<typeof setTimeout> | null = null;
let prefetchInFlight: Promise<void> | null = null;
/** אם קראו ל-prefetch בזמן טיסה — ממזגים ולא זורקים groupIds */
let prefetchQueued: { userId: string; opts?: PrefetchOpts } | null = null;
let scheduledPrefetch: { userId: string; opts?: PrefetchOpts } | null = null;

let warmInFlight: Promise<void> | null = null;
let lastWarmAt = 0;

function mergePrefetchOpts(
  a?: PrefetchOpts,
  b?: PrefetchOpts,
): PrefetchOpts | undefined {
  if (!a) return b;
  if (!b) return a;
  const aFull = !a.groupIds?.length;
  const bFull = !b.groupIds?.length;
  // warm מלא גובר — מכסה גם unread
  if (aFull || bFull) {
    const limit = Math.max(a.limit ?? 0, b.limit ?? 0);
    return limit > 0 ? { limit } : undefined;
  }
  return {
    groupIds: [...new Set([...(a.groupIds ?? []), ...(b.groupIds ?? [])])],
    limit: Math.max(a.limit ?? 0, b.limit ?? 0) || undefined,
  };
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const current = items[idx++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}

type PrefetchGroup = Pick<
  ChatGroup,
  'id' | 'unread_count' | 'last_read_message_id' | 'last_message_at'
>;

async function prefetchOneGroup(userId: string, group: PrefetchGroup): Promise<void> {
  const groupId = group.id;
  const existing = readGroupMessagesCache(groupId);
  const unread = group.unread_count || 0;
  const lastReadId = group.last_read_message_id ?? null;
  const newest = getNewestPersistedCursor(existing);
  const lastReadInCache = messageIdInCache(existing, lastReadId);

  // Cache טרי מאוד — מדלגים (מונע thrash)
  const state = queryClient.getQueryState(appQueryKeys.chatMessages(groupId));
  if (
    existing.length > 0 &&
    unread === 0 &&
    state?.data &&
    Date.now() - (state.dataUpdatedAt ?? 0) < PREFETCH_FRESH_MS
  ) {
    return;
  }

  let fetched: ChatMessage[] | null = null;

  if (newest && existing.length > 0 && (unread === 0 || lastReadInCache || !lastReadId)) {
    const { data } = await chatMessageService.fetchMessagesSince(
      groupId,
      userId,
      newest.created_at,
      { pageSize: CHAT_DELTA_PAGE, maxTotal: Math.min(CHAT_DELTA_MAX, 100), lean: true },
    );
    fetched = data;
    if (fetched?.length) {
      writeGroupMessagesCache(groupId, mergeChatMessages(fetched, existing), userId);
      return;
    }
    // אין חדשות — הקאש מספיק
    if (fetched && fetched.length === 0) return;
  }

  if (unread > 0 && lastReadId && !lastReadInCache) {
    if (unread + 15 <= CHAT_OPEN_WINDOW_MAX) {
      const { data } = await chatMessageService.getChatMessages(
        groupId,
        userId,
        { limit: Math.min(CHAT_OPEN_WINDOW_MAX, unread + 15), offset: 0 },
        undefined,
        { lean: true },
      );
      if (data?.messages?.length) {
        writeGroupMessagesCache(
          groupId,
          mergeChatMessages(data.messages, existing),
          userId,
        );
        return;
      }
    } else {
      const [aroundRes, tipRes] = await Promise.all([
        chatMessageService.fetchMessagesAround(groupId, userId, lastReadId, {
          before: CHAT_AROUND_BEFORE,
          after: CHAT_AROUND_AFTER,
          lean: true,
        }),
        chatMessageService.getChatMessages(
          groupId,
          userId,
          { limit: CHAT_OPEN_WINDOW_DEFAULT, offset: 0 },
          undefined,
          { lean: true },
        ),
      ]);
      const merged = mergeChatMessages(aroundRes.data, tipRes.data?.messages, existing);
      if (merged.length) {
        writeGroupMessagesCache(groupId, merged, userId);
        return;
      }
    }
  }

  // Cold / fallback: חלון אחרון קטן (לא היסטוריה מלאה)
  const limit =
    unread > 0
      ? Math.min(CHAT_OPEN_WINDOW_MAX, Math.max(PREFETCH_MESSAGES_LIMIT, unread + 15))
      : PREFETCH_MESSAGES_LIMIT;
  const { data } = await chatMessageService.getChatMessages(
    groupId,
    userId,
    { limit, offset: 0 },
    undefined,
    { lean: true },
  );
  if (data?.messages?.length) {
    writeGroupMessagesCache(
      groupId,
      mergeChatMessages(data.messages, existing),
      userId,
    );
  }
}

/**
 * משיכת חלון הודעות לקבוצות ל-cache ברקע.
 * עדיפות: קבוצות עם unread_count > 0 (חלון סביב last_read), אחרת האחרונות לפי פעילות.
 * לא חוסם UI; concurrency מוגבל; ממזג לקאש קיים.
 */
export async function prefetchChatMessages(
  userId: string,
  opts?: PrefetchOpts,
): Promise<void> {
  if (prefetchInFlight) {
    const prev = prefetchQueued;
    prefetchQueued = {
      userId,
      opts: mergePrefetchOpts(prev?.opts, opts),
    };
    return prefetchInFlight;
  }

  prefetchInFlight = (async () => {
    try {
      const groups =
        queryClient.getQueryData<PrefetchGroup[]>(appQueryKeys.chatGroups(userId)) ?? [];

      const explicitIds = opts?.groupIds?.filter(Boolean) ?? [];
      let ordered: PrefetchGroup[];

      if (explicitIds.length > 0) {
        const byId = new Map(groups.map((g) => [g.id, g]));
        ordered = explicitIds.map(
          (id) => byId.get(id) ?? { id, unread_count: 0, last_read_message_id: null },
        );
      } else {
        const withUnread = groups.filter((g) => (g.unread_count || 0) > 0);
        const rest = groups
          .filter((g) => (g.unread_count || 0) === 0)
          .sort(
            (a, b) =>
              new Date(b.last_message_at ?? 0).getTime() -
              new Date(a.last_message_at ?? 0).getTime(),
          );
        // unread קודם (עד 8 חמות), ואז פעילות עד התקרה — לא enrich לכל הקבוצות ב-cold start
        const cap = opts?.limit ?? PREFETCH_MESSAGES_GROUP_LIMIT;
        const unreadCap = Math.min(withUnread.length, 8);
        ordered = [...withUnread.slice(0, unreadCap), ...rest].slice(0, Math.max(cap, unreadCap));
      }

      await mapPool(ordered, PREFETCH_CONCURRENCY, (group) =>
        prefetchOneGroup(userId, group).catch((error) => {
          logger.warn('appPrefetch', `prefetch group ${group.id} failed`, error);
        }),
      );

      scheduleChatMessagesPersist(userId);
    } catch (error) {
      logger.warn('appPrefetch', 'prefetch chat messages failed', error);
    } finally {
      prefetchInFlight = null;
      const queued = prefetchQueued;
      prefetchQueued = null;
      if (queued) {
        void prefetchChatMessages(queued.userId, queued.opts);
      }
    }
  })();

  return prefetchInFlight;
}

/** debounce — לרשימת קבוצות / unread שמתעדכן תכוף */
export function schedulePrefetchChatMessages(
  userId: string,
  opts?: PrefetchOpts,
): void {
  if (!userId) return;
  scheduledPrefetch = {
    userId,
    opts: mergePrefetchOpts(scheduledPrefetch?.opts, opts),
  };
  if (prefetchTimer) clearTimeout(prefetchTimer);
  prefetchTimer = setTimeout(() => {
    prefetchTimer = null;
    const next = scheduledPrefetch;
    scheduledPrefetch = null;
    if (next) void prefetchChatMessages(next.userId, next.opts);
  }, PREFETCH_DEBOUNCE_MS);
}

/**
 * חימום מיידי לקבוצה אחת (למשל בלחיצה ברשימה) — לא מחכה ל-pool הכללי.
 * קריטי ל-WhatsApp-feel: cache מוכן לפני סיום transition של הניווט.
 */
export function warmChatGroupOnPress(userId: string, groupId: string): void {
  if (!userId || !groupId) return;
  const groups =
    queryClient.getQueryData<PrefetchGroup[]>(appQueryKeys.chatGroups(userId)) ?? [];
  const hit = groups.find((g) => g.id === groupId);
  const group: PrefetchGroup = hit ?? {
    id: groupId,
    unread_count: 0,
    last_read_message_id: null,
  };
  void prefetchOneGroup(userId, group).catch((error) => {
    logger.warn('appPrefetch', `warm on press ${groupId} failed`, error);
  });
}

/**
 * מחמם cover images של קורסי האקדמיה לדיסק — כדי שהבאנרים יופיעו מיד במסך.
 */
export async function prefetchAcademyCovers(
  courses?: { cover_url?: string | null }[]
): Promise<void> {
  try {
    let list = courses;
    if (!list) {
      const cached = queryClient.getQueryData<CourseListResponse>(appQueryKeys.courses());
      list = cached?.courses;
    }
    const urls = (list ?? [])
      .map((c) => c.cover_url?.trim())
      .filter((u): u is string => !!u && /^https?:\/\//i.test(u));
    if (urls.length === 0) return;
    await ExpoImage.prefetch(urls, { cachePolicy: 'memory-disk' });
  } catch (error) {
    logger.warn('appPrefetch', 'prefetch academy covers failed', error);
  }
}

async function fetchChatGroupsForCache(userId: string): Promise<ChatGroup[]> {
  const { data, error } = await chatGroupService.getChatGroups(userId);
  if (error) throw error;
  return data ?? [];
}

/**
 * טוען מראש נתונים שמופיעים ברוב המסכים — רץ אחרי login וברקע כשחוזרים לאפליקציה.
 * המסכים קוראים מאותם query keys ולכן מקבלים נתונים מיידית מה-cache.
 */
export async function warmAppCache(
  userId: string,
  opts?: { force?: boolean }
): Promise<void> {
  if (!userId) return;

  if (!opts?.force) {
    if (warmInFlight) return warmInFlight;
    if (Date.now() - lastWarmAt < WARM_DEBOUNCE_MS) return;
  }

  const run = (async () => {
    lastWarmAt = Date.now();

    const coursesPrefetch = queryClient.prefetchQuery({
      queryKey: appQueryKeys.courses(),
      queryFn: () => LearningService.fetchCourses({}),
      staleTime: ACADEMY_COURSES_STALE_MS,
    }).then(async () => {
      const cached = queryClient.getQueryData<CourseListResponse>(appQueryKeys.courses());
      await prefetchAcademyCovers(cached?.courses);
    });

    const tasks: Promise<unknown>[] = [
      queryClient.prefetchQuery({
        queryKey: appQueryKeys.fearGreed,
        queryFn: () => fearAndGreedService.getFearAndGreedIndex(),
        staleTime: 15 * 60 * 1000,
      }),
      coursesPrefetch,
      // אותו key כמו ChatContext.loadGroups — RQ ממזג in-flight, אין כפל רשת
      queryClient.prefetchQuery({
        queryKey: appQueryKeys.chatGroups(userId),
        queryFn: () => fetchChatGroupsForCache(userId),
      }),
      // אינסיידרים — explore + בית (אנשים + עסקאות)
      queryClient.prefetchQuery({
        queryKey: appQueryKeys.uwExplore,
        queryFn: () => loadExplore(false),
        staleTime: 10 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: appQueryKeys.uwExploreHomeStrip,
        queryFn: () => fetchExplorePeopleMerged({ requirePhoto: false }),
        staleTime: 5 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: appQueryKeys.congressFeed(INSIDERS_HOME_FEED_LIMIT),
        queryFn: () => loadCongress(INSIDERS_HOME_FEED_LIMIT, false),
        staleTime: 2 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: appQueryKeys.insiderFeed('all', true, INSIDERS_HOME_FEED_LIMIT),
        queryFn: () => loadInsider('all', INSIDERS_HOME_FEED_LIMIT, true, false),
        staleTime: 2 * 60 * 1000,
      }),
    ];

    if (opts?.force) {
      await Promise.allSettled(
        tasks.map((task) =>
          task.catch((error) => {
            logger.warn('appPrefetch', 'prefetch task failed', error);
          })
        )
      );
      await prefetchChatMessages(userId);
      await persistQueryCache(userId);
      return;
    }

    // לא חוסם — רץ ברקע
    await Promise.allSettled(tasks);
    await prefetchChatMessages(userId);
    void persistQueryCache(userId);
  })();

  warmInFlight = run.finally(() => {
    if (warmInFlight === run) warmInFlight = null;
  });

  if (opts?.force) {
    await warmInFlight;
  }
}
