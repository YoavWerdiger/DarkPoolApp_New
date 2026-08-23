/**
 * services/colmex/colmexService.ts
 * --------------------------------------------------------------------------
 * שכבת שירות React Native ל-Colmex Pro Integration.
 *
 * ArchITecture:
 *   App → colmexService → brokerService → Supabase Edge Functions → Colmex API
 *
 * ⚠️  קריאות API ל-Colmex נעשות אך ורק דרך Edge Functions (צד שרת).
 * ה-App אינו מדבר ישירות עם clientapi.cglms.com כדי:
 *   1. לא לחשוף credentials בקוד הלקוח
 *   2. לנהל token refresh ב-Vault המאובטח
 *   3. להבטיח audit log מלא
 *
 * ה-colmexService מספק API נקי שמכמס את ה-brokerService.
 */

import {
  connectColmex as _connectColmex,
  disconnectBroker,
  syncBrokerNow,
  getActiveBrokerConnection,
  getBrokerAccountByPortfolio,
  getBrokerPortfolioSummary,
  listBrokerPositions,
  listBrokerOpenOrders,
  listBrokerExecutions,
  listBrokerStatements,
  getBrokerAccountState,
  linkBrokerAccountToPortfolio,
} from '../brokers/brokerService';
import { supabase } from '../../lib/supabase';
import type {
  BrokerPosition,
  BrokerOpenOrder,
  BrokerExecution,
  BrokerStatement,
} from '../brokers/types';
import type {
  ColmexConnectionInfo,
  ColmexConnectionStatus,
  ColmexPosition,
  ColmexOrder,
  ColmexExecution,
  ColmexAccountState,
  ColmexSyncResult,
} from './colmexTypes';
import {
  saveColmexCredentials,
  saveColmexSession,
  clearAllColmexLocal,
} from './colmexCredentials';

// --------------------------------------------------------------------------
// Auth — connect / disconnect
// --------------------------------------------------------------------------

export interface ColmexConnectResult {
  connectionId: string;
  accounts: Array<{
    brokerAccountId: string;
    name: string;
    type: string | null;
    currency: string;
    status: string | null;
  }>;
}

/**
 * מחבר את המשתמש ל-Colmex Pro.
 *
 * זרימה:
 *   1. קורא לEdge Function broker-colmex-connect
 *   2. שומר username מקומית (לנוחות; password נשמר ב-Vault בלבד)
 *   3. מחזיר רשימת חשבונות לבחירה
 *
 * ⚠️  הסיסמה לעולם אינה נשמרת ב-SecureStore.
 *     היא מועברת ל-Edge Function ונשמרת ב-Supabase Vault.
 */
export async function colmexConnect(
  username: string,
  password: string,
  environment: 'uat' | 'prod' = 'prod'
): Promise<ColmexConnectResult> {
  const result = await _connectColmex({ username, password, environment });
  // שמירת username בלבד מקומית (לנוחות UI)
  await saveColmexCredentials(username, '').catch(() => {});
  return {
    connectionId: result.connectionId,
    accounts: result.accounts,
  };
}

/**
 * מקשר חשבון Colmex לתיק ומפעיל sync ראשוני.
 */
export async function colmexLinkAccount(
  brokerAccountId: string,
  portfolioName?: string,
  currency?: string
): Promise<{ portfolioId: string }> {
  const res = await linkBrokerAccountToPortfolio({
    brokerAccountId,
    name: portfolioName,
    currency,
    triggerSync: true,
  });
  // שמירת session stub (expiresAt ייקבע בsync הבא)
  await saveColmexSession({ accessToken: '', refreshToken: null, expiresAt: Date.now() + 3600_000 }).catch(() => {});
  return { portfolioId: res.portfolioId };
}

/**
 * מנתק את החיבור ל-Colmex.
 * מוחק גם נתונים מקומיים.
 */
export async function colmexDisconnect(connectionId: string): Promise<void> {
  await disconnectBroker({ connectionId, purge: false });
  await clearAllColmexLocal().catch(() => {});
}

// --------------------------------------------------------------------------
// Connection status
// --------------------------------------------------------------------------

/**
 * בודק אם יש חיבור Colmex פעיל למשתמש הנוכחי.
 */
export async function getColmexConnectionStatus(): Promise<ColmexConnectionInfo | null> {
  const conn = await getActiveBrokerConnection('colmex_pro');
  if (!conn) return null;
  return {
    connectionId: conn.id,
    status: conn.status as ColmexConnectionStatus,
    lastSyncAt: conn.last_sync_at,
    lastSyncStatus: conn.last_sync_status,
    lastSyncError: conn.last_sync_error,
    tokenExpiresAt: conn.token_expires_at,
  };
}

// --------------------------------------------------------------------------
// Sync
// --------------------------------------------------------------------------

/**
 * מפעיל סנכרון מלא עבור תיק ספציפי.
 */
