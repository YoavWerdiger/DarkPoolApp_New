/**
 * portfolioTradeDerive.ts
 *
 * חישוב טריידים לוגיים (open/closed) מתוך portfolio_transactions ב-FIFO.
 *
 * מודל:
 *  - "טרייד" = מנה (lot) שנפתחה ע"י buy ראשון (לונג) או sell ראשון (שורט),
 *    ועשויה להיסגר חלקית/מלא ע"י טרנזקציות נגדיות באותו symbol+direction.
 *  - לונג: open=buy, close=sell.
 *  - שורט: open=sell, close=buy.
 *  - FIFO: כל close נופל קודם על ה-lot הפתוח הוותיק ביותר.
 *
 * שדות נגזרים: entry_avg_price, exit_avg_price, realized_pnl, unrealized_pnl.
 */

import { supabase } from '../../lib/supabase';
import type {
  PortfolioTransaction,
  PortfolioTradeMeta,
  PortfolioTradeMetaInsert,
  DerivedTrade,
  TradeDirection,
  AssetType,
  Trade,
  TradeInsert,
  TradeStatus,
} from '../../screens/Portfolios/portfolioTypes';
import { clearHistoricalSeriesCache } from './portfolioService';
import { toLocalDateKey, todayLocalKey } from '../../utils/dateKeys';

interface OpenLot {
  symbol: string;
  asset_type: AssetType | null;
  direction: TradeDirection;
  opened_at: string;
  /** מזהה ייחודי של ה-lot: ה-id של ה-tx הפותח */
  open_tx_id: string;
  open_qty: number;
  entry_qty: number;
  entry_avg_price: number;
  fees: number;
  currency: string;
  realized_pnl: number;
  closes: Array<{ qty: number; price: number; date: string }>;
}

interface PriceLookup {
  [symbol: string]: number;
}

/**
 * מקבל רשימת טרנזקציות ומחזיר טריידים נגזרים (פתוחים+סגורים).
 * lastPriceBySymbol = מחיר נוכחי לחישוב unrealized.
 */
