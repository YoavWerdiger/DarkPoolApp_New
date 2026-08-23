// supabase/functions/broker-colmex-sync/index.ts
// ----------------------------------------------------------------------------
// Edge Function: סנכרון מלא לחיבור Colmex Pro של משתמש.
//
// מצבי הפעלה:
//   1. invocation עם header `Authorization: Bearer <user JWT>` —
//      ה-function מאתרת את ה-broker_connection של המשתמש המחובר ועושה sync.
//   2. invocation מ-cron (service_role) עם body `{ connectionId: UUID }` —
//      מסנכרנת חיבור מסוים. אם לא נשלח connectionId — מסנכרנת את כל
//      ה-connections הפעילים שלא סונכרנו ב-15 דקות האחרונות (max 20).
//
// השלבים לכל חיבור:
//   1. שליפת tokens + credentials מ-vault.secrets
//   2. אם token פג תוקף – re-authorize (אם הצליח, שומר tokens חדשים)
//   3. רענון broker_panel_config (כדי שעמודות יהיו עדכניות)
//   4. רענון broker_instrument_map עבור הnpחשבון הראשון
//   5. עבור כל broker_account של החיבור:
//      a. /state → broker_account_state
//      b. /positions → broker_positions (delete-then-insert)
//      c. /orders → broker_open_orders (delete-then-insert)
//      d. /executions (incremental) → broker_executions
//      e. /statements (incremental) → broker_statements
//      f. RPC ingest_broker_executions_to_portfolio
//      g. RPC ingest_broker_statements_to_portfolio
//      h. RPC sync_broker_positions_to_trades (broker_positions → trades + cash)
//   6. broker_connections.last_sync_at + log row
// ----------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.94.1';
import {
  authorizeWithPassword,
  getAccountState,
  getConfig,
  getExecutions,
  getOrders,
  getPositions,
  getStatements,
  listAccounts,
  listInstruments,
  normalizeAccountState,
  normalizeExecution,
  normalizeOpenOrder,
  normalizePosition,
  normalizeStatement,
  refreshAccessToken,
  type ColmexColumn,
  type ColmexEnv,
  type ColmexTokens,
  colmexInstrumentToMapRow,
  ColmexError,
} from '../_shared/colmex.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SyncRequest {
  connectionId?: string;
  brokerAccountIds?: string[]; // אופציונלי: סנכרון של חשבונות ספציפיים בלבד
  full?: boolean;              // אם true – טוען historical executions/statements מאז 0
}

interface SyncMetrics {
  positions_synced: number;
  orders_synced: number;
  executions_synced: number;
  statements_synced: number;
  portfolio_tx_ingested: number;
  state_synced: boolean;
}

function emptyMetrics(): SyncMetrics {
  return {
    positions_synced: 0,
    orders_synced: 0,
    executions_synced: 0,
    statements_synced: 0,
    portfolio_tx_ingested: 0,
    state_synced: false,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'server_misconfigured' }, 500);

  const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // identify caller — user JWT או cron (service)
  let callerUserId: string | null = null;
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const jwt = authHeader.slice('Bearer '.length);
    if (jwt !== SERVICE_KEY) {
      const { data: userData } = await sb.auth.getUser(jwt);
      callerUserId = userData?.user?.id ?? null;
    }
  }

  let body: SyncRequest = {};
  try {
    body = (await req.json()) as SyncRequest;
  } catch {
    /* body optional */
  }

  // ----- בחירת חיבורים לסנכרון -----
  const connectionsToSync = await pickConnectionsToSync(sb, body, callerUserId);
  if (connectionsToSync.length === 0) {
    return jsonResponse({ ok: true, synced: 0, message: 'no_connections_to_sync' });
  }

  const results: Array<{
    connectionId: string;
    status: 'success' | 'partial' | 'failed';
    metrics: Record<string, SyncMetrics>;
    error?: string;
  }> = [];

  for (const conn of connectionsToSync) {
    try {
      const r = await syncConnection(sb, conn, body.full ?? false, body.brokerAccountIds);
      results.push({ connectionId: conn.id, status: r.status, metrics: r.metrics });
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      results.push({ connectionId: conn.id, status: 'failed', metrics: {}, error: msg });
      await sb
        .from('broker_connections')
        .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'failed', last_sync_error: msg })
        .eq('id', conn.id);
      await sb.from('broker_sync_log').insert({
        connection_id: conn.id,
        user_id: conn.user_id,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        status: 'failed',
        scope: [],
        error_message: msg,
      });
    }
  }

  return jsonResponse({ ok: true, synced: results.length, results });
});

