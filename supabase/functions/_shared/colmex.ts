/**
 * supabase/functions/_shared/colmex.ts
 * ----------------------------------------------------------------------------
 * Client + helpers ל-TraderEvolution Client REST API (משמש את Colmex Pro).
 *
 * תלוי רק ב-Deno standard libraries — חי בתוך Edge Functions בלבד.
 * שום RN/Node code אסור לייבא לכאן.
 *
 * Endpoints מרכזיים:
 *   POST /authorize                        – simple login (user + pass → bearer)
 *   POST /authorize (refresh)              – refresh token flow
 *   POST /logout                           – session termination
 *   GET  /config                           – שמות עמודות עבור response arrays
 *   GET  /accounts                         – רשימת חשבונות
 *   GET  /accounts/{accountId}/state       – Balance/Equity/Margin
 *   GET  /accounts/{accountId}/positions   – Open positions
 *   GET  /accounts/{accountId}/orders      – Active orders
 *   GET  /accounts/{accountId}/ordersHistory
 *   GET  /accounts/{accountId}/executions  – Fills (paginated)
 *   GET  /accounts/{accountId}/statements  – Deposits/Withdrawals/Fees/...
 *   GET  /accounts/{accountId}/instruments – Symbol mapping
 *   GET  /pendingWithdrawals               – Pending withdrawals
 *
 * חשוב: orders/positions/executions/state/statements מחזירים array של array של
 * strings — בלי שמות שדות. לכן הקובץ הזה מספק `resolvePanelColumns()` שמשתמש
 * ב-/config response כדי להמיר ל-records.
 */

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

export const COLMEX_BASE_URL_UAT  = 'https://clientapi-uat.cglms.com/traderevolution/v1';
export const COLMEX_BASE_URL_PROD = 'https://clientapi.cglms.com/traderevolution/v1';

export type ColmexEnv = 'uat' | 'prod';

export function getBaseUrl(env: ColmexEnv): string {
  return env === 'prod' ? COLMEX_BASE_URL_PROD : COLMEX_BASE_URL_UAT;
}

// ----------------------------------------------------------------------------
// Auth types
// ----------------------------------------------------------------------------

export interface ColmexCredentials {
  username: string;
  password: string;
}

export interface ColmexTokens {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAt: number; // epoch ms
}

/**
 * צורת התגובה האמיתית של TraderEvolution / Colmex Pro על /authorize:
 *   { "s": "ok", "d": { "access_token": "...", "expiration": 1779980520 } }
 *   { "s": "error", "errmsg": "..." }
 *
 * שים לב:
 *   - אין `refresh_token` במצב הפשוט - חידוש token נעשה ע"י re-authorize עם
 *     ה-credentials השמורים ב-Vault.
 *   - `expiration` הוא unix timestamp בשניות (לא expires_in).
 *   - שמות השדות שונים מהסטנדרט של OAuth2 - הנתיב הזה הוא לא OAuth2 password
 *     grant אלא endpoint פנימי של TE.
 */
export interface ColmexAuthorizeResponseEnvelope {
  s: 'ok' | 'error';
  errmsg?: string;
  d?: {
    access_token?: string;
    expiration?: number; // epoch seconds
    refresh_token?: string;
    token_type?: string;
  };
}

/**
 * מנקה שדה credential שהגיע מקלט משתמש: הסרת תווי אפס-רוחב שנדבקים בהעתקה
 * ממייל/PDF, ו-trim של רווחים (כולל NBSP, שנספר כרווח ב-String.trim).
 * תווים כאלה נשלחים כמו שהם ל-Colmex וגורמים ל-"User/password combination is not valid".
 */
