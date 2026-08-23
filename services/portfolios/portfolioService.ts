/**
 * portfolioService.ts
 * --------------------------------------------------------------------------
 * שכבת CRUD ל-Supabase לטבלאות portfolios + portfolio_transactions.
 * משתמשת ב-RLS - כל קריאה אוטומטית מסוננת ע"פ user_id המחובר.
 */

import { supabase } from '../../lib/supabase';
import { getHistoricalPrices } from './portfolioPriceFeed';
import { brokerAlignedMarketPrice } from './portfolioCalc';
import { toLocalDateKey, todayLocalKey, daysAgoLocalKey } from '../../utils/dateKeys';
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
  const payload: Record<string, unknown> = {
    user_id: auth.user.id,
    name: input.name,
    currency: input.currency,
    risk_free_rate: input.risk_free_rate,
    benchmark_symbol: input.benchmark_symbol,
    auto_adjust_splits: input.auto_adjust_splits ?? true,
    description: input.description ?? null,
    is_public: input.is_public ?? false,
  };
  if (input.available_cash != null && input.available_cash > 0) {
    payload.available_cash = input.available_cash;
  }
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
  const sinceIso = daysAgoLocalKey(days);
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

// ---------------------------------------------------------------------------
// Historical portfolio value reconstruction
// ---------------------------------------------------------------------------

/** In-memory cache: portfolioId:rangeDays → series */
const _historicalSeriesCache = new Map<
  string,
  { ts: number; data: { date: string; value: number; external_flow: number }[] }
>();
const _SERIES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * מנקה את ה-cache של גרף שווי התיק עבור portfolioId נתון.
 * קרא אחרי סגירת פוזיציה / הוספת טרנזקציה כדי שהגרף ייבנה מחדש.
 * מנקה גם entries של buildHistoricalPortfolioSeriesFromSnapshots (prefix 'snap:').
 */
export function clearHistoricalSeriesCache(portfolioId: string): void {
  for (const key of _historicalSeriesCache.keys()) {
    if (key.startsWith(`${portfolioId}:`) || key.startsWith(`snap:${portfolioId}:`)) {
      _historicalSeriesCache.delete(key);
    }
  }
}

function _downsampleSeries(
  data: { date: string; value: number; external_flow: number }[],
  maxPoints: number
): { date: string; value: number; external_flow: number }[] {
  if (data.length <= maxPoints) return data;
  const out: { date: string; value: number; external_flow: number }[] = [];
  const step = (data.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) out.push(data[Math.round(i * step)]);
  return out;
}

/**
 * Reconstructs historical portfolio total value by replaying all transactions
 * and looking up daily market prices for each held symbol.
 *
 * Returns up to 200 { date, value, external_flow } points sorted ascending.
 * external_flow = net deposits − withdrawals for that day (positive = inflow).
 * This field is used by computePortfolioAnalytics to calculate TWR.
 *
 * Results are cached in-memory for 5 minutes.
 */