// ----------------------------------------------------------------------------
// Connection selection
// ----------------------------------------------------------------------------

interface BrokerConnectionRow {
  id: string;
  user_id: string;
  broker: string;
  environment: ColmexEnv;
  status: string;
  vault_secret_name: string | null;
  vault_token_secret_name: string | null;
  token_expires_at: string | null;
}

async function pickConnectionsToSync(
  sb: SupabaseClient,
  body: SyncRequest,
  callerUserId: string | null
): Promise<BrokerConnectionRow[]> {
  if (body.connectionId) {
    const { data } = await sb
      .from('broker_connections')
      .select('id,user_id,broker,environment,status,vault_secret_name,vault_token_secret_name,token_expires_at')
      .eq('id', body.connectionId)
      .eq('status', 'active')
      .maybeSingle();
    return data ? [data as BrokerConnectionRow] : [];
  }

  if (callerUserId) {
    const { data } = await sb
      .from('broker_connections')
      .select('id,user_id,broker,environment,status,vault_secret_name,vault_token_secret_name,token_expires_at')
      .eq('user_id', callerUserId)
      .eq('status', 'active');
    return (data as BrokerConnectionRow[]) ?? [];
  }

  // cron-style: ילד חיבורים פעילים שלא סונכרנו לאחרונה
  const cutoff = new Date(Date.now() - 12 * 60 * 1000).toISOString();
  const { data } = await sb
    .from('broker_connections')
    .select('id,user_id,broker,environment,status,vault_secret_name,vault_token_secret_name,token_expires_at,last_sync_at')
    .eq('status', 'active')
    .or(`last_sync_at.is.null,last_sync_at.lt.${cutoff}`)
    .limit(20);
  return (data as BrokerConnectionRow[]) ?? [];
}

// ----------------------------------------------------------------------------
// Sync one connection
// ----------------------------------------------------------------------------

