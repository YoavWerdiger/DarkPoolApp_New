/**
 * מיפוי שדות UI ↔ מקורות Quiver/DB — קונגרס בלבד.
 * אין חישוב shares/שווי מטווח STOCK Act.
 */

export type CongressUiField =
  | 'trade_amount_range'
  | 'trade_filed_at'
  | 'trade_transaction_date'
  | 'trade_side'
  | 'ticker_return_since_trade'
  | 'vendor_price_change'
  | 'vendor_excess_return'
  | 'vendor_spy_change'
  | 'holding_current_usd'
  | 'holding_allocation'
  | 'holding_ticker';

export type CongressDataSourceId =
  | 'dark_pool_congress_trades'
  | 'yahoo_daily_open'
  | 'live_quote'
  | 'quiver_congress_holdings'
  | 'dark_pool_uw_snapshots';

export interface CongressFieldSource {
  field: CongressUiField;
  primary: CongressDataSourceId;
  /** fallback כש-primary חסר */
  fallback?: CongressDataSourceId;
  endpoint?: string;
  notes: string;
}

/** מקור אמת לכל שדה שמוצג בפיד / פרופיל / פרטי עסקה. */
export const CONGRESS_FIELD_SOURCES: readonly CongressFieldSource[] = [
  {
    field: 'trade_amount_range',
    primary: 'dark_pool_congress_trades',
    endpoint: 'Quiver bulk/congresstrading · UW get_recent_congress_trades',
    notes: 'amount_label כפי שדווח — טווח, לא midpoint',
  },
  {
    field: 'trade_filed_at',
    primary: 'dark_pool_congress_trades',
    notes: 'filed_at',
  },
  {
    field: 'trade_transaction_date',
    primary: 'dark_pool_congress_trades',
    notes: 'transaction_date — בסיס לפתיחה יומית',
  },
  {
    field: 'trade_side',
    primary: 'dark_pool_congress_trades',
    notes: 'transaction_type buy/sell',
  },
  {
    field: 'ticker_return_since_trade',
    primary: 'yahoo_daily_open',
    fallback: 'dark_pool_congress_trades',
    endpoint: 'Yahoo chart 1d open · pickDailyOpenOnDate',
    notes: '(live − open[tx_day]) / open; PriceChange רק אם אין open/quote',
  },
  {
    field: 'vendor_price_change',
    primary: 'dark_pool_congress_trades',
    endpoint: 'Quiver PriceChange → price_change_pct',
    notes: 'fallback ל«מאז העסקה» — לא מחליף open כשיש נתון',
  },
  {
    field: 'vendor_excess_return',
    primary: 'dark_pool_congress_trades',
    notes: 'excess_return_pct מ-Quiver',
  },
  {
    field: 'vendor_spy_change',
    primary: 'dark_pool_congress_trades',
    notes: 'spy_change_pct מ-Quiver',
  },
  {
    field: 'holding_current_usd',
    primary: 'quiver_congress_holdings',
    fallback: 'dark_pool_uw_snapshots',
    endpoint: 'GET /beta/live/congress_stock_holdings?bioguide_id=',
    notes: 'CurrentHolding USD — לא מסכום טווחי עסקאות',
  },
  {
    field: 'holding_allocation',
    primary: 'quiver_congress_holdings',
    notes: 'Allocation שבר 0–1 מ-Quiver',
  },
  {
    field: 'holding_ticker',
    primary: 'quiver_congress_holdings',
    notes: 'Ticker בשורת אחזקה',
  },
] as const;

/** BioGuide בלי snapshot אחזקות ב-Quiver — פיד+עסקאות בלבד בפרופיל. */
export const CONGRESS_TRADES_ONLY_BIOGUIDES = new Set<string>([
  'K000389', // Ro Khanna
  'M001157', // Michael McCaul
]);

export function congressProfileHasHoldingsSource(bioguideId: string | null | undefined): boolean {
  const id = bioguideId?.trim() ?? '';
  if (!/^[A-Z]\d{6}$/.test(id)) return false;
  return !CONGRESS_TRADES_ONLY_BIOGUIDES.has(id);
}

export function getCongressFieldSource(field: CongressUiField): CongressFieldSource | undefined {
  return CONGRESS_FIELD_SOURCES.find((row) => row.field === field);
}
