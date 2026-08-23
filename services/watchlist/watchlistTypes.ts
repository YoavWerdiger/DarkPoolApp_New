/** טיפוסי רשימת מעקב מניות */

export interface StockWatchlist {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StockWatchlistItem {
  id: string;
  watchlist_id: string;
  user_id: string;
  symbol: string;
  company_name: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  /** מחיר ייחוס אישי */
  entry_price: number | null;
  /** יעד מחיר */
  target_price: number | null;
  /** @deprecated השתמש ב-alert_above_prices */
  alert_above: number | null;
  /** @deprecated השתמש ב-alert_below_prices */
  alert_below: number | null;
  /** @deprecated השתמש ב-alert_change_pcts */
  alert_change_pct: number | null;
  /** ספי מחיר עליון (אפשר כמה) */
  alert_above_prices: number[];
  /** ספי מחיר תחתון (אפשר כמה) */
  alert_below_prices: number[];
  /** ספי |שינוי יומי %| (אפשר כמה) */
  alert_change_pcts: number[];
  alerts_enabled: boolean;
  alert_day_high: boolean;
  alert_week_high: boolean;
  alert_week_low: boolean;
  alert_52w_high: boolean;
  alert_52w_low: boolean;
  /** @deprecated השתמש ב-alert_entry_gain_pcts */
  alert_entry_gain_pct: number | null;
  /** @deprecated השתמש ב-alert_entry_loss_pcts */
  alert_entry_loss_pct: number | null;
  /** ספי % רווח מול כניסה (אפשר כמה) */
  alert_entry_gain_pcts: number[];
  /** ספי % הפסד מול כניסה — ערך חיובי (אפשר כמה) */
  alert_entry_loss_pcts: number[];
  alert_target_hit: boolean;
  alert_earnings: boolean;
}

export type WatchlistSortMode =
  | 'custom'
  | 'change_desc'
  | 'change_asc'
  | 'change_abs_desc'
  | 'change_abs_asc'
  | 'volume_desc'
  | 'volume_asc'
  | 'name'
  | 'price_desc';

export type WatchlistFilterMode = 'all' | 'up' | 'down' | 'volume' | 'events' | 'alerts';

export type WatchlistAlertKind =
  | 'above'
  | 'below'
  | 'change_pct'
  | 'day_high'
  | 'week_high'
  | 'week_low'
  | 'y52_high'
  | 'y52_low'
  | 'entry_gain'
  | 'entry_loss'
  | 'target_hit'
  | 'earnings';

export interface WatchlistItemPatch {
  notes?: string | null;
  entry_price?: number | null;
  target_price?: number | null;
  alert_above?: number | null;
  alert_below?: number | null;
  alert_change_pct?: number | null;
  alert_above_prices?: number[];
  alert_below_prices?: number[];
  alert_change_pcts?: number[];
  alerts_enabled?: boolean;
  alert_day_high?: boolean;
  alert_week_high?: boolean;
  alert_week_low?: boolean;
  alert_52w_high?: boolean;
  alert_52w_low?: boolean;
  alert_entry_gain_pct?: number | null;
  alert_entry_loss_pct?: number | null;
  alert_entry_gain_pcts?: number[];
  alert_entry_loss_pcts?: number[];
  alert_target_hit?: boolean;
  alert_earnings?: boolean;
}

/** שורת UI — פריט + quote + תובנות */
export interface WatchlistRowData {
  item: StockWatchlistItem;
  price: number | null;
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  change: number | null;
  changePct: number | null;
  currency: string;
  asOf: string | null;
  isLive: boolean;
  /** % מול מחיר ייחוס */
  vsEntryPct: number | null;
  /** % עד יעד */
  vsTargetPct: number | null;
  earningsDate: string | null;
  earningsSession: string | null;
  weekHigh: number | null;
  weekLow: number | null;
  high52: number | null;
  low52: number | null;
}

export interface WatchlistDaySummary {
  total: number;
  up: number;
  down: number;
  flat: number;
  avgChangePct: number | null;
}

export const SUGGESTED_WATCHLIST_SYMBOLS: Array<{ symbol: string; name: string }> = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
  { symbol: 'IWM', name: 'Russell 2000 ETF' },
];
