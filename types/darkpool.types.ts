/**
 * darkpool.types.ts
 * -----------------------------------------------------------------------------
 * טיפוסים משותפים לפיצ'ר Dark Pool Intelligence.
 *
 * הקובץ הזה משמש גם את ה-client (React Native), גם את שירותי `services/darkpool/*`,
 * וגם את ה-Edge Functions (דרך re-export ב-supabase/functions/_shared).
 *
 * אסור להוסיף כאן ייבוא של React/Supabase/Deno — טיפוסים בלבד.
 */

// ---------------------------------------------------------------------------
// Provider-level (normalized response)
// ---------------------------------------------------------------------------

export type DarkPoolSide = 'buy' | 'sell' | 'unknown';

/**
 * הפורמט הנורמלי שכל ספק (Polygon / UnusualWhales / Intrinio) חייב להחזיר אליו.
 * לא נוגע ב-DB ולא ב-RN — שכבת ביניים בלבד.
 */
export interface NormalizedDarkPoolTrade {
  /** מזהה ייחודי מהספק. אם לא קיים — ייוצר ע"י composite key (ticker+ts+size+price). */
  externalId: string | null;
  ticker: string;
  companyName: string | null;
  /** epoch millis (UTC). */
  timestamp: number;
  price: number;
  size: number;
  /** premium = price * size (USD). */
  premium: number;
  /** סך המסחר היומי של הטיקר (regular + dark), כשהמידע זמין. */
  volume: number | null;
  side: DarkPoolSide;
  exchange: string | null;
  marketCap: number | null;
  provider: DarkPoolProvider;
}

export type DarkPoolProvider = 'polygon' | 'unusualwhales' | 'intrinio' | 'mock';

/** קלט לקריאה לספק. */
export interface DarkPoolProviderQuery {
  /** ISO string — fetch all prints since this point. */
  since: string;
  /** maximum rows to return (default 1000). */
  limit?: number;
  /** filter by ticker (optional — used in ticker-detail page). */
  ticker?: string;
}

export interface DarkPoolProviderResponse {
  trades: NormalizedDarkPoolTrade[];
  /** cursor להמשך עימוד — שמור ב-dark_pool_provider_state.last_cursor. */
  nextCursor: string | null;
  /** ה-timestamp האחרון שטופל (לעדכון last_ts). */
  lastTimestamp: number | null;
}

// ---------------------------------------------------------------------------
// DB rows (מקבילים לעמודות במיגרציה 018)
// ---------------------------------------------------------------------------

export interface DarkPoolTradeRow {
  id: string;
  external_id: string | null;
  ticker: string;
  company_name: string | null;
  ts: string;
  price: number;
  size: number;
  premium: number;
  volume: number | null;
  side: DarkPoolSide;
  exchange: string | null;
  market_cap: number | null;
  provider: DarkPoolProvider;
  created_at: string;
}

export type DarkPoolSignalType =
  | 'UNUSUAL_VOLUME'
  | 'SWEEP'
  | 'WHALE'
  | 'HIDDEN_ACCUMULATION'
  | 'INSIDER_DARKPOOL_CONFLUENCE';

export interface DarkPoolSignalRow {
  id: string;
  ticker: string;
  signal_type: DarkPoolSignalType;
  score: number;
  reason: string | null;
  ai_summary: string | null;
  metrics: DarkPoolSignalMetrics;
  detected_at: string;
  expires_at: string | null;
  created_at: string;
  bucket_5m: string;
}

/**
 * המבנה של העמודה `metrics` ב-dark_pool_signals.
 * כל השדות אופציונליים — המנוע ממלא רק מה שרלוונטי לסוג הסיגנל.
 */
export interface DarkPoolSignalMetrics {
  premium_total?: number;
  premium_buy?: number;
  premium_sell?: number;
  prints?: number;
  whale_count?: number;
  relative_volume?: number;
  /** ימים שעברו מאז ה-insider buy האחרון (לקונפלוונס). */
  insider_days_ago?: number;
  /** ערך ה-insider buy שזוהה (USD). */
  insider_value?: number;
  insider_name?: string | null;
  company_name?: string | null;
  market_cap?: number | null;
  /** breakdown של הציון לפי 4 הקטגוריות (40/20/20/20). */
  score_breakdown?: ScoreBreakdown;
}

export interface ScoreBreakdown {
  premium_score: number;
  repeat_score: number;
  insider_score: number;
  rel_volume_score: number;
  /** משוקלל סופי (חישוב מקומי). */
  total: number;
}

export interface DarkPoolWatchlistRow {
  user_id: string;
  ticker: string;
  alerts_on: boolean;
  created_at: string;
}

export interface DarkPoolDailyAggregateRow {
  ticker: string;
  date: string;
  prints: number;
  total_volume: number;
  total_premium: number;
  buy_premium: number;
  sell_premium: number;
  whale_count: number;
  avg30_premium: number | null;
  updated_at: string;
}

export interface InsiderBuyRow {
  id: string;
  external_id: string | null;
  ticker: string;
  insider_name: string | null;
  insider_role: string | null;
  transaction_type: 'P' | 'S' | 'A' | 'M' | 'G' | 'F' | 'O' | 'D';
  shares: number;
  price: number;
  value: number;
  filed_at: string;
  transaction_date: string;
  source: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Aggregations consumed by UI
// ---------------------------------------------------------------------------

export interface TopAccumulationRow {
  ticker: string;
  buy_3d: number;
  sell_3d: number;
  total_3d: number;
  volume_3d: number;
  whales_3d: number;
  net_flow_3d: number;
  net_flow_ratio: number;
  last_date: string;
}

/** Helper שמאחד signal עם נתוני התראה / aggregation בלקוח. */
export interface DarkPoolFeedItem {
  signal: DarkPoolSignalRow;
  /** המסחר העדכני ביותר ב-DP שתואם לסיגנל — לתצוגת כותרת. */
  latestTrade?: DarkPoolTradeRow | null;
  /** עבור confluence — המידע על ה-insider buy שנקשר. */
  insiderHint?: {
    insider_name: string | null;
    value: number;
    days_ago: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Premium gating constants
// ---------------------------------------------------------------------------

/**
 * Master switch ל-Premium Gating ב-Dark Pool.
 *
 *   true  – משתמשי חינמי רואים top-N עם השהייה של 15 דקות (התנהגות הפרודקשן)
 *   false – כולם מקבלים גישה מלאה (real-time, ללא מגבלת כמות)
 *
 * הוחלף ל-false כדי לפתוח את הפיצ'ר לכל משתמשי האפליקציה בזמן הרצה הראשוני.
 */
export const DARK_POOL_PREMIUM_GATING_ENABLED = false;

export const DARK_POOL_FREE_DELAY_MINUTES = 15;
export const DARK_POOL_FREE_TOP_N = 3;
export const DARK_POOL_WHALE_THRESHOLD = 1_000_000;
export const DARK_POOL_UNUSUAL_VOLUME_RATIO = 3.0; // 300%
export const DARK_POOL_SWEEP_WINDOW_MIN = 5;
export const DARK_POOL_INSIDER_LOOKBACK_DAYS = 30;