export async function buildHistoricalPortfolioSeries(
  portfolioId: string,
  rangeDays: number = 365
): Promise<{ date: string; value: number; external_flow: number }[]> {
  const cacheKey = `${portfolioId}:${rangeDays}`;
  const now = Date.now();
  const cached = _historicalSeriesCache.get(cacheKey);
  if (cached && now - cached.ts < _SERIES_CACHE_TTL_MS) return cached.data;

  // Load all transactions sorted ascending
  const { data, error } = await supabase
    .from('portfolio_transactions')
    .select('date, type, symbol, quantity, price, amount, commission')
    .eq('portfolio_id', portfolioId)
    .order('date', { ascending: true });

  if (error || !data || data.length === 0) return [];

  type TxRow = {
    date: string;
    type: string;
    symbol: string | null;
    quantity: number | null;
    price: number | null;
    amount: number | null;
    commission: number | null;
  };
  const transactions = data as TxRow[];

  // Unique symbols traded
  const symbols = [
    ...new Set(
      transactions
        .filter((t) => t.type === 'buy' || t.type === 'sell')
        .map((t) => t.symbol?.toUpperCase())
        .filter((s): s is string => Boolean(s))
    ),
  ];

  // Resolve price range for the Yahoo fetch
  const priceRange: '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max' =
    rangeDays <= 30 ? '1mo'
    : rangeDays <= 90 ? '3mo'
    : rangeDays <= 180 ? '6mo'
    : rangeDays <= 365 ? '1y'
    : '5y';

  // Fetch all price histories in parallel
  const priceSeriesMap = new Map<string, { date: string; close: number }[]>();
  if (symbols.length > 0) {
    const fetched = await Promise.all(
      symbols.map(async (sym) => ({
        symbol: sym,
        prices: (await getHistoricalPrices(sym, priceRange))
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date)),
      }))
    );
    for (const { symbol, prices } of fetched) priceSeriesMap.set(symbol, prices);
  }

  // Build date range: first transaction → today
  const firstTxDate = transactions[0].date.slice(0, 10);
  const today = todayLocalKey();
  const allDates: string[] = [];
  const cursor = new Date(firstTxDate + 'T00:00:00');
  const endDate = new Date(today + 'T00:00:00');
  while (cursor <= endDate) {
    allDates.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  // Simulation state
  let cashBalance = 0;
  const holdingsQty: Record<string, number> = {};
  const lastKnownPrice: Record<string, number> = {};
  // Per-symbol pointer into sorted price series (avoids re-scanning from 0)
  const pricePointers: Record<string, number> = {};
  for (const sym of symbols) pricePointers[sym] = 0;

  let txIdx = 0;
  const result: { date: string; value: number; external_flow: number }[] = [];
  let hasAnyTx = false;

  for (const dateStr of allDates) {
    // external_flow for this date: deposits − withdrawals (הון חיצוני נטו, לחישוב TWR)
    // dividends + fees are NOT external capital flows — they're portfolio income/expense
    let externalFlowToday = 0;

    // Apply all transactions with date ≤ dateStr
    while (txIdx < transactions.length && transactions[txIdx].date.slice(0, 10) <= dateStr) {
      const tx = transactions[txIdx];
      hasAnyTx = true;
      switch (tx.type) {
        case 'buy': {
          cashBalance -= (tx.quantity ?? 0) * (tx.price ?? 0) + (tx.commission ?? 0);
          const sym = tx.symbol?.toUpperCase();
          if (sym) holdingsQty[sym] = (holdingsQty[sym] ?? 0) + (tx.quantity ?? 0);
          break;
        }
        case 'sell': {
          cashBalance += (tx.quantity ?? 0) * (tx.price ?? 0) - (tx.commission ?? 0);
          const sym = tx.symbol?.toUpperCase();
          if (sym) holdingsQty[sym] = Math.max(0, (holdingsQty[sym] ?? 0) - (tx.quantity ?? 0));
          break;
        }
        case 'deposit':
          cashBalance += tx.amount ?? 0;
          // הפקדה = הון חיצוני שנכנס → TWR denominator
          if (tx.date.slice(0, 10) === dateStr) externalFlowToday += tx.amount ?? 0;
          break;
        case 'withdrawal':
          cashBalance -= tx.amount ?? 0;
          // משיכה = הון חיצוני שיצא → TWR denominator (negative)
          if (tx.date.slice(0, 10) === dateStr) externalFlowToday -= tx.amount ?? 0;
          break;
        case 'fee':
          // עמלה = הוצאה פנימית — לא הון חיצוני, לא משנה TWR denominator
          cashBalance -= tx.amount ?? 0;
          break;
        case 'dividend':
          // דיבידנד = הכנסה פנימית — לא הון חיצוני, לא משנה TWR denominator
          cashBalance += tx.amount ?? 0;
          break;
      }
      txIdx++;
    }

    if (!hasAnyTx) continue;

    // Advance price pointers for each symbol (keep last known price current)
    for (const sym of symbols) {
      const series = priceSeriesMap.get(sym);
      if (!series) continue;
      let ptr = pricePointers[sym];
      while (ptr < series.length && series[ptr].date <= dateStr) {
        lastKnownPrice[sym] = series[ptr].close;
        ptr++;
      }
      pricePointers[sym] = ptr;
    }

    // Compute holdings market value
    let holdingsValue = 0;
    for (const [sym, qty] of Object.entries(holdingsQty)) {
      if (qty <= 1e-9) continue;
      const price = lastKnownPrice[sym];
      if (price != null && price > 0) holdingsValue += qty * price;
    }

    result.push({
      date: dateStr,
      value: Math.max(0, holdingsValue + cashBalance),
      external_flow: externalFlowToday,
    });
  }

  // Filter to requested range, then downsample
  let finalData = result;
  if (rangeDays > 0 && result.length > 0) {
    const cutoffStr = daysAgoLocalKey(rangeDays);
    const filtered = result.filter((p) => p.date >= cutoffStr);
    finalData = filtered.length >= 2 ? filtered : result;
  }
  finalData = _downsampleSeries(finalData, 200);

  _historicalSeriesCache.set(cacheKey, { ts: now, data: finalData });
  return finalData;
}

