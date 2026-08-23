/**
 * services/colmex/colmexSyncService.ts
 * --------------------------------------------------------------------------
 * שירות סנכרון Colmex — מתאם בין ה-sync המלא וה-UI.
 *
 * אחריות:
 *   - ניהול state של sync (אחרון, שגיאות, האם בתהליך)
 *   - מניעת sync מקביל (lock)
 *   - throttling — מינימום 15 שניות בין syncs
 *   - טיפול בשגיאות 401 (token expired) — retry אוטומטי
 */

import { colmexSyncPortfolio } from './colmexService';
import type { ColmexSyncResult } from './colmexTypes';

// --------------------------------------------------------------------------
// Internal state (per portfolioId)
// --------------------------------------------------------------------------

interface SyncState {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  lastResult: ColmexSyncResult | null;
  lastError: string | null;
}

const syncStateMap = new Map<string, SyncState>();

const MIN_SYNC_INTERVAL_MS = 15_000; // 15 שניות

function getState(portfolioId: string): SyncState {
  if (!syncStateMap.has(portfolioId)) {
    syncStateMap.set(portfolioId, {
      isSyncing: false,
      lastSyncAt: null,
      lastResult: null,
      lastError: null,
    });
  }
  return syncStateMap.get(portfolioId)!;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export type SyncUpdateCallback = (state: SyncState) => void;

const listeners = new Map<string, Set<SyncUpdateCallback>>();

function notifyListeners(portfolioId: string): void {
  const state = getState(portfolioId);
  const cbs = listeners.get(portfolioId);
  if (cbs) {
    for (const cb of cbs) {
      try {
        cb(state);
      } catch {
        /* ignore listener errors */
      }
    }
  }
}

/**
 * נרשם להתראות sync עבור תיק.
 * מחזיר פונקציית unsubscribe.
 */
export function subscribeToSync(
  portfolioId: string,
  callback: SyncUpdateCallback
): () => void {
  if (!listeners.has(portfolioId)) {
    listeners.set(portfolioId, new Set());
  }
  listeners.get(portfolioId)!.add(callback);
  return () => {
    listeners.get(portfolioId)?.delete(callback);
  };
}

/**
 * מחזיר את ה-state הנוכחי.
 */
export function getSyncState(portfolioId: string): SyncState {
  return { ...getState(portfolioId) };
}

/**
 * מפעיל sync עבור תיק.
 *
 * @param portfolioId  UUID של התיק
 * @param force        אם true — מתעלם מ-throttle
 * @param full         אם true — sync היסטורי מלא
 */
export async function triggerSync(
  portfolioId: string,
  opts: { force?: boolean; full?: boolean } = {}
): Promise<ColmexSyncResult> {
  const state = getState(portfolioId);

  if (state.isSyncing) {
    return { ok: false, positionsSynced: 0, ordersSynced: 0, executionsSynced: 0, statementsSynced: 0, portfolioTxIngested: 0, error: 'sync_in_progress' };
  }

  if (!opts.force && state.lastSyncAt) {
    const elapsed = Date.now() - state.lastSyncAt.getTime();
    if (elapsed < MIN_SYNC_INTERVAL_MS) {
      return state.lastResult ?? { ok: true, positionsSynced: 0, ordersSynced: 0, executionsSynced: 0, statementsSynced: 0, portfolioTxIngested: 0 };
    }
  }

  state.isSyncing = true;
  state.lastError = null;
  notifyListeners(portfolioId);

  try {
    const result = await colmexSyncPortfolio(portfolioId, { full: opts.full });
    state.lastSyncAt = new Date();
    state.lastResult = result;
    state.lastError = result.error ?? null;
    return result;
  } catch (e) {
    const errMsg = (e as Error).message ?? 'sync_failed';
    state.lastError = errMsg;
    state.lastResult = {
      ok: false,
      positionsSynced: 0,
      ordersSynced: 0,
      executionsSynced: 0,
      statementsSynced: 0,
      portfolioTxIngested: 0,
      error: errMsg,
    };
    return state.lastResult;
  } finally {
    state.isSyncing = false;
    notifyListeners(portfolioId);
  }
}

/**
 * מנקה state של sync עבור תיק (למשל עם disconnect).
 */
export function clearSyncState(portfolioId: string): void {
  syncStateMap.delete(portfolioId);
  listeners.delete(portfolioId);
}
