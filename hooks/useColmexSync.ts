/**
 * hooks/useColmexSync.ts
 * --------------------------------------------------------------------------
 * הוק לסנכרון אוטומטי של תיק Colmex Pro.
 *
 * מאפיינים:
 *   - מסנכרן כל 30 שניות כשהאפליקציה פעילה (AppState === 'active')
 *   - מפסיק sync כשהמסך לא active (background / inactive)
 *   - מנגנון anti-duplicate: לא מריץ sync מקביל
 *   - חשוף syncNow() להפעלה ידנית
 *   - מחזיר lastSync, isSyncing, error
 *
 * שימוש:
 *   const { lastSync, isSyncing, syncNow, error } = useColmexSync(portfolioId, isConnected);
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  triggerSync,
  subscribeToSync,
  getSyncState,
} from '../services/colmex/colmexSyncService';
import type { ColmexSyncResult } from '../services/colmex/colmexTypes';

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const SYNC_INTERVAL_MS = 30_000; // 30 שניות

// --------------------------------------------------------------------------
// Hook
// --------------------------------------------------------------------------

interface UseColmexSyncResult {
  /** זמן הסנכרון האחרון שהצליח. null אם עוד לא היה sync. */
  lastSync: Date | null;
  /** האם sync בתהליך כרגע. */
  isSyncing: boolean;
  /** הפעלת sync ידנית. מחזיר את ה-result. */
  syncNow: (opts?: { full?: boolean }) => Promise<ColmexSyncResult | null>;
  /** שגיאה אחרונה, אם קיימת. */
  error: string | null;
  /** מספר הפוזיציות שסונכרנו בסנכרון האחרון. */
  lastPositionsSynced: number;
}

/**
 * @param portfolioId  UUID של התיק לסנכרון
 * @param enabled      האם הסנכרון מופעל (למשל: רק כשהתיק מחובר ל-Colmex)
 */
export function useColmexSync(
  portfolioId: string | null | undefined,
  enabled: boolean
): UseColmexSyncResult {
  const [lastSync, setLastSync] = useState<Date | null>(() =>
    portfolioId ? getSyncState(portfolioId).lastSyncAt : null
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPositionsSynced, setLastPositionsSynced] = useState(0);

  // ref כדי לא לאבד ערכים בתוך closures של setInterval
  const portfolioRef = useRef(portfolioId);
  const enabledRef = useRef(enabled);
  portfolioRef.current = portfolioId;
  enabledRef.current = enabled;

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ---------- subscription לsync state ----------
  useEffect(() => {
    if (!portfolioId) return;

    const unsubscribe = subscribeToSync(portfolioId, (state) => {
      if (!mountedRef.current) return;
      setIsSyncing(state.isSyncing);
      if (state.lastSyncAt) setLastSync(state.lastSyncAt);
      setError(state.lastError);
      if (state.lastResult) setLastPositionsSynced(state.lastResult.positionsSynced);
    });

    return unsubscribe;
  }, [portfolioId]);

  // ---------- syncNow ----------
  const syncNow = useCallback(
    async (opts: { full?: boolean } = {}): Promise<ColmexSyncResult | null> => {
      const pid = portfolioRef.current;
      if (!pid || !enabledRef.current) return null;
      const result = await triggerSync(pid, { force: true, full: opts.full });
      return result;
    },
    []
  );

  // ---------- auto-sync interval ----------
  useEffect(() => {
    if (!portfolioId || !enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // sync ראשוני בהתחברות
    void triggerSync(portfolioId, { force: false });

    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (
          appStateRef.current === 'active' &&
          portfolioRef.current &&
          enabledRef.current
        ) {
          void triggerSync(portfolioRef.current, { force: false });
        }
      }, SYNC_INTERVAL_MS);
    };

    startInterval();

    // מניעת sync ברקע
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active') {
        // חזרה מרקע — sync מיידי
        if (portfolioRef.current && enabledRef.current) {
          void triggerSync(portfolioRef.current, { force: false });
        }
        startInterval();
      } else {
        // עוברים לרקע — עוצרים interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      appStateSub.remove();
    };
  }, [portfolioId, enabled]);

  // cleanup בunmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    lastSync,
    isSyncing,
    syncNow,
    error,
    lastPositionsSynced,
  };
}