async function syncConnection(
  sb: SupabaseClient,
  conn: BrokerConnectionRow,
  full: boolean,
  filterAccountIds: string[] | undefined
): Promise<{ status: 'success' | 'partial' | 'failed'; metrics: Record<string, SyncMetrics> }> {
  const logStartedAt = new Date().toISOString();
  const env = conn.environment;

  // 1. tokens
  let tokens = await loadTokens(sb, conn);
  if (!tokens || tokens.expiresAt <= Date.now()) {
    tokens = await ensureFreshTokens(sb, conn, tokens);
  }
  if (!tokens) {
    await sb
      .from('broker_connections')
      .update({ status: 'expired', last_sync_at: logStartedAt, last_sync_status: 'failed', last_sync_error: 'token_unavailable' })
      .eq('id', conn.id);
    return { status: 'failed', metrics: {} };
  }

  // Colmex מגבילה session אחד למשתמש: כל /authorize חדש הורג את ה-token הקודם,
  // גם אם token_expires_at עדיין עתידי. לכן 401 הוא אירוע צפוי ולא שגיאה סופית —
  // מבצעים re-authorize ומנסים שוב פעם אחת. ה-flag מבטיח authorize אחד לכל ריצה,
  // כדי שלא ייווצר לופ מול חיבור מתחרה שהורג את ה-session שוב ושוב.
  let activeTokens: ColmexTokens = tokens;
  let reauthAttempted = false;

  const withAuth = async <T>(fn: (t: ColmexTokens) => Promise<T>): Promise<T> => {
    try {
      return await fn(activeTokens);
    } catch (e) {
      const is401 = e instanceof ColmexError && e.status === 401;
      if (!is401 || reauthAttempted) throw e;
      reauthAttempted = true;
      const fresh = await ensureFreshTokens(sb, conn, activeTokens);
      if (!fresh) throw e;
      activeTokens = fresh;
      return await fn(fresh);
    }
  };

  // 2. config refresh
  let positionsCols: ColmexColumn[] = [];
  let ordersCols:    ColmexColumn[] = [];
  let executionsCols: ColmexColumn[] = [];
  let accountStateCols: ColmexColumn[] = [];
  let statementsCols: ColmexColumn[] = [];
  try {
    const config = await withAuth((t) => getConfig(env, t));
    if (config) {
      positionsCols    = config.positionsConfig?.columns       ?? [];
      ordersCols       = config.ordersConfig?.columns          ?? [];
      executionsCols   = config.filledOrdersConfig?.columns    ?? [];
      accountStateCols = config.accountDetailsConfig?.columns  ?? [];
      statementsCols   = config.statementsConfig?.columns      ?? [];
      const panels = [
        ['positions',      config.positionsConfig?.columns],
        ['orders',         config.ordersConfig?.columns],
        ['ordersHistory',  config.ordersHistoryConfig?.columns],
        ['filledOrders',   config.filledOrdersConfig?.columns],
        ['accountDetails', config.accountDetailsConfig?.columns],
        ['statements',     config.statementsConfig?.columns],
      ] as const;
      for (const [pid, cols] of panels) {
        if (!cols?.length) continue;
        await sb.from('broker_panel_config').upsert(
          {
            broker: 'colmex_pro',
            panel_id: pid,
            columns: cols,
            customer_access: config.customerAccess ?? null,
            rate_limits: config.rateLimits ?? null,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'broker,panel_id' }
        );
      }
    }
  } catch (e) {
    console.warn('config refresh failed:', (e as Error).message);
    // נטען מהcache
    const { data: cached } = await sb
      .from('broker_panel_config')
      .select('panel_id,columns')
      .eq('broker', 'colmex_pro');
    for (const row of (cached ?? []) as Array<{ panel_id: string; columns: ColmexColumn[] }>) {
      if (row.panel_id === 'positions')      positionsCols = row.columns;
      if (row.panel_id === 'orders')         ordersCols = row.columns;
      if (row.panel_id === 'filledOrders')   executionsCols = row.columns;
      if (row.panel_id === 'accountDetails') accountStateCols = row.columns;
      if (row.panel_id === 'statements')     statementsCols = row.columns;
    }
  }

  // 3. accounts
  const accountsApi = await withAuth((t) => listAccounts(env, t));
  if (accountsApi.length === 0) {
    await sb
      .from('broker_connections')
      .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'failed', last_sync_error: 'no_accounts' })
      .eq('id', conn.id);
    return { status: 'failed', metrics: {} };
  }

  // sync accounts metadata
  await sb.from('broker_accounts').upsert(
    accountsApi.map((a) => ({
      connection_id: conn.id,
      user_id: conn.user_id,
      broker_account_id: a.id,
      account_name: a.name,
      account_type: a.type ?? null,
      currency: a.currency ?? 'USD',
      status: a.status ?? null,
      trading_rules: a.tradingRules ?? null,
      risk_rules: a.riskRules ?? null,
      margin_rules: a.marginRules ?? null,
    })),
    { onConflict: 'connection_id,broker_account_id' }
  );

  // refresh instrument map (primary account only)
  try {
    const insts = await withAuth((t) => listInstruments(env, t, accountsApi[0].id));
    if (insts.length > 0) {
      const rows = insts.map((i) => colmexInstrumentToMapRow(i, 'colmex_pro'));
      const chunk = 500;
      for (let i = 0; i < rows.length; i += chunk) {
        await sb
          .from('broker_instrument_map')
          .upsert(rows.slice(i, i + chunk), { onConflict: 'broker,tradable_instrument_id' });
      }
    }
  } catch (e) {
    console.warn('instrument refresh failed:', (e as Error).message);
  }

  // 4. iterate accounts
  const allMetrics: Record<string, SyncMetrics> = {};
  let overallStatus: 'success' | 'partial' = 'success';

  // load mapping of broker_account_id (Colmex) → broker_accounts.id (uuid)
  const { data: accountDbRows } = await sb
    .from('broker_accounts')
    .select('id,broker_account_id,portfolio_id')
    .eq('connection_id', conn.id);
  const accountDbByExtId = new Map<string, { id: string; portfolio_id: string | null }>();
  for (const r of (accountDbRows ?? []) as Array<{ id: string; broker_account_id: string; portfolio_id: string | null }>) {
    accountDbByExtId.set(r.broker_account_id, { id: r.id, portfolio_id: r.portfolio_id });
  }

  for (const acc of accountsApi) {
    if (filterAccountIds && filterAccountIds.length > 0 && !filterAccountIds.includes(acc.id)) continue;

    const db = accountDbByExtId.get(acc.id);
    if (!db) continue; // shouldn't happen — just upserted
    const brokerAccountUuid = db.id;
    const metrics = emptyMetrics();

    // 4a. state
    try {
      const stateArr = await withAuth((t) => getAccountState(env, t, acc.id));
      const ns = normalizeAccountState(stateArr as Array<number | string>, accountStateCols);
      await sb.from('broker_account_state').upsert(
        {
          broker_account_id: brokerAccountUuid,
          user_id: conn.user_id,
          balance: ns.balance,
          equity: ns.equity,
          available_funds: ns.available_funds,
          margin_used: ns.margin_used,
          margin_available: ns.margin_available,
          projected_balance: ns.projected_balance,
          unrealized_pnl: ns.unrealized_pnl,
          realized_pnl_today: ns.realized_pnl_today,
          blocked_funds: ns.blocked_funds,
          currency: ns.currency ?? acc.currency ?? 'USD',
          raw: ns.raw,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'broker_account_id' }
      );
      metrics.state_synced = true;
    } catch (e) {
      overallStatus = 'partial';
      console.warn(`state sync failed for ${acc.id}:`, (e as Error).message);
    }

    // 4b. positions (full replace)
    try {
      const posRows = await withAuth((t) => getPositions(env, t, acc.id));
      const positions = posRows
        .map((r) => normalizePosition(r, positionsCols))
        .filter((p): p is NonNullable<typeof p> => !!p);

      // symbol resolution
      await resolveSymbols(sb, positions);

      // delete missing, upsert current
      const positionIds = positions.map((p) => p.position_id);
      if (positionIds.length > 0) {
        await sb
          .from('broker_positions')
          .delete()
          .eq('broker_account_id', brokerAccountUuid)
          .not('position_id', 'in', `(${positionIds.join(',')})`);
      } else {
        await sb.from('broker_positions').delete().eq('broker_account_id', brokerAccountUuid);
      }

      if (positions.length > 0) {
        await sb.from('broker_positions').upsert(
          positions.map((p) => ({
            broker_account_id: brokerAccountUuid,
            user_id: conn.user_id,
            position_id: p.position_id,
            tradable_instrument_id: p.tradable_instrument_id,
            symbol: (p as unknown as { _symbol?: string })._symbol ?? null,
            side: p.side,
            quantity: p.quantity,
            avg_open_price: p.avg_open_price,
            current_price: p.current_price,
            unrealized_pnl: p.unrealized_pnl,
            realized_pnl: p.realized_pnl,
            swap: p.swap,
            commission: p.commission,
            stop_loss: p.stop_loss,
            take_profit: p.take_profit,
            trailing_offset: p.trailing_offset,
            opened_at: p.opened_at,
            raw: p.raw,
          })),
          { onConflict: 'broker_account_id,position_id' }
        );
      }
      metrics.positions_synced = positions.length;
    } catch (e) {
      overallStatus = 'partial';
      console.warn(`positions sync failed for ${acc.id}:`, (e as Error).message);
    }

    // 4c. orders (full replace)
    try {
      const ordRows = await withAuth((t) => getOrders(env, t, acc.id));
      const orders = ordRows
        .map((r) => normalizeOpenOrder(r, ordersCols))
        .filter((o): o is NonNullable<typeof o> => !!o);
      await resolveSymbols(sb, orders);

      const orderIds = orders.map((o) => o.order_id);
      if (orderIds.length > 0) {
        await sb
          .from('broker_open_orders')
          .delete()
          .eq('broker_account_id', brokerAccountUuid)
          .not('order_id', 'in', `(${orderIds.join(',')})`);
      } else {
        await sb.from('broker_open_orders').delete().eq('broker_account_id', brokerAccountUuid);
      }

      if (orders.length > 0) {
        await sb.from('broker_open_orders').upsert(
          orders.map((o) => ({
            broker_account_id: brokerAccountUuid,
            user_id: conn.user_id,
            order_id: o.order_id,
            position_id: o.position_id,
            tradable_instrument_id: o.tradable_instrument_id,
            symbol: (o as unknown as { _symbol?: string })._symbol ?? null,
            side: o.side,
            order_type: o.order_type,
            status: o.status,
            quantity: o.quantity,
            filled_quantity: o.filled_quantity,
            price: o.price,
            stop_price: o.stop_price,
            stop_loss: o.stop_loss,
            take_profit: o.take_profit,
            trailing_offset: o.trailing_offset,
            validity: o.validity,
            expire_at: o.expire_at,
            user_comment: o.user_comment,
            placed_at: o.placed_at,
            raw: o.raw,
          })),
          { onConflict: 'broker_account_id,order_id' }
        );
      }
      metrics.orders_synced = orders.length;
    } catch (e) {
      overallStatus = 'partial';
      console.warn(`orders sync failed for ${acc.id}:`, (e as Error).message);
    }

    // 4d. executions (incremental: pull לפי last fetched)
    try {
      const sinceTs = full ? 0 : await loadIncrementalCursor(sb, brokerAccountUuid, 'executions');
      const execRows = await withAuth((t) =>
        getExecutions(env, t, acc.id, {
          from: sinceTs > 0 ? sinceTs : undefined,
          numberOfLines: 1000,
        })
      );
      const execs = execRows
        .map((r) => normalizeExecution(r, executionsCols))
        .filter((e): e is NonNullable<typeof e> => !!e);
      await resolveSymbols(sb, execs);

      if (execs.length > 0) {
        await sb.from('broker_executions').upsert(
          execs.map((e) => ({
            broker_account_id: brokerAccountUuid,
            user_id: conn.user_id,
            execution_id: e.execution_id,
            order_id: e.order_id,
            position_id: e.position_id,
            tradable_instrument_id: e.tradable_instrument_id,
            symbol: (e as unknown as { _symbol?: string })._symbol ?? null,
            side: e.side,
            open_close: e.open_close,
            quantity: e.quantity,
            price: e.price,
            commission: e.commission,
            swap: e.swap,
            realized_pnl: e.realized_pnl,
            currency: e.currency,
            executed_at: e.executed_at,
            raw: e.raw,
          })),
          { onConflict: 'broker_account_id,execution_id' }
        );
        await saveIncrementalCursor(sb, brokerAccountUuid, 'executions', Date.now());
      }
      metrics.executions_synced = execs.length;
    } catch (e) {
      overallStatus = 'partial';
      console.warn(`executions sync failed for ${acc.id}:`, (e as Error).message);
    }

    // 4e. statements — pagination ב-operationId (גם ב-incremental, כדי לא לפספס דפים)
    try {
      const sinceTs = full ? 0 : await loadIncrementalCursor(sb, brokerAccountUuid, 'statements');
      const allStmts: NonNullable<ReturnType<typeof normalizeStatement>>[] = [];
      let opCursor: number | undefined;
      let pages = 0;
      // full: עד 200 דפים; incremental: עד 20 (מספיק ליום מסחר עמוס)
      const maxPages = full ? 200 : 20;
      const pageSize = 1000;

      while (pages < maxPages) {
        pages += 1;
        const stRows = await withAuth((t) =>
          getStatements(env, t, acc.id, {
            // full: ללא from — כל ההיסטוריה שה-API מחזיר
            from: !full && sinceTs > 0 ? sinceTs : full ? 0 : undefined,
            operationId: opCursor,
            numberOfLines: pageSize,
          })
        );
        if (stRows.length === 0) break;
        const batch = stRows
          .map((r) => normalizeStatement(r, statementsCols))
          .filter((s): s is NonNullable<typeof s> => !!s);
        allStmts.push(...batch);
        const minOp = batch.reduce(
          (m, s) => (m == null || s.operation_id < m ? s.operation_id : m),
          null as number | null
        );
        // אין עוד דפים אם קיבלנו פחות מ-full page או אין operationId קטן יותר
        if (stRows.length < pageSize || minOp == null) break;
        if (opCursor != null && minOp >= opCursor) break;
        opCursor = minOp;
      }

      if (allStmts.length > 0) {
        // upsert במנות כדי לא לחרוג ממגבלת payload
        for (let i = 0; i < allStmts.length; i += 500) {
          const chunk = allStmts.slice(i, i + 500);
          await sb.from('broker_statements').upsert(
            chunk.map((s) => ({
              broker_account_id: brokerAccountUuid,
              user_id: conn.user_id,
              operation_id: s.operation_id,
              operation_type: s.operation_type,
              normalized_type: s.normalized_type,
              amount: s.amount,
              balance_after: s.balance_after,
              currency: s.currency,
              description: s.description,
              symbol: s.symbol,
              occurred_at: s.occurred_at,
              raw: s.raw,
            })),
            { onConflict: 'broker_account_id,operation_id' }
          );
        }
        await saveIncrementalCursor(sb, brokerAccountUuid, 'statements', Date.now());
      }
      metrics.statements_synced = allStmts.length;
    } catch (e) {
      overallStatus = 'partial';
      console.warn(`statements sync failed for ${acc.id}:`, (e as Error).message);
    }

    // 4f+g. ingest to portfolio + sync positions → trades (אם יש portfolio_id)
    if (db.portfolio_id) {
      try {
        const { data: ingestEx } = await sb.rpc('ingest_broker_executions_to_portfolio', {
          p_broker_account_id: brokerAccountUuid,
        });
        const { data: ingestSt } = await sb.rpc('ingest_broker_statements_to_portfolio', {
          p_broker_account_id: brokerAccountUuid,
        });
        metrics.portfolio_tx_ingested =
          ((ingestEx as number | null) ?? 0) + ((ingestSt as number | null) ?? 0);
      } catch (e) {
        overallStatus = 'partial';
        console.warn(`portfolio ingest failed:`, (e as Error).message);
      }

      // גשר ל-UI: Overview / Open Trades / סטטיסטיקות קוראים מ-trades + available_cash
      try {
        await sb.rpc('sync_broker_positions_to_trades', {
          p_broker_account_id: brokerAccountUuid,
        });
      } catch (e) {
        overallStatus = 'partial';
        console.warn(`positions→trades sync failed:`, (e as Error).message);
      }

      // יתרת פתיחה + snapshot בנוסחת net_deposits+realized (כמו תיקים ידניים)
      try {
        await sb.rpc('reconcile_colmex_opening_deposit', {
          p_portfolio_id: db.portfolio_id,
        });
      } catch (e) {
        console.warn(`opening balance reconcile failed:`, (e as Error).message);
      }

      try {
        const today = new Date().toISOString().slice(0, 10);
        await sb.rpc('upsert_daily_snapshot', {
          p_portfolio_id: db.portfolio_id,
          p_date: today,
        });
      } catch (e) {
        console.warn(`daily snapshot failed:`, (e as Error).message);
      }
    }

    allMetrics[acc.id] = metrics;
  }

  // 5. log + update last_sync
  const finishedAt = new Date().toISOString();
  await sb
    .from('broker_connections')
    .update({
      last_sync_at: finishedAt,
      last_sync_status: overallStatus,
      last_sync_error: overallStatus === 'success' ? null : 'partial_sync',
    })
    .eq('id', conn.id);

  await sb.from('broker_sync_log').insert({
    connection_id: conn.id,
    user_id: conn.user_id,
    started_at: logStartedAt,
    finished_at: finishedAt,
    status: overallStatus,
    scope: ['state', 'positions', 'orders', 'executions', 'statements'],
    metrics: allMetrics,
  });

  return { status: overallStatus, metrics: allMetrics };
}