export function sanitizeCredentialField(value: string): string {
  return value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

// ----------------------------------------------------------------------------
// Authorize failure classification
// ----------------------------------------------------------------------------

export type ColmexAuthFailureReason =
  | 'auth_rejected'      // TE דחה את האימות — סיסמה ו/או סטטוס משתמש
  | 'account_locked'     // המשתמש ננעל (brute force / חסימה יזומה)
  | 'rate_limited'
  | 'broker_unavailable';

export interface ColmexAuthFailure {
  reason: ColmexAuthFailureReason;
  /** מונה כשלונות של TE, כשהוא מצורף להודעה. `max` הוא סף הנעילה. */
  attempt: { current: number; max: number } | null;
  rawMessage: string;
}

/**
 * TraderEvolution מחזיר את אותה הודעה גנרית — "User/password combination is not
 * valid" — עבור כל דחיית אימות: לוגין שלא קיים, סיסמה שגויה, וגם משתמש קיים
 * שסטטוסו אינו Unlocked (Need activation / Expired / Locked after brute force)
 * או שנדרש ממנו שינוי סיסמה אחרי איפוס מצד הברוקר.
 *
 * ההבדל היחיד שנחשף החוצה הוא מונה הכשלונות, שמצורף להודעה רק כשהלוגין מזוהה
 * כמשתמש קיים בשרת. לכן אסור להסיק "סיסמה שגויה" מההודעה עצמה — כל מה שידוע הוא
 * שהאימות נדחה, ו-UI צריך לנסח את זה בהתאם.
 */
export function classifyAuthFailure(rawMessage: string): ColmexAuthFailure {
  const msg = rawMessage ?? '';
  const lower = msg.toLowerCase();

  // "Attempt 2 of 10" / "Attempt 2/10" — הניסוח משתנה בין גרסאות TE.
  const m = /attempt\s*(\d+)\s*(?:of|\/)\s*(\d+)/i.exec(msg);
  const attempt = m ? { current: Number(m[1]), max: Number(m[2]) } : null;

  const reason: ColmexAuthFailureReason =
    /lock|block|brute|disabled|suspend/i.test(lower)
      ? 'account_locked'
      : attempt && attempt.current >= attempt.max
      ? 'account_locked'
      : /too many|rate limit/i.test(lower)
      ? 'rate_limited'
      : /timeout|timed out|unavailable|gateway|network/i.test(lower)
      ? 'broker_unavailable'
      : 'auth_rejected';

  return { reason, attempt, rawMessage: msg };
}

/**
 * POST /authorize — login עם user/password.
 *
 * הפורמט (Credentials-based auth של TraderEvolution / Colmex):
 *   Content-Type: application/x-www-form-urlencoded
 *   Body: login={user}&password={pass}
 *   (ללא 2faCode — השדה גרם לדחיית login ב-prod)
 *
 * NOTE: אין כאן client_id/client_secret ואין בהם צורך. הם פרמטרים של
 * OAuth 2.0 Authorization-code flow בלבד, ואילו ה-cluster של Colmex מוגדר
 * ל-auth type `password` (הגדרת שרת ב-Zookeeper, לא הרשאה פר-משתמש):
 * /oauth/authorize ו-/oauth/token שם מחזירים 401 ריק. כל לקוח מסחר רגיל
 * מתחבר עם ה-credentials שלו דרך /authorize, בלי רישום פר-משתמש.
 */
export async function authorizeWithPassword(
  env: ColmexEnv,
  creds: ColmexCredentials
): Promise<ColmexTokens> {
  // URLSearchParams מבצע את קידוד ה-form-urlencoded בעצמו; אין לקדד ידנית מעליו.
  const body = new URLSearchParams({
    login: sanitizeCredentialField(creds.username),
    password: sanitizeCredentialField(creds.password),
  });

  const res = await fetch(`${getBaseUrl(env)}/authorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    // Avoid Edge Function 504 (platform ~150s) when Colmex hangs.
    signal: AbortSignal.timeout(20_000),
  });

  const text = await res.text();
  let parsed: ColmexAuthorizeResponseEnvelope | null = null;
  try {
    parsed = text ? (JSON.parse(text) as ColmexAuthorizeResponseEnvelope) : null;
  } catch {
    /* invalid JSON - יטופל למטה */
  }

  if (!res.ok || !parsed || parsed.s !== 'ok' || !parsed.d?.access_token) {
    const msg =
      parsed?.errmsg ||
      (text ? text.slice(0, 200) : '') ||
      res.statusText ||
      'unknown error';
    // שים לב: דחיית אימות מגיעה כ-HTTP 200 עם {s:"error"}, לא כ-401.
    throw new ColmexError(
      `authorize failed (${res.status}): ${msg}`,
      res.status,
      classifyAuthFailure(msg)
    );
  }

  const nowMs = Date.now();
  const expirationSec = parsed.d.expiration;
  const expiresAt = expirationSec
    ? expirationSec * 1000 - 30_000 // 30s safety
    : nowMs + 3600 * 1000 - 30_000;

  return {
    accessToken: parsed.d.access_token,
    refreshToken: parsed.d.refresh_token ?? null,
    tokenType: parsed.d.token_type ?? 'Bearer',
    expiresAt,
  };
}

/**
 * "Refresh" - במצב password אין refresh_token, לכן אנו פשוט עושים re-authorize
 * עם ה-credentials השמורים.
 */
export async function refreshAccessToken(
  env: ColmexEnv,
  _refreshToken: string,
  creds?: ColmexCredentials
): Promise<ColmexTokens> {
  if (!creds) {
    throw new ColmexError(
      'refreshAccessToken: credentials are required (no refresh_token in simple-auth mode)'
    );
  }
  return authorizeWithPassword(env, creds);
}

export async function logout(env: ColmexEnv, tokens: ColmexTokens): Promise<void> {
  try {
    await fetch(`${getBaseUrl(env)}/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
  } catch {
    /* best-effort */
  }
}

// ----------------------------------------------------------------------------
// HTTP helper
// ----------------------------------------------------------------------------

export class ColmexError extends Error {
  status: number;
  /** מאוכלס רק לכשלונות /authorize — ראה classifyAuthFailure. */
  authFailure: ColmexAuthFailure | null;
  constructor(msg: string, status = 0, authFailure: ColmexAuthFailure | null = null) {
    super(msg);
    this.status = status;
    this.authFailure = authFailure;
  }
}

interface RequestOpts {
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
}

async function colmexRequest<T>(
  env: ColmexEnv,
  tokens: ColmexTokens,
  path: string,
  opts: RequestOpts = {}
): Promise<T> {
  const url = new URL(`${getBaseUrl(env)}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: 'application/json',
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

  const res = await fetch(url.toString(), init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ColmexError(
      `${init.method} ${path} failed (${res.status}): ${text || res.statusText}`,
      res.status
    );
  }
  return (await res.json()) as T;
}

// ----------------------------------------------------------------------------
// Config (column names for array responses)
// ----------------------------------------------------------------------------

export interface ColmexColumn {
  id: string;
  description?: string;
}

export interface ColmexPanelConfig {
  id?: string;
  title?: string;
  columns: ColmexColumn[];
}

export interface ColmexCustomerAccess {
  orders?: boolean;
  ordersHistory?: boolean;
  filledOrders?: boolean;
  positions?: boolean;
  symbolInfo?: boolean;
  marketDepth?: boolean;
}

export interface ColmexConfigResponse {
  s: string;
  d?: {
    customerAccess?: ColmexCustomerAccess;
    positionsConfig?: ColmexPanelConfig;
    ordersConfig?: ColmexPanelConfig;
    ordersHistoryConfig?: ColmexPanelConfig;
    filledOrdersConfig?: ColmexPanelConfig;
    accountDetailsConfig?: ColmexPanelConfig;
    statementsConfig?: ColmexPanelConfig;
    rateLimits?: unknown;
    limits?: unknown;
  };
}

export async function getConfig(
  env: ColmexEnv,
  tokens: ColmexTokens
): Promise<ColmexConfigResponse['d']> {
  const j = await colmexRequest<ColmexConfigResponse>(env, tokens, '/config');
  if (!j.d) throw new ColmexError('/config returned no data');
  return j.d;
}

// ----------------------------------------------------------------------------
// Accounts
// ----------------------------------------------------------------------------

export interface ColmexAccount {
  id: string;
  name: string;
  type?: string;
  currency?: string;
  status?: string;
  tradingRules?: unknown;
  riskRules?: unknown;
  marginRules?: unknown;
}

interface AccountResponse {
  s: string;
  d?: { accounts?: ColmexAccount[] };
}

export async function listAccounts(env: ColmexEnv, tokens: ColmexTokens): Promise<ColmexAccount[]> {
  const j = await colmexRequest<AccountResponse>(env, tokens, '/accounts');
  return j.d?.accounts ?? [];
}

// ----------------------------------------------------------------------------
// Account State – array based, needs accountDetailsConfig to interpret
// ----------------------------------------------------------------------------

interface AccountStateResponse {
  s: string;
  d?: { accountDetailsData?: number[] | string[] };
}

export async function getAccountState(
  env: ColmexEnv,
  tokens: ColmexTokens,
  accountId: number | string
): Promise<Array<number | string>> {
  const j = await colmexRequest<AccountStateResponse>(
    env,
    tokens,
    `/accounts/${accountId}/state`
  );
  return j.d?.accountDetailsData ?? [];
}

// ----------------------------------------------------------------------------
// Positions / Orders / OrdersHistory / Executions – all array-of-array based
// ----------------------------------------------------------------------------

interface ArrayPanelResponse<K extends string> {
  s: string;
  d?: Record<K, string[][]>;
}

export async function getPositions(
  env: ColmexEnv,
  tokens: ColmexTokens,
  accountId: number | string
): Promise<string[][]> {
  const j = await colmexRequest<ArrayPanelResponse<'positions'>>(
    env,
    tokens,
    `/accounts/${accountId}/positions`
  );
  return j.d?.positions ?? [];
}

export async function getOrders(
  env: ColmexEnv,
  tokens: ColmexTokens,
  accountId: number | string,
  query?: { from?: number; to?: number }
): Promise<string[][]> {
  const j = await colmexRequest<ArrayPanelResponse<'orders'>>(
    env,
    tokens,
    `/accounts/${accountId}/orders`,
    { query }
  );
  return j.d?.orders ?? [];
}

export async function getOrdersHistory(
  env: ColmexEnv,
  tokens: ColmexTokens,
  accountId: number | string,
  query?: { from?: number; to?: number }
): Promise<string[][]> {
  const j = await colmexRequest<ArrayPanelResponse<'ordersHistory'>>(
    env,
    tokens,
    `/accounts/${accountId}/ordersHistory`,
    { query }
  );
  return j.d?.ordersHistory ?? [];
}

export async function getExecutions(
  env: ColmexEnv,
  tokens: ColmexTokens,
  accountId: number | string,
  query?: { from?: number; to?: number; positionId?: number; eventId?: number; numberOfLines?: number }
): Promise<string[][]> {
  const j = await colmexRequest<ArrayPanelResponse<'executions'>>(
    env,
    tokens,
    `/accounts/${accountId}/executions`,
    { query }
  );
  return j.d?.executions ?? [];
}

// ----------------------------------------------------------------------------
// Statements – pagination via operationId cursor
// ----------------------------------------------------------------------------

interface StatementsResponse {
  s: string;
  d?: { statements?: string[][] };
}

export async function getStatements(
  env: ColmexEnv,
  tokens: ColmexTokens,
  accountId: number | string,
  query?: { from?: number; to?: number; operationId?: number; numberOfLines?: number }
): Promise<string[][]> {
  const j = await colmexRequest<StatementsResponse>(
    env,
    tokens,
    `/accounts/${accountId}/statements`,
    { query }
  );
  return j.d?.statements ?? [];
}

// ----------------------------------------------------------------------------
// Instruments mapping
// ----------------------------------------------------------------------------

export interface ColmexInstrument {
  tradableInstrumentId: number;
  id: number;
  name: string;
  description?: string;
  type?: string;
  tradingExchange?: string;
  marketDataExchange?: string;
  logoUrl?: string;
  hasIntraday?: boolean;
  hasDaily?: boolean;
}

interface InstrumentsResponse {
  s: string;
  d?: { instruments?: ColmexInstrument[] };
}

export async function listInstruments(
  env: ColmexEnv,
  tokens: ColmexTokens,
  accountId: number | string,
  type?: string
): Promise<ColmexInstrument[]> {
  const j = await colmexRequest<InstrumentsResponse>(
    env,
    tokens,
    `/accounts/${accountId}/instruments`,
    { query: { type } }
  );
  return j.d?.instruments ?? [];
}

// ----------------------------------------------------------------------------
// Pending withdrawals
// ----------------------------------------------------------------------------

export interface ColmexPendingWithdrawal {
  accountId: number;
  accountOperationId: number;
  amount: number;
}

interface PendingWithdrawalsResponse {
  s: string;
  d?: { withdrawalRequests?: ColmexPendingWithdrawal[] };
}

export async function listPendingWithdrawals(
  env: ColmexEnv,
  tokens: ColmexTokens,
  accountId: number | string
): Promise<ColmexPendingWithdrawal[]> {
  const j = await colmexRequest<PendingWithdrawalsResponse>(
    env,
    tokens,
    `/pendingWithdrawals`,
    { query: { accountId } }
  );
  return j.d?.withdrawalRequests ?? [];
}

// ============================================================================
// COLUMN-AWARE PARSERS
// ----------------------------------------------------------------------------
// /config מספק שמות עמודות לכל פאנל. הפונקציות למטה מקבלות string[][] +
// ColmexColumn[] ומחזירות record-rich data שניתן להכניס ל-DB.
// ============================================================================

export function arrayToRecord(
  row: Array<string | number>,
  columns: ColmexColumn[]
): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (let i = 0; i < columns.length; i++) {
    out[columns[i].id] = row[i] ?? null;
  }
  return out;
}

export function arraysToRecords(
  rows: Array<Array<string | number>>,
  columns: ColmexColumn[]
): Record<string, string | number | null>[] {
  return rows.map((r) => arrayToRecord(r, columns));
}

// ----------------------------------------------------------------------------
// Numeric coercion (TraderEvolution sometimes returns numbers-as-strings)
// ----------------------------------------------------------------------------

export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n === null ? null : Math.trunc(n);
}

export function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

// ----------------------------------------------------------------------------
// Column-id helpers – לרוב הקולונים השמות מצליעים את עצמם.
// פונקציה pickFirst כדי לתמוך בכמה name variants (TraderEvolution לעיתים
// משנים את שם השדה בין סביבות).
// ----------------------------------------------------------------------------

export function pickFirst(
  rec: Record<string, string | number | null>,
  keys: string[]
): string | number | null {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(rec, k)) {
      const v = rec[k];
      if (v !== null && v !== undefined && v !== '') return v;
    }
  }
  return null;
}

// ============================================================================
// NORMALIZED MODELS — ממופים לטבלאות ה-DB שלנו
// ============================================================================

export interface NormalizedAccountState {
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
  raw: unknown;
}

export function normalizeAccountState(
  data: Array<number | string>,
  columns: ColmexColumn[]
): NormalizedAccountState {
  const rec = arrayToRecord(data, columns);
  return {
    balance:          toNum(pickFirst(rec, ['balance', 'Balance'])),
    equity:           toNum(pickFirst(rec, ['equity', 'Equity', 'projectedBalance'])),
    available_funds:  toNum(pickFirst(rec, ['availableFunds', 'AvailableFunds'])),
    margin_used:      toNum(pickFirst(rec, ['marginUsed', 'usedMargin', 'initialMargin'])),
    margin_available: toNum(pickFirst(rec, ['marginAvailable', 'maintenanceMargin'])),
    projected_balance: toNum(pickFirst(rec, ['projectedBalance'])),
    unrealized_pnl:   toNum(pickFirst(rec, ['unrealizedPnl', 'openProfit', 'openPnL'])),
    realized_pnl_today: toNum(pickFirst(rec, ['realizedPnl', 'realizedPnLToday', 'dailyPnL'])),
    blocked_funds:    toNum(pickFirst(rec, ['blockedFunds', 'blockedForStocks'])),
    currency:         toStr(pickFirst(rec, ['currency', 'accountCurrency'])),
    raw: rec,
  };
}

export interface NormalizedPosition {
  position_id: number;
  tradable_instrument_id: number | null;
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
  opened_at: string | null; // ISO
  raw: unknown;
}

export function normalizePosition(
  row: string[],
  columns: ColmexColumn[]
): NormalizedPosition | null {
  const rec = arrayToRecord(row, columns);
  const positionId = toInt(pickFirst(rec, ['id', 'positionId']));
  if (positionId === null) return null;

  const qty = toNum(pickFirst(rec, ['qty', 'quantity']));
  const sideRaw = toStr(pickFirst(rec, ['side', 'positionSide']))?.toLowerCase();
  const side: 'long' | 'short' | null =
    sideRaw === 'buy' || sideRaw === 'long' || (qty !== null && qty > 0)
      ? 'long'
      : sideRaw === 'sell' || sideRaw === 'short' || (qty !== null && qty < 0)
      ? 'short'
      : null;

  // Colmex positions panel uses openDate (ms epoch), not openTime/createdDate
  const openedAtMs = toInt(
    pickFirst(rec, ['openDate', 'openTime', 'openedAt', 'createTime', 'createdDate'])
  );

  const avgOpen = toNum(pickFirst(rec, ['avgPrice', 'openPrice']));
  // Colmex field is unrealizedPl (not unrealizedPnl)
  const unrealized = toNum(
    pickFirst(rec, ['unrealizedPl', 'unrealizedPnl', 'unrealizedPL', 'openPnL', 'pnl'])
  );
  let currentPrice = toNum(
    pickFirst(rec, ['currentPrice', 'last', 'lastPrice', 'marketPrice', 'price'])
  );
  // Derive mark from avg + unrealized when Colmex omits currentPrice
  if (
    currentPrice == null &&
    unrealized != null &&
    avgOpen != null &&
    qty != null &&
    Math.abs(qty) > 0
  ) {
    const absQty = Math.abs(qty);
    currentPrice =
      side === 'short' ? avgOpen - unrealized / absQty : avgOpen + unrealized / absQty;
  }

  return {
    position_id: positionId,
    tradable_instrument_id: toInt(pickFirst(rec, ['tradableInstrumentId', 'instrumentId'])),
    side,
    quantity: qty !== null ? Math.abs(qty) : null,
    avg_open_price: avgOpen,
    current_price: currentPrice,
    unrealized_pnl: unrealized,
    realized_pnl: toNum(pickFirst(rec, ['realizedPnl', 'closedPnL'])),
    swap: toNum(pickFirst(rec, ['swap', 'swaps'])),
    commission: toNum(pickFirst(rec, ['commission'])),
    stop_loss: toNum(pickFirst(rec, ['stopLoss', 'sl'])),
    take_profit: toNum(pickFirst(rec, ['takeProfit', 'tp'])),
    trailing_offset: toNum(pickFirst(rec, ['trailingOffset'])),
    opened_at: openedAtMs ? new Date(openedAtMs).toISOString() : null,
    raw: rec,
  };
}

export interface NormalizedOpenOrder {
  order_id: number;
  position_id: number | null;
  tradable_instrument_id: number | null;
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
  raw: unknown;
}

export function normalizeOpenOrder(
  row: string[],
  columns: ColmexColumn[]
): NormalizedOpenOrder | null {
  const rec = arrayToRecord(row, columns);
  const orderId = toInt(pickFirst(rec, ['id', 'orderId']));
  if (orderId === null) return null;

  const sideRaw = toStr(pickFirst(rec, ['side']))?.toLowerCase();
  const side: 'buy' | 'sell' | null =
    sideRaw === 'buy' ? 'buy' : sideRaw === 'sell' ? 'sell' : null;

  const placedMs = toInt(pickFirst(rec, ['placedTime', 'createTime', 'orderTime']));
  const expireMs = toInt(pickFirst(rec, ['expireDate']));

  return {
    order_id: orderId,
    position_id: toInt(pickFirst(rec, ['positionId'])),
    tradable_instrument_id: toInt(pickFirst(rec, ['tradableInstrumentId', 'instrumentId'])),
    side,
    order_type: toStr(pickFirst(rec, ['type', 'orderType'])),
    status: toStr(pickFirst(rec, ['status'])),
    quantity: toNum(pickFirst(rec, ['qty', 'quantity'])),
    filled_quantity: toNum(pickFirst(rec, ['filledQty', 'filledQuantity'])),
    price: toNum(pickFirst(rec, ['price', 'limitPrice'])),
    stop_price: toNum(pickFirst(rec, ['stopPrice'])),
    stop_loss: toNum(pickFirst(rec, ['stopLoss', 'sl'])),
    take_profit: toNum(pickFirst(rec, ['takeProfit', 'tp'])),
    trailing_offset: toNum(pickFirst(rec, ['trailingOffset', 'trStopOffset'])),
    validity: toStr(pickFirst(rec, ['validity', 'tif'])),
    expire_at: expireMs ? new Date(expireMs).toISOString() : null,
    user_comment: toStr(pickFirst(rec, ['userComment', 'comment'])),
    placed_at: placedMs ? new Date(placedMs).toISOString() : null,
    raw: rec,
  };
}

export interface NormalizedExecution {
  execution_id: number;
  order_id: number | null;
  position_id: number | null;
  tradable_instrument_id: number | null;
  side: 'buy' | 'sell' | null;
  open_close: 'open' | 'close' | null;
  quantity: number | null;
  price: number | null;
  commission: number | null;
  swap: number | null;
  realized_pnl: number | null;
  currency: string | null;
  executed_at: string | null;
  raw: unknown;
}

export function normalizeExecution(
  row: string[],
  columns: ColmexColumn[]
): NormalizedExecution | null {
  const rec = arrayToRecord(row, columns);
  const execId = toInt(pickFirst(rec, ['eventId', 'id', 'executionId']));
  if (execId === null) return null;

  const sideRaw = toStr(pickFirst(rec, ['side', 'operation']))?.toLowerCase();
  const side: 'buy' | 'sell' | null =
    sideRaw === 'buy' ? 'buy' : sideRaw === 'sell' ? 'sell' : null;

  const ocRaw = toStr(pickFirst(rec, ['openClose']))?.toLowerCase();
  const open_close: 'open' | 'close' | null =
    ocRaw === 'open' ? 'open' : ocRaw === 'close' ? 'close' : null;

  const execMs = toInt(pickFirst(rec, ['eventTime', 'time', 'fillTime', 'executedAt']));

  return {
    execution_id: execId,
    order_id: toInt(pickFirst(rec, ['orderId'])),
    position_id: toInt(pickFirst(rec, ['positionId'])),
    tradable_instrument_id: toInt(pickFirst(rec, ['tradableInstrumentId', 'instrumentId'])),
    side,
    open_close,
    quantity: toNum(pickFirst(rec, ['qty', 'quantity', 'filledQty'])),
    price: toNum(pickFirst(rec, ['price', 'fillPrice'])),
    commission: toNum(pickFirst(rec, ['commission'])),
    swap: toNum(pickFirst(rec, ['swap'])),
    realized_pnl: toNum(pickFirst(rec, ['pnl', 'realizedPnl'])),
    currency: toStr(pickFirst(rec, ['currency'])),
    executed_at: execMs ? new Date(execMs).toISOString() : null,
    raw: rec,
  };
}

export interface NormalizedStatement {
  operation_id: number;
  operation_type: string | null;
  normalized_type: 'deposit' | 'withdrawal' | 'fee' | 'dividend' | 'interest' | 'other';
  amount: number | null;
  balance_after: number | null;
  currency: string | null;
  description: string | null;
  symbol: string | null;
  occurred_at: string | null;
  raw: unknown;
}

const STATEMENT_TYPE_MAP: Record<string, NormalizedStatement['normalized_type']> = {
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  COMMISSION: 'fee',
  SWAP: 'fee',
  FEE: 'fee',
  DIVIDEND: 'dividend',
  INTEREST: 'interest',
  CASHFLOW_DIVIDEND: 'dividend',
  TAX: 'fee',
  ADJUSTMENT: 'other',
  CORRECTION: 'other',
  TRANSFER_IN: 'deposit',
  TRANSFER_OUT: 'withdrawal',
  // Colmex title-case variants (after uppercasing)
  'PORTFOLIO OVERNIGHT FEE': 'fee',
  'OVERNIGHT FEE': 'fee',
};

/** מיפוי גמיש — Colmex מחזיר לעיתים Title Case / מחרוזות עם רווחים */
export function mapStatementOperationType(
  opType: string | null | undefined
): NormalizedStatement['normalized_type'] {
  const raw = (opType ?? '').trim();
  if (!raw) return 'other';
  const upper = raw.toUpperCase();
  if (STATEMENT_TYPE_MAP[upper]) return STATEMENT_TYPE_MAP[upper];
  if (upper.includes('WITHDRAW')) return 'withdrawal';
  if (upper.includes('DEPOSIT') || upper.includes('TRANSFER IN') || upper.includes('FUNDING')) {
    return 'deposit';
  }
  if (
    upper.includes('FEE') ||
    upper.includes('COMMISSION') ||
    upper.includes('SWAP') ||
    upper.includes('TAX')
  ) {
    return 'fee';
  }
  if (upper.includes('DIVIDEND')) return 'dividend';
  if (upper.includes('INTEREST')) return 'interest';
  if (upper === 'P/L' || upper === 'PL' || upper === 'PNL' || upper.includes('PROFIT')) {
    return 'other';
  }
  return 'other';
}

export function normalizeStatement(
  row: string[],
  columns: ColmexColumn[]
): NormalizedStatement | null {
  const rec = arrayToRecord(row, columns);
  const opId = toInt(pickFirst(rec, ['accountOperationId', 'id', 'operationId']));
  if (opId === null) return null;

  const opType = toStr(pickFirst(rec, ['operationType', 'type', 'transactionType']));
  const normalized_type = mapStatementOperationType(opType);

  const amount = toNum(pickFirst(rec, ['amount', 'value']));
  // Colmex panel uses createDate (not createdDate) — ms epoch
  const occurredMs = toInt(
    pickFirst(rec, [
      'createDate',
      'createdDate',
      'time',
      'date',
      'operationTime',
      'eventTime',
    ])
  );

  return {
    operation_id: opId,
    operation_type: opType,
    normalized_type,
    amount,
    balance_after: toNum(pickFirst(rec, ['balance', 'balanceAfter'])),
    currency: toStr(pickFirst(rec, ['currency'])),
    description: toStr(pickFirst(rec, ['comment', 'description', 'note', 'details'])),
    symbol: toStr(pickFirst(rec, ['symbol', 'instrumentName'])),
    occurred_at: occurredMs ? new Date(occurredMs).toISOString() : null,
    raw: rec,
  };
}

// ============================================================================
// Symbol resolution helper
// ----------------------------------------------------------------------------
// כשמדובר ב-tradableInstrumentId, אנחנו צריכים את ה-symbol שלנו (ticker).
// מנגנון: בכל sync run, אנחנו רענון של broker_instrument_map.
// ============================================================================

export function colmexInstrumentToMapRow(inst: ColmexInstrument, broker: string) {
  const assetType =
    inst.type === 'EQUITY' || inst.type === 'EQUITY_CFD'
      ? 'stock'
      : inst.type === 'ETF'
      ? 'etf'
      : inst.type === 'CRYPTO'
      ? 'crypto'
      : inst.type === 'FOREX'
      ? 'forex'
      : inst.type === 'FUTURES' || inst.type === 'FUTURES_CFD'
      ? 'futures'
      : null;
  return {
    broker,
    tradable_instrument_id: inst.tradableInstrumentId,
    symbol: inst.name,
    asset_type: assetType,
    exchange: inst.tradingExchange ?? null,
    market_data_exchange: inst.marketDataExchange ?? null,
    name: inst.description ?? null,
    raw: inst as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  };
}