export async function colmexSyncPortfolio(
  portfolioId: string,
  opts: { full?: boolean } = {}
): Promise<ColmexSyncResult> {
  const account = await getBrokerAccountByPortfolio(portfolioId);
  if (!account) {
    return { ok: false, positionsSynced: 0, ordersSynced: 0, executionsSynced: 0, statementsSynced: 0, portfolioTxIngested: 0, error: 'no_broker_account' };
  }
  const res = await syncBrokerNow(account.connection_id, { full: opts.full });
  const accountResult = res.results?.find((r) => r.connectionId === account.connection_id);
  const metrics = (accountResult?.metrics ?? {}) as Record<string, {
    positions_synced?: number;
    orders_synced?: number;
    executions_synced?: number;
    statements_synced?: number;
    portfolio_tx_ingested?: number;
  }>;
  const firstAccountMetrics = Object.values(metrics)[0] ?? {};

  // גשר ל-UI: גם אם ה-edge function הישן לא קורא ל-RPC, הקליינט מסנכרן
  // broker_positions → trades + available_cash אחרי כל sync מוצלח.
  if (res.ok) {
    try {
      await supabase.rpc('sync_broker_positions_to_trades', {
        p_broker_account_id: account.id,
      });
    } catch (e) {
      console.warn('sync_broker_positions_to_trades failed:', (e as Error).message);
    }
  }

  return {
    ok: res.ok,
    positionsSynced: firstAccountMetrics.positions_synced ?? 0,
    ordersSynced: firstAccountMetrics.orders_synced ?? 0,
    executionsSynced: firstAccountMetrics.executions_synced ?? 0,
    statementsSynced: firstAccountMetrics.statements_synced ?? 0,
    portfolioTxIngested: firstAccountMetrics.portfolio_tx_ingested ?? 0,
    error: accountResult?.error,
  };
}

// --------------------------------------------------------------------------
// Data getters — טוענים מה-DB (לא ישירות מ-API)
// --------------------------------------------------------------------------

/**
 * שולף מצב חשבון (balance, equity, וכו').
 */
export async function colmexGetAccountState(
  portfolioId: string
): Promise<ColmexAccountState | null> {
  const account = await getBrokerAccountByPortfolio(portfolioId);
  if (!account) return null;
  const state = await getBrokerAccountState(account.id);
  if (!state) return null;
  return {
    balance: state.balance,
    equity: state.equity,
    availableFunds: state.available_funds,
    marginUsed: state.margin_used,
    marginAvailable: state.margin_available,
    projectedBalance: state.projected_balance,
    unrealizedPnl: state.unrealized_pnl,
    realizedPnlToday: state.realized_pnl_today,
    blockedFunds: state.blocked_funds,
    currency: state.currency,
  };
}

/**
 * שולף פוזיציות פתוחות.
 */
export async function colmexGetPositions(portfolioId: string): Promise<ColmexPosition[]> {
  const account = await getBrokerAccountByPortfolio(portfolioId);
  if (!account) return [];
  const positions = await listBrokerPositions(account.id);
  return positions.map(mapPosition);
}

/**
 * שולף אורדרים פעילים.
 */
export async function colmexGetOpenOrders(portfolioId: string): Promise<ColmexOrder[]> {
  const account = await getBrokerAccountByPortfolio(portfolioId);
  if (!account) return [];
  const orders = await listBrokerOpenOrders(account.id);
  return orders.map(mapOrder);
}

/**
 * שולף executions (fills) אחרונים.
 */
export async function colmexGetExecutions(
  portfolioId: string,
  limit = 100
): Promise<ColmexExecution[]> {
  const account = await getBrokerAccountByPortfolio(portfolioId);
  if (!account) return [];
  const execs = await listBrokerExecutions(account.id, { limit });
  return execs.map(mapExecution);
}

/**
 * שולף portfolio summary (state + connection status combined view).
 */
export async function colmexGetPortfolioSummary(portfolioId: string) {
  return getBrokerPortfolioSummary(portfolioId);
}

// --------------------------------------------------------------------------
// Internal mappers — DB rows → clean Colmex types
// --------------------------------------------------------------------------

function mapPosition(p: BrokerPosition): ColmexPosition {
  return {
    positionId: p.position_id,
    symbol: p.symbol,
    side: p.side,
    quantity: p.quantity,
    avgOpenPrice: p.avg_open_price,
    currentPrice: p.current_price,
    unrealizedPnl: p.unrealized_pnl,
    realizedPnl: p.realized_pnl,
    stopLoss: p.stop_loss,
    takeProfit: p.take_profit,
    openedAt: p.opened_at,
  };
}

function mapOrder(o: BrokerOpenOrder): ColmexOrder {
  return {
    orderId: o.order_id,
    positionId: o.position_id,
    symbol: o.symbol,
    side: o.side,
    orderType: o.order_type,
    status: o.status,
    quantity: o.quantity,
    price: o.price,
    stopPrice: o.stop_price,
    stopLoss: o.stop_loss,
    takeProfit: o.take_profit,
    validity: o.validity,
    placedAt: o.placed_at,
  };
}

function mapExecution(e: BrokerExecution): ColmexExecution {
  return {
    executionId: e.execution_id,
    orderId: e.order_id,
    positionId: e.position_id,
    symbol: e.symbol,
    side: e.side,
    openClose: e.open_close,
    quantity: e.quantity,
    price: e.price,
    commission: e.commission,
    realizedPnl: e.realized_pnl,
    currency: e.currency,
    executedAt: e.executed_at,
  };
}
