/**
 * watchlistService — CRUD לרשימות מעקב מניות (Supabase + RLS owner-only).
 */

import { supabase } from '../../lib/supabase';
import type {
  StockWatchlist,
  StockWatchlistItem,
  WatchlistItemPatch,
} from './watchlistTypes';
import { normalizeItem } from './watchlistInsights';
import { getQuote } from '../portfolios/portfolioPriceFeed';

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw new Error('not_authenticated');
  return data.user.id;
}

/** מחזיר את כל רשימות המשתמש; יוצר ברירת מחדל אם אין אף אחת. */
export async function listWatchlists(): Promise<StockWatchlist[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('stock_watchlists')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  if (data && data.length > 0) {
    return data as StockWatchlist[];
  }

  const { data: created, error: insertError } = await supabase
    .from('stock_watchlists')
    .insert({
      user_id: userId,
      name: 'הרשימה שלי',
      is_default: true,
      sort_order: 0,
    })
    .select('*')
    .single();
  if (insertError) throw insertError;
  return [created as StockWatchlist];
}

export async function createWatchlist(name: string): Promise<StockWatchlist> {
  const userId = await requireUserId();
  const trimmed = name.trim() || 'רשימה חדשה';
  const { data: existing } = await supabase
    .from('stock_watchlists')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('stock_watchlists')
    .insert({
      user_id: userId,
      name: trimmed,
      is_default: false,
      sort_order: nextOrder,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as StockWatchlist;
}

export async function renameWatchlist(id: string, name: string): Promise<void> {
  const userId = await requireUserId();
  const trimmed = name.trim();
  if (!trimmed) return;
  const { error } = await supabase
    .from('stock_watchlists')
    .update({ name: trimmed })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteWatchlist(id: string): Promise<void> {
  const userId = await requireUserId();
  const { data: row } = await supabase
    .from('stock_watchlists')
    .select('is_default')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (row?.is_default) {
    throw new Error('cannot_delete_default_watchlist');
  }
  const { error } = await supabase
    .from('stock_watchlists')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function listWatchlistItems(
  watchlistId: string
): Promise<StockWatchlistItem[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('stock_watchlist_items')
    .select('*')
    .eq('watchlist_id', watchlistId)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => normalizeItem(row as Record<string, unknown>));
}

export async function addWatchlistItem(params: {
  watchlistId: string;
  symbol: string;
  companyName?: string | null;
}): Promise<StockWatchlistItem> {
  const userId = await requireUserId();
  const symbol = params.symbol.trim().toUpperCase();
  if (!symbol) throw new Error('invalid_symbol');

  const { data: already } = await supabase
    .from('stock_watchlist_items')
    .select('*')
    .eq('watchlist_id', params.watchlistId)
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .maybeSingle();
  if (already) return normalizeItem(already as Record<string, unknown>);

  const { data: existing } = await supabase
    .from('stock_watchlist_items')
    .select('sort_order')
    .eq('watchlist_id', params.watchlistId)
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  let entryPrice: number | null = null;
  try {
    const q = await getQuote(symbol);
    if (q?.price) entryPrice = q.price;
  } catch {
    /* optional */
  }

  const { data, error } = await supabase
    .from('stock_watchlist_items')
    .insert({
      watchlist_id: params.watchlistId,
      user_id: userId,
      symbol,
      company_name: params.companyName?.trim() || null,
      sort_order: nextOrder,
      entry_price: entryPrice,
    })
    .select('*')
    .single();
  if (error) throw error;
  return normalizeItem(data as Record<string, unknown>);
}

export async function removeWatchlistItem(
  watchlistId: string,
  symbol: string
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('stock_watchlist_items')
    .delete()
    .eq('watchlist_id', watchlistId)
    .eq('user_id', userId)
    .eq('symbol', symbol.trim().toUpperCase());
  if (error) throw error;
}

export async function updateWatchlistItemNotes(
  itemId: string,
  notes: string | null
): Promise<void> {
  await updateWatchlistItem(itemId, { notes });
}

export async function updateWatchlistItem(
  itemId: string,
  patch: WatchlistItemPatch
): Promise<void> {
  const userId = await requireUserId();
  const payload: Record<string, unknown> = {};
  if ('notes' in patch) payload.notes = patch.notes?.trim() || null;
  if ('entry_price' in patch) payload.entry_price = patch.entry_price;
  if ('target_price' in patch) payload.target_price = patch.target_price;
  if ('alert_above_prices' in patch) {
    const list = Array.isArray(patch.alert_above_prices)
      ? patch.alert_above_prices
      : [];
    payload.alert_above_prices = list;
    payload.alert_above = list[0] ?? null;
  } else if ('alert_above' in patch) {
    payload.alert_above = patch.alert_above;
    payload.alert_above_prices =
      patch.alert_above != null ? [patch.alert_above] : [];
  }
  if ('alert_below_prices' in patch) {
    const list = Array.isArray(patch.alert_below_prices)
      ? patch.alert_below_prices
      : [];
    payload.alert_below_prices = list;
    payload.alert_below = list[0] ?? null;
  } else if ('alert_below' in patch) {
    payload.alert_below = patch.alert_below;
    payload.alert_below_prices =
      patch.alert_below != null ? [patch.alert_below] : [];
  }
  if ('alert_change_pcts' in patch) {
    const list = Array.isArray(patch.alert_change_pcts)
      ? patch.alert_change_pcts
      : [];
    payload.alert_change_pcts = list;
    payload.alert_change_pct = list[0] ?? null;
  } else if ('alert_change_pct' in patch) {
    payload.alert_change_pct = patch.alert_change_pct;
    payload.alert_change_pcts =
      patch.alert_change_pct != null ? [patch.alert_change_pct] : [];
  }
  if ('alerts_enabled' in patch) payload.alerts_enabled = !!patch.alerts_enabled;
  if ('alert_day_high' in patch) payload.alert_day_high = !!patch.alert_day_high;
  if ('alert_week_high' in patch) payload.alert_week_high = !!patch.alert_week_high;
  if ('alert_week_low' in patch) payload.alert_week_low = !!patch.alert_week_low;
  if ('alert_52w_high' in patch) payload.alert_52w_high = !!patch.alert_52w_high;
  if ('alert_52w_low' in patch) payload.alert_52w_low = !!patch.alert_52w_low;
  if ('alert_entry_gain_pcts' in patch) {
    const list = Array.isArray(patch.alert_entry_gain_pcts)
      ? patch.alert_entry_gain_pcts
      : [];
    payload.alert_entry_gain_pcts = list;
    payload.alert_entry_gain_pct = list[0] ?? null;
  } else if ('alert_entry_gain_pct' in patch) {
    payload.alert_entry_gain_pct = patch.alert_entry_gain_pct;
    payload.alert_entry_gain_pcts =
      patch.alert_entry_gain_pct != null ? [patch.alert_entry_gain_pct] : [];
  }
  if ('alert_entry_loss_pcts' in patch) {
    const list = Array.isArray(patch.alert_entry_loss_pcts)
      ? patch.alert_entry_loss_pcts
      : [];
    payload.alert_entry_loss_pcts = list;
    payload.alert_entry_loss_pct = list[0] ?? null;
  } else if ('alert_entry_loss_pct' in patch) {
    payload.alert_entry_loss_pct = patch.alert_entry_loss_pct;
    payload.alert_entry_loss_pcts =
      patch.alert_entry_loss_pct != null ? [patch.alert_entry_loss_pct] : [];
  }
  if ('alert_target_hit' in patch) payload.alert_target_hit = !!patch.alert_target_hit;
  if ('alert_earnings' in patch) payload.alert_earnings = !!patch.alert_earnings;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase
    .from('stock_watchlist_items')
    .update(payload)
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function reorderWatchlistItems(
  watchlistId: string,
  orderedSymbols: string[]
): Promise<void> {
  const userId = await requireUserId();
  await Promise.all(
    orderedSymbols.map((symbol, index) =>
      supabase
        .from('stock_watchlist_items')
        .update({ sort_order: index })
        .eq('watchlist_id', watchlistId)
        .eq('user_id', userId)
        .eq('symbol', symbol.toUpperCase())
    )
  );
}
