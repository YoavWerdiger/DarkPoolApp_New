import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { hydrateQueryCache, persistQueryCache } from '../lib/queryPersist';
import { hydrateChatMessages } from '../lib/chatMessagePersist';
import { hydrateMediaCacheIndex } from '../lib/mediaFileCache';
import { warmAppCache } from '../services/appPrefetch';

/**
 * אתחול cache גלובלי:
 * 1. hydrate מ-AsyncStorage בהפעלה
 * 2. prefetch אחרי login (רק אחרי שה-hydrate סיים — אחרת warm רץ על cache ריק)
 * 3. רענון שקט כשחוזרים לאפליקציה (debounced בתוך warmAppCache)
 */
export function useAppBootstrap(userId: string | undefined, authReady: boolean) {
  const hydratePromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!hydratePromiseRef.current) {
      hydratePromiseRef.current = hydrateQueryCache();
    }
  }, []);

  useEffect(() => {
    if (!userId || !authReady) return;
    let cancelled = false;

    void (async () => {
      const hydratePromise = hydratePromiseRef.current ?? hydrateQueryCache();
      hydratePromiseRef.current = hydratePromise;

      // Query + chat מהדיסק במקביל — לא לחסום warm על hydrate סידרתי כפול
      await Promise.all([hydratePromise, hydrateChatMessages(userId)]);
      if (cancelled) return;

      void hydrateMediaCacheIndex();
      void warmAppCache(userId);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, authReady]);

  useEffect(() => {
    if (!userId || !authReady) return;

    const onStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        void warmAppCache(userId);
      } else if (next === 'background' || next === 'inactive') {
        // שמירת ה-cache לדיסק לפני שהאפליקציה נסגרת — כניסה קרה הבאה תהיה מיידית
        void persistQueryCache(userId);
      }
    };

    const sub = AppState.addEventListener('change', onStateChange);
    return () => sub.remove();
  }, [userId, authReady]);
}