// ----------------------------------------------------------------------------
// Tokens management
// ----------------------------------------------------------------------------

async function loadTokens(sb: SupabaseClient, conn: BrokerConnectionRow): Promise<ColmexTokens | null> {
  if (!conn.vault_token_secret_name) return null;
  const { data } = await sb.rpc('broker_get_vault_secret', { p_name: conn.vault_token_secret_name });
  const txt = data as string | null;
  if (!txt) return null;
  try {
    return JSON.parse(txt) as ColmexTokens;
  } catch {
    return null;
  }
}

async function ensureFreshTokens(
  sb: SupabaseClient,
  conn: BrokerConnectionRow,
  currentTokens: ColmexTokens | null
): Promise<ColmexTokens | null> {
  // ה-API של Colmex Pro (במצב password) אינו מספק refresh_token אמיתי.
  // לכן רענון = re-authorize עם credentials מה-Vault.
  if (!conn.vault_secret_name) return null;
  const { data: credData } = await sb.rpc('broker_get_vault_secret', { p_name: conn.vault_secret_name });
  const credTxt = credData as string | null;
  if (!credTxt) return null;
  try {
    const creds = JSON.parse(credTxt) as { username: string; password: string };
    // ניסיון רענון/אישור מחדש (אם יש refresh token עתידי, נשתמש בו; כרגע fallback ל-creds)
    let fresh: ColmexTokens;
    if (currentTokens?.refreshToken) {
      try {
        fresh = await refreshAccessToken(conn.environment, currentTokens.refreshToken, creds);
      } catch (e) {
        if (e instanceof ColmexError && e.status !== 401) {
          console.warn('refresh failed:', e.message);
        }
        fresh = await authorizeWithPassword(conn.environment, creds);
      }
    } else {
      fresh = await authorizeWithPassword(conn.environment, creds);
    }
    await saveTokens(sb, conn, fresh);
    return fresh;
  } catch (e) {
    console.error('re-authorize failed:', (e as Error).message);
    return null;
  }
}

