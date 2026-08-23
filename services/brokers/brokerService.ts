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
  BrokerAuthFailure,
  BrokerAuthFailureReason,
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

type EdgeErrorBody = {
  error?: string;
  detail?: string;
  message?: string;
  msg?: string;
  code?: string | number;
  // סיווג כשל אימות שמגיע מ-broker-colmex-connect
  reason?: string;
  attempt?: { current?: number; max?: number } | null;
  loginRecognised?: boolean;
};

const AUTH_FAILURE_REASONS: BrokerAuthFailureReason[] = [
  'auth_rejected',
  'account_locked',
  'rate_limited',
  'broker_unavailable',
];

/**
 * שגיאה מ-Edge Function שמשמרת את ה-payload המובנה ולא רק את הטקסט.
 * `message` נשאר זהה למה שהיה קודם כדי ששומעים קיימים שמנתחים מחרוזת ימשיכו לעבוד.
 */
export class BrokerEdgeError extends Error {
  code: string | undefined;
  status: number | undefined;
  /** מאוכלס רק כשה-Edge Function סיווגה כשל אימות מול הברוקר. */
  authFailure: BrokerAuthFailure | null;

  constructor(
    message: string,
    opts: {
      code?: string;
      status?: number;
      authFailure?: BrokerAuthFailure | null;
    } = {}
  ) {
    super(message);
    this.name = 'BrokerEdgeError';
    this.code = opts.code;
    this.status = opts.status;
    this.authFailure = opts.authFailure ?? null;
  }
}

function parseAuthFailure(body: EdgeErrorBody | null): BrokerAuthFailure | null {
  if (!body) return null;
  const reason = AUTH_FAILURE_REASONS.find((r) => r === body.reason);
  const hasAttempt =
    typeof body.attempt?.current === 'number' && typeof body.attempt?.max === 'number';
  if (!reason && !hasAttempt) return null;
  return {
    reason: reason ?? 'auth_rejected',
    attempt: hasAttempt
      ? { current: body.attempt!.current as number, max: body.attempt!.max as number }
      : null,
    loginRecognised: body.loginRecognised === true || hasAttempt,
  };
}

/** Extract a useful message from FunctionsHttpError / FunctionsRelayError. */
async function extractEdgeError(
  error: Error & { context?: unknown },
  fallbackName: string
): Promise<BrokerEdgeError> {
  const ctx = error?.context as
    | (Response & { json?: () => Promise<unknown>; text?: () => Promise<string>; clone?: () => Response; status?: number })
    | undefined;

  let status: number | undefined =
    typeof ctx?.status === 'number' ? ctx.status : undefined;
  let parsed: EdgeErrorBody | null = null;
  let rawText = '';

  if (ctx && typeof ctx.text === 'function') {
    try {
      // Prefer clone() — body may already have been consumed by the client.
      const readable =
        typeof ctx.clone === 'function' ? ctx.clone() : ctx;
      rawText = await readable.text();
    } catch {
      try {
        if (typeof ctx.json === 'function') {
          parsed = (await ctx.json()) as EdgeErrorBody;
        }
      } catch {
        /* fall through */
      }
    }
  }

  if (!parsed && rawText) {
    try {
      parsed = JSON.parse(rawText) as EdgeErrorBody;
    } catch {
      /* non-JSON body — use raw text below */
    }
  }

  const code =
    (typeof parsed?.error === 'string' && parsed.error) ||
    (typeof parsed?.code === 'string' && parsed.code) ||
    (typeof parsed?.code === 'number' ? String(parsed.code) : undefined);
  const detail =
    (typeof parsed?.detail === 'string' && parsed.detail) ||
    (typeof parsed?.message === 'string' && parsed.message) ||
    (typeof parsed?.msg === 'string' && parsed.msg) ||
    undefined;

  const authFailure = parseAuthFailure(parsed);
  const build = (message: string) =>
    new BrokerEdgeError(message, { code, status, authFailure });

  if (code && detail && code !== detail) {
    return build(`${code}: ${detail}`);
  }
  if (code) return build(code);
  if (detail) return build(detail);
  if (rawText.trim()) return build(rawText.trim().slice(0, 300));

  // Never surface the opaque supabase-js default alone.
  const generic = error.message ?? '';
  if (/non-2xx/i.test(generic) || /relay error/i.test(generic)) {
    return build(
      status ? `${fallbackName} failed (HTTP ${status})` : `${fallbackName} failed`
    );
  }
  return build(generic || `${fallbackName} failed`);
}

async function invokeEdge<TIn, TOut>(name: string, body: TIn): Promise<TOut> {
  const { data, error } = await supabase.functions.invoke<TOut>(name, {
    body: body as Record<string, unknown>,
  });
  if (error) {
    // supabase-js v2: on non-2xx, data is null and error.context is the Response
    // (body not yet read). In some RN/fetch paths the body may already be spent —
    // clone()/text() + multi-field JSON parsing keeps the message useful.
    throw await extractEdgeError(error as Error & { context?: unknown }, name);
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
