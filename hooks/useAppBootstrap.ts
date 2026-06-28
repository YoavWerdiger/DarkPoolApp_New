import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { hydrateQueryCache, persistQueryCache } from '../lib/queryPersist';
import { hydrateChatMessages } from '../lib/chatMessagePersist';
import { hydrateMediaCacheIndex } from '../lib/mediaFileCache';
import { warmAppCache } from '../services/appPrefetch';

/**
 * אתחול cache גלובלי:
 * 1. hydrate מ-AsyncStorage בהפעלה
 * 2. prefetch אחרי login
 * 3. רענון שקט כשחוזרים לאפליקציה
 */
export function useAppBootstrap(userId: string | undefined, authReady: boolean) {
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void hydrateQueryCache();
  }, []);

  useEffect(() => {
    if (!userId || !authReady) return;
    void hydrateChatMessages(userId);
    void hydrateMediaCacheIndex();
    void warmAppCache(userId);
  }, [userId, authReady]);

  useEffect(() => {
    if (!userId) return;

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
  }, [userId]);
}