async function saveTokens(sb: SupabaseClient, conn: BrokerConnectionRow, tokens: ColmexTokens): Promise<void> {
  if (!conn.vault_token_secret_name) return;
  await sb.rpc('broker_upsert_vault_secret', {
    p_name: conn.vault_token_secret_name,
    p_secret: JSON.stringify(tokens),
    p_description: `Colmex ${conn.environment} tokens for ${conn.user_id}`,
  });
  await sb
    .from('broker_connections')
    .update({ token_expires_at: new Date(tokens.expiresAt).toISOString() })
    .eq('id', conn.id);
}

// ----------------------------------------------------------------------------
// Symbol resolution
// ----------------------------------------------------------------------------
/**
 * מקבל מערך של אובייקטים עם tradable_instrument_id, מוסיף `_symbol` לכל אחד.
 * מבוסס על broker_instrument_map.
 */
async function resolveSymbols<T extends { tradable_instrument_id: number | null }>(
  sb: SupabaseClient,
  items: T[]
): Promise<void> {
  const ids = Array.from(
    new Set(items.map((x) => x.tradable_instrument_id).filter((v): v is number => v !== null))
  );
  if (ids.length === 0) return;

  const { data } = await sb
    .from('broker_instrument_map')
    .select('tradable_instrument_id,symbol')
    .eq('broker', 'colmex_pro')
    .in('tradable_instrument_id', ids);

  const byId = new Map<number, string>();
  for (const r of (data ?? []) as Array<{ tradable_instrument_id: number; symbol: string }>) {
    byId.set(r.tradable_instrument_id, r.symbol);
  }
  for (const it of items) {
    if (it.tradable_instrument_id != null) {
      (it as unknown as { _symbol?: string })._symbol = byId.get(it.tradable_instrument_id);
    }
  }
}

