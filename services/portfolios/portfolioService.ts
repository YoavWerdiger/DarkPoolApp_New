/**
 * portfolioService.ts
 * --------------------------------------------------------------------------
 * שכבת CRUD ל-Supabase לטבלאות portfolios + portfolio_transactions.
 * משתמשת ב-RLS - כל קריאה אוטומטית מסוננת ע"פ user_id המחובר.
 */

import { supabase } from '../../lib/supabase';
import type {
  Portfolio,
  PortfolioInsert,
  PortfolioTransaction,
  AssetTransactionInsert,
  CashTransactionInsert,
  DividendTransactionInsert,
  AnyTransactionInsert,
  PortfolioValuePoint,
} from '../../screens/Portfolios/portfolioTypes';

// ---------------------------------------------------------------------------
// Portfolios
// ---------------------------------------------------------------------------

export async function listPortfolios(): Promise<Portfolio[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) throw new Error('not_authenticated');
  /** חובה: RLS מאפשר גם SELECT לתיקים ציבוריים של אחרים — כאן רק התיקים של המשתמש המחובר */
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', auth.user.id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Portfolio[];
}

/** תיקים שסומנו כציבוריים — לא כוללים את התיקים של המשתמש המחובר (מופיעים ב«התיקים שלי»). */
export async function listPublicPortfolios(): Promise<Portfolio[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  let q = supabase
    .from('portfolios')
    .select('*')
    .eq('is_public', true)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });
  if (uid) {
    q = q.neq('user_id', uid);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Portfolio[];
}

/**
 * שמות תצוגה לרשימת קהילה — קורא ל-RPC `get_user_display_names` (SECURITY DEFINER)
 * שמחזיר id + display_name בלבד, עוקף RLS של public.users בצורה בטוחה.
 */
export async function getUsersDisplayNamesByIds(
  userIds: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return {};
  const { data, error } = await supabase.rpc('get_user_display_names', {
    user_ids: unique,
  });
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const row of data as Array<{ id: string; display_name: string }>) {
    if (row.id) map[row.id] = row.display_name || 'משתמש';
  }
  return map;
}

export async function getPortfolio(id: string): Promise<Portfolio | null> {
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Portfolio) ?? null;
}

export async function createPortfolio(
  input: PortfolioInsert
): Promise<Portfolio> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error('not_authenticated');
  const payload = {
    user_id: auth.user.id,
    name: input.name,
    currency: input.currency,
    risk_free_rate: input.risk_free_rate,
    benchmark_symbol: input.benchmark_symbol,
    auto_adjust_splits: input.auto_adjust_splits ?? true,
    description: input.description ?? null,
    is_public: input.is_public ?? false,
  };
  const { data, error } = await supabase
    .from('portfolios')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Portfolio;
}

export async function updatePortfolio(
  id: string,
  patch: Partial<PortfolioInsert>
): Promise<Portfolio> {
  const { data, error } = await supabase
    .from('portfolios')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Portfolio;
}

export async function deletePortfolio(id: string): Promise<void> {
  const { error } = await supabase.from('portfolios').delete().eq('id', id);
  if (error) throw error;
}