/**
 * גרף שווי מבוסס טרנזקציות — delegating to buildHistoricalPortfolioSeries.
 * שומר על ממשק ישן לתאימות לאחור.
 */
export async function getTransactionChartSeries(
  portfolioId: string
): Promise<{ date: string; value: number; external_flow: number }[]> {
  return buildHistoricalPortfolioSeries(portfolioId);
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

// ---------------------------------------------------------------------------
// Historical series from daily_portfolio_snapshots (מודל trades)
// ---------------------------------------------------------------------------

type TradeRow = {
  symbol: string;
  direction: string;
  status: string;
  entry_date: string;
  exit_date: string | null;
  entry_price: number;
  quantity: number;
  leverage: number | null;
};

/**
 * מחפש מחיר היסטורי ≤ date בתוך סדרה ממוינת.
 * מחזיר null אם אין נתון.
 */
function _findPriceAtOrBefore(
  prices: { date: string; close: number }[],
  date: string
): number | null {
  let result: number | null = null;
  for (const p of prices) {
    if (p.date <= date) result = p.close;
    else break;
  }
  return result;
}

/**
 * בונה סדרת שווי היסטורי מ-daily_portfolio_snapshots (מודל trades).
 *
 * portfolio_value בכל snapshot = net_deposits_up_to_date + realized_pnl_cumulative.
 * מוסיף unrealized P&L היסטורי לפוזיציות שהיו פתוחות בכל יום —
 * כך הגרף מציג גם את שווי הפוזיציות הפתוחות בין תאריכי הסגירה (פתרון בעיה 2).
 *
 * external_flow = deposits_today - withdrawals_today לחישוב TWR.
 *
 * Cache: 5 דקות, מפתח 'snap:{portfolioId}:{rangeDays}'.
 */
export async function buildHistoricalPortfolioSeriesFromSnapshots(
  portfolioId: string,
  rangeDays: number = 365
): Promise<{ date: string; value: number; external_flow: number }[]> {
  const cacheKey = `snap:${portfolioId}:${rangeDays}`;
  const now = Date.now();
  const cached = _historicalSeriesCache.get(cacheKey);
  if (cached && now - cached.ts < _SERIES_CACHE_TTL_MS) return cached.data;

  const sinceDate = daysAgoLocalKey(rangeDays);

  // 1. שלוף snapshots מה-DB
  const { data: snapData, error: snapErr } = await supabase
    .from('daily_portfolio_snapshots')
    .select('snapshot_date, portfolio_value, deposits_today, withdrawals_today')
    .eq('portfolio_id', portfolioId)
    .gte('snapshot_date', sinceDate)
    .order('snapshot_date', { ascending: true });

  if (snapErr) throw snapErr;

  const rows = (snapData ?? []) as Array<{
    snapshot_date: string;
    portfolio_value: number | string;
    deposits_today: number | string | null;
    withdrawals_today: number | string | null;
  }>;

  if (rows.length === 0) {
    _historicalSeriesCache.set(cacheKey, { ts: now, data: [] });
    return [];
  }

  // 2. שלוף trades לחישוב unrealized P&L היסטורי
  const { data: tradeData, error: tradeErr } = await supabase
    .from('trades')
    .select('symbol, direction, status, entry_date, exit_date, entry_price, quantity, leverage')
    .eq('portfolio_id', portfolioId)
    .order('entry_date', { ascending: true });

  const trades = (tradeData ?? []) as TradeRow[];

  // 3. מציאת סימבולים עם תקופות פתוחות שחופפות לטווח ה-snapshots
  const firstSnapDate = rows[0].snapshot_date;
  const lastSnapDate = rows[rows.length - 1].snapshot_date;

  const relevantSymbols = [...new Set(
    trades
      .filter((t) => {
        const entryDate = t.entry_date.slice(0, 10);
        const exitDate = t.exit_date ? t.exit_date.slice(0, 10) : null;
        return entryDate <= lastSnapDate && (!exitDate || exitDate >= firstSnapDate);
      })
      .map((t) => t.symbol.toUpperCase())
  )];

  // 4. שליפת מחירים היסטוריים לסימבולים הרלוונטיים
  const yahooRange: '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max' =
    rangeDays <= 30 ? '1mo'
    : rangeDays <= 90 ? '3mo'
    : rangeDays <= 180 ? '6mo'
    : rangeDays <= 365 ? '1y'
    : '5y';

  const priceHistory = new Map<string, { date: string; close: number }[]>();
  if (relevantSymbols.length > 0) {
    await Promise.all(
      relevantSymbols.map(async (sym) => {
        try {
          const prices = await getHistoricalPrices(sym, yahooRange);
          priceHistory.set(sym, prices.slice().sort((a, b) => a.date.localeCompare(b.date)));
        } catch {
          // אם שליפת מחירים נכשלת — ממשיכים ללא unrealized עבור סימבול זה
        }
      })
    );
  }

  // 5. עוגן סקאלה לכל טרייד: Yahoo@entry מול entry_price הברוקר (UVIX reverse-split וכו')
  const tradeMeta = trades.map((t) => {
    const entryDate = t.entry_date.slice(0, 10);
    const exitDate = t.exit_date ? t.exit_date.slice(0, 10) : null;
    const sym = t.symbol.toUpperCase();
    const prices = priceHistory.get(sym);
    const yahooAtEntry = prices ? _findPriceAtOrBefore(prices, entryDate) : null;
    return {
      ...t,
      entryDate,
      exitDate,
      sym,
      entryPrice: Number(t.entry_price),
      qty: Number(t.quantity),
      lev: t.leverage ?? 1,
      yahooAtEntry,
    };
  });

  // 6. חישוב unrealized P&L והוספה לכל snapshot (מחיר שוק מיושר לסקאלת הברוקר)
  const enhanced = rows.map((r) => {
    const date = r.snapshot_date;
    let unrealizedPnl = 0;

    for (const t of tradeMeta) {
      // הפוזיציה הייתה פתוחה בתאריך זה (נפתחה לפניו/עליו, נסגרה אחריו או עדיין פתוחה)
      if (t.entryDate > date) continue;
      if (t.exitDate && t.exitDate <= date) continue;

      const prices = priceHistory.get(t.sym);
      if (!prices) continue;

      const rawMarket = _findPriceAtOrBefore(prices, date);
      if (rawMarket == null) continue;

      const marketPrice = brokerAlignedMarketPrice(
        rawMarket,
        t.entryPrice,
        t.yahooAtEntry
      );
      if (marketPrice == null) continue;

      const pnl =
        t.direction === 'long'
          ? (marketPrice - t.entryPrice) * t.qty * t.lev
          : (t.entryPrice - marketPrice) * t.qty * t.lev;

      unrealizedPnl += pnl;
    }

    return {
      date,
      value: Math.max(0, Number(r.portfolio_value) + unrealizedPnl),
      external_flow:
        Number(r.deposits_today ?? 0) - Number(r.withdrawals_today ?? 0),
    };
  });

  // 7. גזור רצף אפסים מתחילת הסדרה (תקופה לפני כל פעילות)
  const firstNonZeroIdx = enhanced.findIndex((p) => p.value > 0);
  const result = firstNonZeroIdx === -1 ? [] : enhanced.slice(firstNonZeroIdx);

  _historicalSeriesCache.set(cacheKey, { ts: now, data: result });
  return result;
}