// ----------------------------------------------------------------------------
// Incremental cursors (broker_sync_log metrics)
// ----------------------------------------------------------------------------

async function loadIncrementalCursor(
  sb: SupabaseClient,
  brokerAccountUuid: string,
  scope: 'executions' | 'statements'
): Promise<number> {
  // cursor = max(executed_at|occurred_at) של ישויות שכבר שמורות
  const col = scope === 'executions' ? 'executed_at' : 'occurred_at';
  const table = scope === 'executions' ? 'broker_executions' : 'broker_statements';
  const { data } = await sb
    .from(table)
    .select(col)
    .eq('broker_account_id', brokerAccountUuid)
    .order(col, { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as Record<string, string | null> | null;
  const iso = row?.[col];
  if (!iso) return 0;
  // נחזיר 5 שעות אחורה כדי לתפוס overlap (סנכרון של עסקאות שנערכו בזמן הקטע)
  return Date.parse(iso) - 5 * 3600 * 1000;
}

async function saveIncrementalCursor(
  _sb: SupabaseClient,
  _brokerAccountUuid: string,
  _scope: 'executions' | 'statements',
  _ts: number
): Promise<void> {
  // ה-cursor אינו מוחזק בטבלה נפרדת — מחושב מ-max(executed_at) על broker_executions/statements
  // הפונקציה משאירה hook לעתיד אם נרצה לאחסן cursor מפורש (eventId/operationId).
}