export function deriveTradesFromTransactions(
  txs: PortfolioTransaction[],
  lastPriceBySymbol: PriceLookup = {},
  metaList: PortfolioTradeMeta[] = []
): DerivedTrade[] {
  if (!txs.length) return [];

  const assetTxs = txs
    .filter((t) => t.type === 'buy' || t.type === 'sell')
    .filter((t) => t.symbol && t.quantity != null && t.price != null)
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  /** מקובץ לפי symbol+direction — שורט ולונג של אותו סימבול הם תורים נפרדים */
  type Key = string;
  const groups = new Map<Key, PortfolioTransaction[]>();
  for (const t of assetTxs) {
    const k = `${t.symbol}::${t.direction ?? 'long'}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }

  const portfolioId = txs[0].portfolio_id;
  const trades: DerivedTrade[] = [];

  for (const [, list] of groups) {
    const fifo: OpenLot[] = [];

    for (const tx of list) {
      const qty = Number(tx.quantity ?? 0);
      const price = Number(tx.price ?? 0);
      const fee = Number(tx.commission ?? 0);
      const dir: TradeDirection = (tx.direction as TradeDirection) ?? 'long';
      const isOpening =
        (dir === 'long' && tx.type === 'buy') ||
        (dir === 'short' && tx.type === 'sell');

      if (qty <= 0 || price < 0) continue;

      if (isOpening) {
        fifo.push({
          symbol: tx.symbol!,
          asset_type: tx.asset_type,
          direction: dir,
          opened_at: tx.date,
          open_tx_id: tx.id,
          open_qty: qty,
          entry_qty: qty,
          entry_avg_price: price,
          fees: fee,
          currency: tx.currency,
          realized_pnl: 0,
          closes: [],
        });
      } else {
        let remaining = qty;
        let remainingFee = fee;
        while (remaining > 0 && fifo.length > 0) {
          const lot = fifo[0];
          const matched = Math.min(remaining, lot.open_qty);
          const pnlPerUnit =
            dir === 'long'
              ? price - lot.entry_avg_price
              : lot.entry_avg_price - price;
          const slice = pnlPerUnit * matched;
          lot.realized_pnl += slice;
          lot.open_qty -= matched;
          remaining -= matched;
          const feeSlice =
            qty > 0 ? (remainingFee * matched) / qty : 0;
          lot.fees += feeSlice;
          lot.closes.push({ qty: matched, price, date: tx.date });
          if (lot.open_qty <= 1e-9) {
            trades.push(buildTradeRecord(lot, portfolioId, true, lastPriceBySymbol, metaList));
            fifo.shift();
          }
        }
      }
    }
    for (const lot of fifo) {
      trades.push(buildTradeRecord(lot, portfolioId, false, lastPriceBySymbol, metaList));
    }
  }

  trades.sort((a, b) => {
    if (a.is_open !== b.is_open) return a.is_open ? -1 : 1;
    const aDate = a.closed_at ?? a.opened_at;
    const bDate = b.closed_at ?? b.opened_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return trades;
}

function buildTradeRecord(
  lot: OpenLot,
  portfolioId: string,
  isFullyClosed: boolean,
  lastPriceBySymbol: PriceLookup,
  metaList: PortfolioTradeMeta[]
): DerivedTrade {
  const closedQty = lot.entry_qty - lot.open_qty;
  const exit_avg_price =
    lot.closes.length && closedQty > 0
      ? lot.closes.reduce((s, c) => s + c.price * c.qty, 0) / closedQty
      : null;
  const closed_at = isFullyClosed
    ? lot.closes[lot.closes.length - 1]?.date ?? null
    : null;
  const last = lastPriceBySymbol[lot.symbol];
  const unrealized =
    !isFullyClosed && lot.open_qty > 0 && Number.isFinite(last)
      ? lot.direction === 'long'
        ? (last - lot.entry_avg_price) * lot.open_qty
        : (lot.entry_avg_price - last) * lot.open_qty
      : null;
  const realized_pnl_pct =
    exit_avg_price != null && lot.entry_avg_price > 0 && closedQty > 0
      ? lot.direction === 'long'
        ? ((exit_avg_price - lot.entry_avg_price) / lot.entry_avg_price) * 100
        : ((lot.entry_avg_price - exit_avg_price) / lot.entry_avg_price) * 100
      : null;

  const meta =
    metaList.find(
      (m) =>
        m.symbol === lot.symbol &&
        m.direction === lot.direction &&
        new Date(m.opened_at).getTime() === new Date(lot.opened_at).getTime()
    ) ?? null;

  return {
    key: `${portfolioId}:${lot.symbol}:${lot.direction}:${lot.opened_at}:${lot.open_tx_id}`,
    portfolio_id: portfolioId,
    symbol: lot.symbol,
    asset_type: lot.asset_type,
    direction: lot.direction,
    opened_at: lot.opened_at,
    closed_at,
    is_open: !isFullyClosed,
    quantity: lot.entry_qty,
    open_quantity: lot.open_qty,
    entry_avg_price: lot.entry_avg_price,
    exit_avg_price,
    fees: lot.fees,
    realized_pnl: lot.realized_pnl,
    unrealized_pnl: unrealized,
    realized_pnl_pct,
    currency: lot.currency,
    meta,
  };
}

/* ============================================================================
 * High-level loaders — שולף טרנזקציות + meta + מחירים, מחזיר DerivedTrade[].
 * ========================================================================= */

export async function loadDerivedTrades(
  portfolioId: string,
  lastPriceBySymbol: PriceLookup = {}
): Promise<DerivedTrade[]> {
  const [{ data: txs, error: txErr }, { data: metas, error: metaErr }] =
    await Promise.all([
      supabase
        .from('portfolio_transactions')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .in('type', ['buy', 'sell'])
        .order('date', { ascending: true }),
      supabase
        .from('portfolio_trade_meta')
        .select('*')
        .eq('portfolio_id', portfolioId),
    ]);
  if (txErr) throw txErr;
  if (metaErr) throw metaErr;
  return deriveTradesFromTransactions(
    (txs ?? []) as PortfolioTransaction[],
    lastPriceBySymbol,
    (metas ?? []) as PortfolioTradeMeta[]
  );
}

/* ============================================================================
 * Trade meta CRUD
 * ========================================================================= */

export async function upsertTradeMeta(
  input: PortfolioTradeMetaInsert
): Promise<PortfolioTradeMeta> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error('not_authenticated');
  const payload = {
    portfolio_id: input.portfolio_id,
    user_id: auth.user.id,
    symbol: input.symbol,
    direction: input.direction,
    opened_at: input.opened_at,
    stop_loss: input.stop_loss ?? null,
    target_price: input.target_price ?? null,
    strategy_name: input.strategy_name ?? null,
    journal_details: input.journal_details ?? null,
  };
  const { data, error } = await supabase
    .from('portfolio_trade_meta')
    .upsert(payload, {
      onConflict: 'portfolio_id,symbol,direction,opened_at',
    })
    .select()
    .single();
  if (error) throw error;
  return data as PortfolioTradeMeta;
}

export async function deleteTradeMeta(id: string): Promise<void> {
  const { error } = await supabase
    .from('portfolio_trade_meta')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/* ============================================================================
 * New Trade model — CRUD ל-trades table (migration 20260723)
 * ========================================================================= */

/**
 * טוען פוזיציות מטבלת trades.
 * @param portfolioId מזהה התיק
 * @param status 'OPEN' | 'CLOSED' | undefined (כל הסטטוסים)
 */
export async function loadTrades(
  portfolioId: string,
  status?: TradeStatus
): Promise<Trade[]> {
  let query = supabase
    .from('trades')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('entry_date', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Trade[];
}

/**
 * פותח פוזיציה חדשה (INSERT ל-trades עם status='OPEN').
 * הטריגר ב-PG מנכה את available_cash אוטומטית.
 */
export async function insertOpenTrade(input: TradeInsert): Promise<Trade> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error('not_authenticated');

  const payload: Record<string, unknown> = {
    portfolio_id: input.portfolio_id,
    user_id: auth.user.id,
    symbol: input.symbol.toUpperCase(),
    asset_type: input.asset_type,
    exchange: input.exchange ?? null,
    currency: input.currency ?? 'USD',
    direction: input.direction ?? 'long',
    status: 'OPEN' as TradeStatus,
    entry_date: input.entry_date,
    entry_price: input.entry_price,
    quantity: input.quantity,
    leverage: input.leverage ?? 1.0,
    point_value: input.point_value ?? null,
    commission: input.commission ?? 0,
    notes: input.notes ?? null,
    stop_loss: input.stop_loss ?? null,
    target_price: input.target_price ?? null,
    strategy_name: input.strategy_name ?? null,
  };
  // שלח journal_details רק אם סופק ערך — מניח את ברירת המחדל '{}'::jsonb של ה-DB
  if (input.journal_details != null) {
    payload.journal_details = input.journal_details;
  }

  const { data, error } = await supabase
    .from('trades')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Trade;
}

/**
 * מחזיר trade בודד לפי id.
 */
export async function getTrade(id: string): Promise<Trade | null> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Trade) ?? null;
}

/**
 * עדכון trade קיים (עריכת פרטי הכניסה בלבד — status/exit_price/profit_loss לא משתנים כאן).
 */
export async function updateTrade(
  id: string,
  patch: Partial<TradeInsert>
): Promise<Trade> {
  const { data, error } = await supabase
    .from('trades')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Trade;
}

/**
 * מוחק trade פתוח. הטריגר ב-PG מחזיר את available_cash אוטומטית.
 */
export async function deleteTrade(id: string): Promise<void> {
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * סוגר פוזיציה פתוחה — UPDATE ל-status='CLOSED' + exit_price + exit_date.
 * הטריגר ב-PG מחשב profit_loss, מחזיר cash, ומעדכן stats+snapshots.
 */
export async function closeTrade(
  tradeId: string,
  exitPrice: number,
  exitDate?: string,
  notes?: string
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error('not_authenticated');

  const { data: existing, error: fetchErr } = await supabase
    .from('trades')
    .select('id, status, portfolio_id')
    .eq('id', tradeId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!existing) throw new Error('trade_not_found');
  if (existing.status !== 'OPEN') throw new Error('trade_not_open');

  const resolvedExitDate = exitDate ?? new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('trades')
    .update({
      status: 'CLOSED',
      exit_price: exitPrice,
      exit_date: resolvedExitDate,
      ...(notes != null ? { notes } : {}),
    })
    .eq('id', tradeId)
    .select('id')
    .single();
  if (error) throw error;
  if (!updated) throw new Error('trade_update_failed');

  // Fallback: range_recalc מהלקוח להבטיח snapshots מעודכנים
  // (הטריגר עושה את זה ב-DB, אבל קריאה מהקוד מבטיחה שהגרף יתרענן מיד)
  try {
    const exitDateKey = toLocalDateKey(new Date(resolvedExitDate));
    const todayKey = todayLocalKey();
    await supabase.rpc('range_recalc_snapshots', {
      p_portfolio_id: existing.portfolio_id,
      p_from: exitDateKey,
      p_to: todayKey,
    });
  } catch {
    // שגיאה ב-range_recalc אינה קריטית — הטריגר כבר ביצע את החישוב
  }

  // נקה cache כדי שהגרף ייבנה מחדש
  clearHistoricalSeriesCache(existing.portfolio_id);
}

/* ============================================================================
 * איפוס תיק — RPC אטומי (trades / snapshots / transactions / history /
 * broker_positions ל-Colmex) + available_cash=0 + recalc stats.
 * ========================================================================= */

/**
 * מוחק את כל הנתונים ההיסטוריים של התיק ומאפס אותו למצב ראשוני.
 * משתמש ב-RPC `reset_portfolio` (SECURITY DEFINER) כי ל-snapshots /
 * broker_positions אין/לא היו מדיניות DELETE ב-RLS — מחיקה ישירה
 * החזירה הצלחה שקטה עם 0 שורות.
 */
export async function resetPortfolio(portfolioId: string): Promise<void> {
  const { error } = await supabase.rpc('reset_portfolio', {
    p_portfolio_id: portfolioId,
  });
  if (error) throw error;
  clearHistoricalSeriesCache(portfolioId);
}

/* ============================================================================
 * סגירת פוזיציה מהירה — יוצרת טרנזקציה נגדית בגודל open_quantity של הטרייד.
 * ========================================================================= */

export async function quickCloseTrade(
  trade: DerivedTrade,
  exitPrice: number,
  date?: string,
  notes?: string
): Promise<void> {
  if (!trade.is_open || trade.open_quantity <= 0) {
    throw new Error('trade_not_open');
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error('not_authenticated');

  // וידוא בעלות לפני שמגישים INSERT שייכשל ב-RLS עם שגיאה לא ידידותית.
  const { data: owned, error: ownErr } = await supabase
    .from('portfolios')
    .select('id, user_id')
    .eq('id', trade.portfolio_id)
    .maybeSingle();
  if (ownErr) throw ownErr;
  if (!owned || owned.user_id !== auth.user.id) {
    throw new Error('not_owner');
  }

  const closingType = trade.direction === 'long' ? 'sell' : 'buy';
  const { error } = await supabase.from('portfolio_transactions').insert({
    portfolio_id: trade.portfolio_id,
    user_id: auth.user.id,
    type: closingType,
    direction: trade.direction,
    symbol: trade.symbol,
    asset_type: trade.asset_type,
    quantity: trade.open_quantity,
    price: exitPrice,
    commission: 0,
    currency: trade.currency,
    date: date ?? new Date().toISOString(),
    notes: notes ?? null,
  });
  if (error) throw error;
}
