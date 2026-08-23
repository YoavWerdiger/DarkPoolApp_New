/**
 * services/brokers/types.ts
 * --------------------------------------------------------------------------
 * Types משותפים לפיצ'ר אינטגרציית broker.
 * משקפים את הסכמה ב-supabase/migrations/027_broker_integration.sql.
 */

export type BrokerName = 'colmex_pro';
export type BrokerEnvironment = 'uat' | 'prod';
export type BrokerConnectionStatus =
  | 'pending'
  | 'active'
  | 'expired'
  | 'failed'
  | 'disconnected';

export interface BrokerConnection {
  id: string;
  user_id: string;
  broker: BrokerName;
  environment: BrokerEnvironment;
  display_name: string | null;
  status: BrokerConnectionStatus;
  token_expires_at: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrokerAccount {
  id: string;
  connection_id: string;
  user_id: string;
  broker_account_id: string; // external id (ACC-001)
  account_name: string | null;
  account_type: 'demo' | 'live' | 'contest' | 'funded' | 'challenge' | null;
  currency: string;
  status: string | null;
  portfolio_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrokerAccountWithLink extends BrokerAccount {
  /** התיק שאליו ה-account מקושר. null אם עדיין לא חובר */
  portfolio_id: string | null;
}

export interface BrokerAccountState {
  broker_account_id: string;
  user_id: string;
  balance: number | null;
  equity: number | null;
  available_funds: number | null;
  margin_used: number | null;
  margin_available: number | null;
  projected_balance: number | null;
  unrealized_pnl: number | null;
  realized_pnl_today: number | null;
  blocked_funds: number | null;
  currency: string | null;
  updated_at: string;
}

export interface BrokerPosition {
  id: string;
  broker_account_id: string;
  user_id: string;
  position_id: number;
  tradable_instrument_id: number | null;
  symbol: string | null;
  side: 'long' | 'short' | null;
  quantity: number | null;
  avg_open_price: number | null;
  current_price: number | null;
  unrealized_pnl: number | null;
  realized_pnl: number | null;
  swap: number | null;
  commission: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  trailing_offset: number | null;
  opened_at: string | null;
  updated_at: string;
}

export interface BrokerOpenOrder {
  id: string;
  broker_account_id: string;
  user_id: string;
  order_id: number;
  position_id: number | null;
  tradable_instrument_id: number | null;
  symbol: string | null;
  side: 'buy' | 'sell' | null;
  order_type: string | null;
  status: string | null;
  quantity: number | null;
  filled_quantity: number | null;
  price: number | null;
  stop_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  trailing_offset: number | null;
  validity: string | null;
  expire_at: string | null;
  user_comment: string | null;
  placed_at: string | null;
  updated_at: string;
}

export interface BrokerExecution {
  id: string;
  broker_account_id: string;
  user_id: string;
  execution_id: number;
  order_id: number | null;
  position_id: number | null;
  tradable_instrument_id: number | null;
  symbol: string | null;
  side: 'buy' | 'sell' | null;
  open_close: 'open' | 'close' | null;
  quantity: number | null;
  price: number | null;
  commission: number | null;
  swap: number | null;
  realized_pnl: number | null;
  currency: string | null;
  executed_at: string | null;
  ingested_into_portfolio: boolean;
  portfolio_transaction_id: string | null;
  created_at: string;
}

export interface BrokerStatement {
  id: string;
  broker_account_id: string;
  user_id: string;
  operation_id: number;
  operation_type: string | null;
  normalized_type: 'deposit' | 'withdrawal' | 'fee' | 'dividend' | 'interest' | 'other' | null;
  amount: number | null;
  balance_after: number | null;
  currency: string | null;
  description: string | null;
  symbol: string | null;
  occurred_at: string | null;
  ingested_into_portfolio: boolean;
  portfolio_transaction_id: string | null;
  created_at: string;
}

/**
 * סיכום שמסופק ע"י VIEW `v_broker_portfolio_summary`.
 * מאחד את התיק עם state עדכני של החשבון.
 */
export interface BrokerPortfolioSummary {
  portfolio_id: string;
  user_id: string;
  broker_account_id: string;
  broker: BrokerName;
  environment: BrokerEnvironment;
  connection_status: BrokerConnectionStatus;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  broker_account_name: string | null;
  broker_account_type: string | null;
  broker_account_external_id: string;
  broker_currency: string;
  balance: number | null;
  equity: number | null;
  available_funds: number | null;
  margin_used: number | null;
  margin_available: number | null;
  projected_balance: number | null;
  unrealized_pnl: number | null;
  realized_pnl_today: number | null;
  state_updated_at: string | null;
  open_orders_count: number;
  open_positions_count: number;
}

// --------------------------------------------------------------------------
// Edge Function I/O shapes
// --------------------------------------------------------------------------

export interface ConnectBrokerRequest {
  username: string;
  password: string;
  environment?: BrokerEnvironment;
}

/**
 * סיווג כשל האימות שמגיע מ-broker-colmex-connect (ראה classifyAuthFailure
 * ב-supabase/functions/_shared/colmex.ts). מראה את אותו contract בדיוק.
 */
export type BrokerAuthFailureReason =
  | 'auth_rejected'
  | 'account_locked'
  | 'rate_limited'
  | 'broker_unavailable';

export interface BrokerAuthFailure {
  reason: BrokerAuthFailureReason;
  /** מונה הכשלונות של הברוקר — קיים רק כשהלוגין זוהה כמשתמש קיים. */
  attempt: { current: number; max: number } | null;
  loginRecognised: boolean;
}

export interface ConnectBrokerResponse {
  connectionId: string;
  environment: BrokerEnvironment;
  accounts: Array<{
    brokerAccountId: string; // external id
    name: string;
    type: string | null;
    currency: string;
    status: string | null;
  }>;
}

export interface LinkBrokerAccountRequest {
  /** UUID של broker_accounts (לא ה-external id) */
  brokerAccountId: string;
  name?: string;
  currency?: string;
  description?: string;
  triggerSync?: boolean;
}

export interface LinkBrokerAccountResponse {
  portfolioId: string;
  brokerAccountId: string;
  brokerExternalId: string;
  name: string;
  alreadyLinked?: boolean;
  syncOk?: boolean;
  syncError?: string | null;
}

export interface SyncBrokerRequest {
  connectionId?: string;
  brokerAccountIds?: string[];
  full?: boolean;
}

export interface SyncBrokerResponse {
  ok: boolean;
  synced: number;
  results?: Array<{
    connectionId: string;
    status: 'success' | 'partial' | 'failed';
    metrics: Record<string, unknown>;
    error?: string;
  }>;
}

export interface DisconnectBrokerRequest {
  connectionId: string;
  purge?: boolean;
}
