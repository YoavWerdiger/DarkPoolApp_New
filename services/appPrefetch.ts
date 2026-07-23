import { queryClient } from '../lib/queryClient';
import { appQueryKeys } from '../lib/appQueryKeys';
import { persistQueryCache } from '../lib/queryPersist';
import { scheduleChatMessagesPersist } from '../lib/chatMessagePersist';
import { fearAndGreedService } from './fearAndGreedService';
import { LearningService } from './learningService';
import { chatGroupService, chatMessageService } from './chat';
import { loadExplore } from '../hooks/useDarkPoolExplore';
import { logger } from '../utils/logger';

/** מספר הקבוצות שעבורן נמשוך הודעות מראש (הראשונות לפי last_message_at) */
const PREFETCH_MESSAGES_GROUP_LIMIT = 8;

/**
 * משיכת ההודעות האחרונות של כל קבוצה ל-cache (chatMessages) ברקע,
 * כך ש-selectGroup ימצא אותן מיד בכניסה והצ'אט ייפתח מיידית (כמו וואטסאפ).
 */
async function prefetchChatMessages(userId: string): Promise<void> {
  try {
    const groups =
      queryClient.getQueryData<{ id: string; last_message_at?: string }[]>(
        appQueryKeys.chatGroups(userId),
      ) ?? [];

    const ordered = [...groups]
      .sort(
        (a, b) =>
          new Date(b.last_message_at ?? 0).getTime() -
          new Date(a.last_message_at ?? 0).getTime(),
      )
      .slice(0, PREFETCH_MESSAGES_GROUP_LIMIT);

    const FRESH_MS = 2 * 60 * 1000;
    await Promise.allSettled(
      ordered.map(async (group) => {
        // מדלגים רק אם ה-cache טרי (נטען לאחרונה) — אחרת מרעננים גם cache מהדיסק
        const state = queryClient.getQueryState(appQueryKeys.chatMessages(group.id));
        if (state?.data && Date.now() - (state.dataUpdatedAt ?? 0) < FRESH_MS) return;
        const { data } = await chatMessageService.getChatMessages(group.id, userId, {
          limit: 50,
          offset: 0,
        });
        if (data?.messages) {
          queryClient.setQueryData(appQueryKeys.chatMessages(group.id), data.messages);
        }
      }),
    );
    // גיבוי לדיסק כך שגם הפעלה קרה הבאה תהיה מיידית
    scheduleChatMessagesPersist(userId);
  } catch (error) {
    logger.warn('appPrefetch', 'prefetch chat messages failed', error);
  }
}

/**
 * טוען מראש נתונים שמופיעים ברוב המסכים — רץ אחרי login וברקע כשחוזרים לאפליקציה.
 * המסכים קוראים מאותם query keys ולכן מקבלים נתונים מיידית מה-cache.
 */
export async function warmAppCache(
  userId: string,
  opts?: { force?: boolean }
): Promise<void> {
  const tasks: Promise<unknown>[] = [
    queryClient.prefetchQuery({
      queryKey: appQueryKeys.fearGreed,
      queryFn: () => fearAndGreedService.getFearAndGreedIndex(),
      staleTime: 15 * 60 * 1000,
    }),
    queryClient.prefetchQuery({
      queryKey: appQueryKeys.courses(),
      queryFn: () => LearningService.fetchCourses({}),
    }),
    queryClient.prefetchQuery({
      queryKey: appQueryKeys.chatGroups(userId),
      queryFn: async () => {
        const { data, error } = await chatGroupService.getChatGroups(userId);
        if (error) throw error;
        return data ?? [];
      },
    }),
    queryClient.prefetchQuery({
      queryKey: appQueryKeys.uwExplore,
      queryFn: () => loadExplore(false),
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
  } else {
    // לא חוסם — רץ ברקע
    void Promise.allSettled(tasks).then(async () => {
      await prefetchChatMessages(userId);
      void persistQueryCache(userId);
    });
    return;
  }

  await persistQueryCache(userId);
}
