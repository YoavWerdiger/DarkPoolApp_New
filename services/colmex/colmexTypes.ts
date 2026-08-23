/**
 * services/colmex/colmexTypes.ts
 * --------------------------------------------------------------------------
 * TypeScript types ל-Colmex TradeRevolution Client API.
 * משקפים את הסכמה של ה-API שנשלפה מ:
 *   GET https://clientapi.cglms.com/traderevolution/v1/v3/api-docs
 *
 * הערות חשובות:
 *   - positions / orders / executions מגיעות כמערכי ערכים בלבד (string[][]).
 *   - שמות עמודות מוגדרים ב-GET /config תחת positionsConfig / ordersConfig וכו'.
 *   - כל פרסינג נעשה ב-colmexService.ts לפי ColmexPanelConfig.
 */

// --------------------------------------------------------------------------
// Session / Auth
// --------------------------------------------------------------------------

export interface ColmexSession {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // epoch ms
}

// --------------------------------------------------------------------------
// Config — column definitions per panel
// --------------------------------------------------------------------------

export interface ColmexColumnDef {
  id: string;
  description?: string;
}

export interface ColmexPanelConfig {
  id?: string;
  title?: string;
  columns: ColmexColumnDef[];
}

export interface ColmexCustomerAccess {
  orders?: boolean;
  ordersHistory?: boolean;
  filledOrders?: boolean;
  positions?: boolean;
  symbolInfo?: boolean;
  marketDepth?: boolean;
}

export interface ColmexConfig {
  customerAccess?: ColmexCustomerAccess;
  positionsConfig: ColmexPanelConfig;
  ordersConfig: ColmexPanelConfig;
  ordersHistoryConfig: ColmexPanelConfig;
  filledOrdersConfig: ColmexPanelConfig;
  accountDetailsConfig: ColmexPanelConfig;
  statementsConfig: ColmexPanelConfig;
}

// --------------------------------------------------------------------------
// Account
// --------------------------------------------------------------------------

export interface ColmexAccount {
  id: string;
  name: string;
  type?: 'demo' | 'live' | 'contest' | 'funded' | 'challenge';
  currency?: string;
  status?: 'ACTIVE' | 'CLOSED' | 'SUSPENDED' | 'TRADE_OFF' | string;
}

// --------------------------------------------------------------------------
// Account State (balance) — array-based, parsed via accountDetailsConfig
// --------------------------------------------------------------------------

export interface ColmexAccountState {
  balance: number | null;
  equity: number | null;
  availableFunds: number | null;
  marginUsed: number | null;
  marginAvailable: number | null;
  projectedBalance: number | null;
  unrealizedPnl: number | null;
  realizedPnlToday: number | null;
  blockedFunds: number | null;
  currency: string | null;
}

// --------------------------------------------------------------------------
// Position — parsed from positionsConfig columns
// --------------------------------------------------------------------------

export interface ColmexPosition {
  positionId: number;
  symbol: string | null;
  side: 'long' | 'short' | null;
  quantity: number | null;
  avgOpenPrice: number | null;
  currentPrice: number | null;
  unrealizedPnl: number | null;
  realizedPnl: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  openedAt: string | null; // ISO
}

// --------------------------------------------------------------------------
// Execution (fill) — parsed from filledOrdersConfig columns
// --------------------------------------------------------------------------

export interface ColmexExecution {
  executionId: number;
  orderId: number | null;
  positionId: number | null;
  symbol: string | null;
  side: 'buy' | 'sell' | null;
  openClose: 'open' | 'close' | null;
  quantity: number | null;
  price: number | null;
  commission: number | null;
  realizedPnl: number | null;
  currency: string | null;
  executedAt: string | null; // ISO
}

// --------------------------------------------------------------------------
// Order (pending) — parsed from ordersConfig columns
// --------------------------------------------------------------------------

export interface ColmexOrder {
  orderId: number;
  positionId: number | null;
  symbol: string | null;
  side: 'buy' | 'sell' | null;
  orderType: string | null;
  status: string | null;
  quantity: number | null;
  price: number | null;
  stopPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  validity: string | null;
  placedAt: string | null; // ISO
}

// --------------------------------------------------------------------------
// Sync result
// --------------------------------------------------------------------------

export interface ColmexSyncResult {
  ok: boolean;
  positionsSynced: number;
  ordersSynced: number;
  executionsSynced: number;
  statementsSynced: number;
  portfolioTxIngested: number;
  error?: string;
}

// --------------------------------------------------------------------------
// Connection status (mirrors broker_connections row)
// --------------------------------------------------------------------------

export type ColmexConnectionStatus =
  | 'pending'
  | 'active'
  | 'expired'
  | 'failed'
  | 'disconnected';

export interface ColmexConnectionInfo {
  connectionId: string;
  status: ColmexConnectionStatus;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  tokenExpiresAt: string | null;
}
