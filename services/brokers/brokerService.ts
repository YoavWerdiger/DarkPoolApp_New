/**
 * services/brokers/brokerService.ts
 * --------------------------------------------------------------------------
 * Public API ל-App עבור broker integration.
 *
 * הרחבת ה-Edge Functions:
 *   - broker-colmex-connect       → connectColmex
 *   - broker-link-account         → linkBrokerAccountToPortfolio
 *   - broker-colmex-sync          → syncBroker / syncBrokerNow
 *   - broker-colmex-disconnect    → disconnectBroker
 *
 * קריאות הקריאה לטבלאות (SELECT) עוברות ישירות דרך Supabase RLS:
 *   - listBrokerConnections / listBrokerAccounts / getBrokerAccountState
 *   - listBrokerPositions / listBrokerOpenOrders
 *   - listBrokerExecutions / listBrokerStatements
 *   - getBrokerPortfolioSummary
 */

import { supabase } from '../../lib/supabase';
import type {
  BrokerAccount,
  BrokerAccountState,
  BrokerConnection,
  BrokerExecution,
  BrokerOpenOrder,
  BrokerPortfolioSummary,
  BrokerPosition,
  BrokerStatement,
  ConnectBrokerRequest,
  ConnectBrokerResponse,
  DisconnectBrokerRequest,
  LinkBrokerAccountRequest,
  LinkBrokerAccountResponse,
  SyncBrokerRequest,
  SyncBrokerResponse,
} from './types';

// --------------------------------------------------------------------------
// Edge Function invocation helper
// --------------------------------------------------------------------------

async function invokeEdge<TIn, TOut>(name: string, body: TIn): Promise<TOut> {
  const { data, error } = await supabase.functions.invoke<TOut>(name, { body });
  if (error) {
    // Edge Function errors carry response body in FunctionsHttpError; surface a usable message.
    const msg = (error as Error & { context?: { error?: string } })?.context?.error ?? error.message;
    throw new Error(msg ?? `${name} failed`);
  }
  if (!data) throw new Error(`${name} returned no data`);
  return data;
}

// --------------------------------------------------------------------------
// Mutations via Edge Functions
// --------------------------------------------------------------------------

export async function connectColmex(req: ConnectBrokerRequest): Promise<ConnectBrokerResponse> {
  return invokeEdge<ConnectBrokerRequest, ConnectBrokerResponse>('broker-colmex-connect', req);
}

export async function linkBrokerAccountToPortfolio(
  req: LinkBrokerAccountRequest
): Promise<LinkBrokerAccountResponse> {
  return invokeEdge<LinkBrokerAccountRequest, LinkBrokerAccountResponse>(
    'broker-link-account',
    req
  );
}

export async function syncBroker(req: SyncBrokerRequest = {}): Promise<SyncBrokerResponse> {
  return invokeEdge<SyncBrokerRequest, SyncBrokerResponse>('broker-colmex-sync', req);
}

/** Wrapper נוח לסנכרון מיידי של חיבור ספציפי, עם או בלי טעינה היסטורית מלאה. */
export async function syncBrokerNow(
  connectionId: string,
  options: { full?: boolean } = {}
): Promise<SyncBrokerResponse> {
  return syncBroker({ connectionId, full: options.full ?? false });
}

export async function disconnectBroker(req: DisconnectBrokerRequest): Promise<{ ok: boolean }> {
  return invokeEdge<DisconnectBrokerRequest, { ok: boolean }>('broker-colmex-disconnect', req);
}

// --------------------------------------------------------------------------
// Read queries (via RLS – directly to tables)
// --------------------------------------------------------------------------

export async function listBrokerConnections(): Promise<BrokerConnection[]> {
  const { data, error } = await supabase
    .from('broker_connections')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BrokerConnection[];
}

export async function getActiveBrokerConnection(
  broker: 'colmex_pro' = 'colmex_pro'
): Promise<BrokerConnection | null> {
  const { data, error } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('broker', broker)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return (data as BrokerConnection) ?? null;
}

export async function listBrokerAccounts(connectionId?: string): Promise<BrokerAccount[]> {
  let q = supabase.from('broker_accounts').select('*').order('created_at', { ascending: true });
  if (connectionId) q = q.eq('connection_id', connectionId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BrokerAccount[];
}

export async function getBrokerAccountById(id: string): Promise<BrokerAccount | null> {
  const { data, error } = await supabase
    .from('broker_accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as BrokerAccount) ?? null;
}

export async function getBrokerAccountByPortfolio(
  portfolioId: string
): Promise<BrokerAccount | null> {
  const { data, error } = await supabase
    .from('broker_accounts')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .maybeSingle();
  if (error) throw error;
  return (data as BrokerAccount) ?? null;
}

export async function getBrokerAccountState(
  brokerAccountId: string
): Promise<BrokerAccountState | null> {
  const { data, error } = await supabase
    .from('broker_account_state')
    .select('*')
    .eq('broker_account_id', brokerAccountId)
    .maybeSingle();
  if (error) throw error;
  return (data as BrokerAccountState) ?? null;
}

export async function getBrokerPortfolioSummary(
  portfolioId: string
): Promise<BrokerPortfolioSummary | null> {
  const { data, error } = await supabase
    .from('v_broker_portfolio_summary')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .maybeSingle();
  if (error) throw error;
  return (data as BrokerPortfolioSummary) ?? null;
}

export async function listBrokerPositions(brokerAccountId: string): Promise<BrokerPosition[]> {
  const { data, error } = await supabase
    .from('broker_positions')
    .select('*')
    .eq('broker_account_id', brokerAccountId)
    .order('opened_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BrokerPosition[];
}

export async function listBrokerOpenOrders(brokerAccountId: string): Promise<BrokerOpenOrder[]> {
  const { data, error } = await supabase
    .from('broker_open_orders')
    .select('*')
    .eq('broker_account_id', brokerAccountId)
    .order('placed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BrokerOpenOrder[];
}

export async function listBrokerExecutions(
  brokerAccountId: string,
  opts: { limit?: number } = {}
): Promise<BrokerExecution[]> {
  let q = supabase
    .from('broker_executions')
    .select('*')
    .eq('broker_account_id', brokerAccountId)
    .order('executed_at', { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BrokerExecution[];
}

export async function listBrokerStatements(
  brokerAccountId: string,
  opts: { limit?: number } = {}
): Promise<BrokerStatement[]> {
  let q = supabase
    .from('broker_statements')
    .select('*')
    .eq('broker_account_id', brokerAccountId)
    .order('occurred_at', { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BrokerStatement[];
}