export async function archivePortfolio(id: string): Promise<void> {
  const { error } = await supabase
    .from('portfolios')
    .update({ is_archived: true })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function listTransactions(
  portfolioId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<PortfolioTransaction[]> {
  let q = supabase
    .from('portfolio_transactions')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('date', { ascending: false });

  if (opts.limit) q = q.limit(opts.limit);
  if (opts.offset)
    q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PortfolioTransaction[];
}

export async function getTransaction(
  id: string
): Promise<PortfolioTransaction | null> {
  const { data, error } = await supabase
    .from('portfolio_transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as PortfolioTransaction) ?? null;
}

function buildTxPayload(input: AnyTransactionInsert): Record<string, unknown> {
  const base: Record<string, unknown> = {
    portfolio_id: input.portfolio_id,
    type: input.type,
    date: input.date,
    notes: input.notes ?? null,
    currency: input.currency ?? 'USD',
  };

  switch (input.type) {
    case 'buy':
    case 'sell': {
      const t = input as AssetTransactionInsert;
      return {
        ...base,
        symbol: t.symbol,
        asset_type: t.asset_type,
        exchange: t.exchange ?? null,
        quantity: t.quantity,
        price: t.price,
        commission: t.commission ?? 0,
        direction: t.direction ?? 'long',
      };
    }
    case 'deposit':
    case 'withdrawal':
    case 'fee': {
      const t = input as CashTransactionInsert;
      return {
        ...base,
        amount: t.amount,
      };
    }
    case 'dividend': {
      const t = input as DividendTransactionInsert;
      return {
        ...base,
        symbol: t.symbol,
        amount: t.amount,
      };
    }
    default:
      throw new Error(`unknown_tx_type`);
  }
}

export async function createTransaction(
  input: AnyTransactionInsert
): Promise<PortfolioTransaction> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error('not_authenticated');
  const payload = {
    ...buildTxPayload(input),
    user_id: auth.user.id,
  };
  const { data, error } = await supabase
    .from('portfolio_transactions')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as PortfolioTransaction;
}

export async function bulkCreateTransactions(
  inputs: AnyTransactionInsert[]
): Promise<number> {
  if (!inputs.length) return 0;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error('not_authenticated');
  const payload = inputs.map((t) => ({
    ...buildTxPayload(t),
    user_id: auth.user!.id,
  }));
  const { error, count } = await supabase
    .from('portfolio_transactions')
    .insert(payload, { count: 'exact' });
  if (error) throw error;
  return count ?? inputs.length;
}

export async function updateTransaction(
  id: string,
  patch: Partial<AnyTransactionInsert>
): Promise<PortfolioTransaction> {
  const { data, error } = await supabase
    .from('portfolio_transactions')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PortfolioTransaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('portfolio_transactions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/** מחזיר את כל הטרנזקציות של תיק עבור symbol יחיד (לחישובי FIFO) */
export async function listTransactionsForSymbol(
  portfolioId: string,
  symbol: string
): Promise<PortfolioTransaction[]> {
  const { data, error } = await supabase
    .from('portfolio_transactions')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .eq('symbol', symbol)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PortfolioTransaction[];
}

/** קריאה ל-RLS-protected view: תזרים כללי */
export async function getCashFlowSummary(portfolioId: string) {
  const { data, error } = await supabase
    .from('v_portfolio_cash_flow')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .maybeSingle();
  if (error) throw error;
  return data as
    | {
        total_deposits: number;
        total_withdrawals: number;
        total_fees: number;
        total_buys: number;
        total_sells: number;
        total_dividends: number;
      }
    | null;
}

/** holdings raw – לפני שילוב מחירי שוק */
export async function getHoldingsRaw(portfolioId: string) {
  const { data, error } = await supabase
    .from('v_portfolio_holdings_raw')
    .select('*')
    .eq('portfolio_id', portfolioId);
  if (error) throw error;
  return (data ?? []) as Array<{
    portfolio_id: string;
    user_id: string;
    symbol: string;
    asset_type: string | null;
    exchange: string | null;
    quantity: number;
    total_bought: number;
    total_sold: number;
    total_invested: number;
    total_proceeds: number;
    total_dividends: number;
    avg_buy_price: number;
    first_buy_date: string | null;
    last_tx_date: string;
  }>;
}

/** value history snapshots לגרף Performance */
export async function getValueHistory(
  portfolioId: string,
  days = 365
): Promise<PortfolioValuePoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('portfolio_value_history')
    .select('date, total_value, cash, invested, unrealized, realized')
    .eq('portfolio_id', portfolioId)
    .gte('date', sinceIso)
    .order('date', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    date: string;
    total_value: number | string;
    cash: number | string;
    invested: number | string;
    unrealized: number | string;
    realized: number | string;
  }>;
  return rows.map((r) => ({
    date: typeof r.date === 'string' ? r.date : String(r.date),
    total_value: Number(r.total_value),
    cash: Number(r.cash),
    invested: Number(r.invested),
    unrealized: Number(r.unrealized),
    realized: Number(r.realized),
  }));
}

/**
 * גרף שווי מבוסס טרנזקציות — {date, value}[] עם תאריכים אמיתיים.
 * מחשב הון מצטבר נטו לפי כל טרנזקציה בסדר כרונולוגי.
 * תאריכים מגיעים ישירות מ-portfolio_transactions.
 */
export async function getTransactionChartSeries(
  portfolioId: string
): Promise<{ date: string; value: number }[]> {
  const { data, error } = await supabase
    .from('portfolio_transactions')
    .select('date, type, quantity, price, amount, commission')
    .eq('portfolio_id', portfolioId)
    .order('date', { ascending: true });
  if (error || !data || data.length === 0) return [];
  type TxRow = {
    date: string;
    type: string;
    quantity: number | null;
    price: number | null;
    amount: number | null;
    commission: number | null;
  };
  const rows = data as TxRow[];
  let net = 0;
  const raw: { date: string; value: number }[] = [];
  for (const tx of rows) {
    switch (tx.type) {
      case 'buy':
        net += (tx.quantity ?? 0) * (tx.price ?? 0) + (tx.commission ?? 0);
        break;
      case 'sell':
        net = Math.max(0, net - ((tx.quantity ?? 0) * (tx.price ?? 0) - (tx.commission ?? 0)));
        break;
      case 'deposit':
        net += tx.amount ?? 0;
        break;
      case 'withdrawal':
      case 'fee':
        net = Math.max(0, net - (tx.amount ?? 0));
        break;
      case 'dividend':
        net += tx.amount ?? 0;
        break;
    }
    raw.push({ date: tx.date, value: net });
  }
  if (raw.length === 0) return [];
  // קבץ לפי יום – שמור רק את הנקודה האחרונה של כל יום
  const byDay = new Map<string, number>();
  for (const p of raw) {
    byDay.set(p.date, p.value);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));
}

/**
 * גרף ספארקליין מחושב מטרנזקציות בפועל (ללא תאריכים).
 * מחזיר מערך של ערכים לפי סדר זמן עולה.
 */
export async function getTransactionSparkline(portfolioId: string): Promise<number[]> {
  const series = await getTransactionChartSeries(portfolioId);
  if (series.length < 2) return series.length === 1 ? [series[0].value, series[0].value] : [];
  const values = series.map((p) => p.value);
  if (values.length <= 40) return values;
  const result: number[] = [];
  const step = (values.length - 1) / 39;
  for (let i = 0; i < 40; i++) result.push(values[Math.round(i * step)]);
  return result;
}
