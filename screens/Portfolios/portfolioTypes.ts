/**
 * טיפוסי TypeScript מרכזיים לפיצ'ר תיקי השקעות.
 * משקפים את הסכמה ב-supabase/migrations/013_portfolios.sql.
 */

export type AssetType = 'stock' | 'etf' | 'fund' | 'forex' | 'crypto' | 'futures';

export type TransactionType =
  | 'buy'
  | 'sell'
  | 'deposit'
  | 'withdrawal'
  | 'fee'
  | 'dividend';

export type AssetTransactionType = Extract<TransactionType, 'buy' | 'sell'>;
export type CashTransactionType = Extract<
  TransactionType,
  'deposit' | 'withdrawal' | 'fee'
>;

/** כיוון טרייד עבור buy/sell. long: קניה פותחת. short: מכירה פותחת. */
export type TradeDirection = 'long' | 'short';

/** מקור הנתונים של התיק */
export type PortfolioSource = 'manual' | 'colmex_pro';

/** רשומה בטבלת portfolios */
export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  risk_free_rate: number;
  benchmark_symbol: string;
  auto_adjust_splits: boolean;
  description: string | null;
  is_archived: boolean;
  /** כשהוא true — משתמשים מאומתים אחרים יכולים לצפות בתיק (קריאה בלבד) */
  is_public?: boolean;
  /** broker integration */
  source?: PortfolioSource;
  broker_account_id?: string | null;
  read_only?: boolean;
  /**
   * יתרת מזומן זמינה — מתעדכנת ע"י טריגרים:
   * הפקדה/משיכה מ-portfolio_transactions + פתיחה/סגירת trades.
   * null = עמודה לא קיימת בגרסאות ישנות.
   */
  available_cash?: number | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioInsert {
  name: string;
  currency: string;
  risk_free_rate: number;
  benchmark_symbol: string;
  auto_adjust_splits?: boolean;
  description?: string | null;
  is_public?: boolean;
  /** יתרת פתיחה — מוגדרת בעת יצירת התיק */
  available_cash?: number;
}

/** רשומה בטבלת portfolio_transactions */
export interface PortfolioTransaction {
  id: string;
  portfolio_id: string;
  user_id: string;
  type: TransactionType;
  /** רלוונטי רק ל-buy/sell. ברירת מחדל 'long'. */
  direction: TradeDirection;
  symbol: string | null;
  asset_type: AssetType | null;
  exchange: string | null;
  quantity: number | null;
  price: number | null;
  commission: number | null;
  amount: number | null;
  currency: string;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetTransactionInsert {
  portfolio_id: string;
  type: AssetTransactionType;
  /** כיוון הטרייד — long: קניה פותחת. short: מכירה פותחת. ברירת מחדל 'long'. */
  direction?: TradeDirection;
  symbol: string;
  asset_type: AssetType;
  exchange?: string | null;
  quantity: number;
  price: number;
  commission?: number;
  currency?: string;
  date: string;
  notes?: string | null;
}

export interface CashTransactionInsert {
  portfolio_id: string;
  type: CashTransactionType;
  amount: number;
  currency?: string;
  date: string;
  notes?: string | null;
}

export interface DividendTransactionInsert {
  portfolio_id: string;
  type: 'dividend';
  symbol: string;
  amount: number;
  currency?: string;
  date: string;
  notes?: string | null;
}

export type AnyTransactionInsert =
  | AssetTransactionInsert
  | CashTransactionInsert
  | DividendTransactionInsert;

/** Quote שוטף (last + previous_close) למניה */
export interface PriceQuote {
  symbol: string;
  price: number;
  previous_close: number | null;
  /** פתיחה יומית — אם זמין מספק ה־quote */
  open?: number | null;
  /** גבוה יומי */
  day_high?: number | null;
  /** נמוך יומי */
  day_low?: number | null;
  /** ווליום יומי (מניות) — אם זמין */
  volume?: number | null;
  currency: string;
  as_of: string;
  source: string;
}

/** מחיר היסטורי (close יומי) */
export interface HistoricalPricePoint {
  date: string;
  close: number;
}

/** Holding מחושב – שורה בטבלת Holdings */
export interface PortfolioHolding {
  symbol: string;
  asset_type: AssetType | null;
  exchange: string | null;
  /** המטבע הראשי שבו נסחר הנכס (נגזר מהטרנזקציות) */
  currency: string;
  /** סקטור שוק (נגזר מסוג הנכס + symbol lookup) */
  sector: string | null;
  quantity: number;
  avg_price: number;
  invested: number;
  last_price: number;
  previous_close: number | null;
  value: number;
  unrealized_gain: number;
  unrealized_gain_pct: number;
  daily_gain: number;
  daily_gain_pct: number;
  realized_gain: number;
  total_gain: number;
  total_gain_pct: number;
  total_dividends: number;
  annualized_yield: number;
  allocation: number;
  is_closed: boolean;
}

/** סיכום תיק – הכרטיסיות העליונות */
export interface PortfolioSummary {
  portfolio_id: string;
  currency: string;
  cash: number;
  invested: number;
  value: number;
  total_value: number;
  unrealized_gain: number;
  realized_gain: number;
  total_gain: number;
  total_gain_pct: number;
  daily_gain: number;
  daily_gain_pct: number;
  annualized_yield: number;
  /** אחוז נכסים פתוחים ברווח מתוך אלו עם רווח/הפסד ברור (לא כולל איזון) */
  win_rate_pct: number | null;
  total_deposits: number;
  total_withdrawals: number;
  total_fees: number;
  total_dividends: number;
  holdings_count: number;
}

/** Performance metrics לכל הנכסים בתיק (ל-Analysis tab) */
export interface PortfolioAnalysis {
  beta_1y: number | null;
  beta_3y: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  volatility_1m: number | null;
  performance_periods: {
    '1W': number | null;
    '1M': number | null;
    '3M': number | null;
    YTD: number | null;
    '1Y': number | null;
    '5Y': number | null;
    All: number | null;
  };
  benchmark_comparison: {
    period: '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'All';
    portfolio_return: number;
    benchmark_return: number;
    alpha: number;
  }[];
}

/** נקודה בגרף – שווי תיק יומי */
export interface PortfolioValuePoint {
  date: string;
  total_value: number;
  cash: number;
  invested: number;
  unrealized: number;
  realized: number;
}

/* ============================================================================
 * Trade Journal entities (migration 031)
 * – PortfolioTradeMeta: רשומה ב-portfolio_trade_meta (סטופ/יעד/יומן)
 * – DerivedTrade: טרייד לוגי מחושב מ-FIFO על portfolio_transactions
 *   (אינו מאוחסן ב-DB — נחשב ב-TS service layer)
 * ========================================================================= */

export interface PortfolioTradeMeta {
  id: string;
  portfolio_id: string;
  user_id: string;
  symbol: string;
  direction: TradeDirection;
  opened_at: string;
  stop_loss: number | null;
  target_price: number | null;
  strategy_name: string | null;
  journal_details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioTradeMetaInsert {
  portfolio_id: string;
  symbol: string;
  direction: TradeDirection;
  opened_at: string;
  stop_loss?: number | null;
  target_price?: number | null;
  strategy_name?: string | null;
  journal_details?: Record<string, unknown> | null;
}

/**
 * טרייד לוגי נגזר מ-FIFO על portfolio_transactions.
 * לא מאוחסן ב-DB — מחושב on-demand בשירותי TS.
 *
 * is_open=true  → opened_at קיים, closed_at=null, exit_avg_price=null
 * is_open=false → opened_at + closed_at + exit_avg_price קיימים
 */
export interface DerivedTrade {
  /** key סינטטי ייחודי: `${portfolio_id}:${symbol}:${direction}:${opened_at}:${open_tx_id}` */
  key: string;
  portfolio_id: string;
  symbol: string;
  asset_type: AssetType | null;
  direction: TradeDirection;
  opened_at: string;
  closed_at: string | null;
  is_open: boolean;
  /** כמות שנפתחה בטרייד הזה */
  quantity: number;
  /** כמות שעדיין פתוחה (לפתוח: =quantity, לסגור חלקית: יתרה, לסגור מלא: 0) */
  open_quantity: number;
  entry_avg_price: number;
  exit_avg_price: number | null;
  /** עמלות שיוחסו לטרייד (חלוקה פרופורציונלית) */
  fees: number;
  /** P&L מומש (רק לחלק שנסגר). long: (exit-entry)*qty. short: (entry-exit)*qty. */
  realized_pnl: number;
  /** P&L לא ממומש על החלק שעדיין פתוח (לפי last price). nullable=אין מחיר. */
  unrealized_pnl: number | null;
  /** אחוז תשואה על החלק שנסגר */
  realized_pnl_pct: number | null;
  currency: string;
  /** meta מטבלת portfolio_trade_meta — null אם המשתמש לא הגדיר. */
  meta: PortfolioTradeMeta | null;
}

/** Distribution – פילוח נכסים בתיק */
export interface DistributionSlice {
  key: string;
  label: string;
  value: number;
  percentage: number;
  color?: string;
}

export type DistributionGroupBy = 'symbol' | 'asset_type' | 'sector' | 'currency';

/** Holdings table – המודים השונים */
export type HoldingsViewMode =
  | 'position'
  | 'price'
  | 'financials'
  | 'performance'
  | 'risk'
  | 'technicals';

export type HoldingsGroupBy = 'none' | 'currency' | 'asset_type' | 'sector' | 'exchange';

export type HoldingsSummaryMode = 'min' | 'max' | 'avg' | 'median';

/** סוגי תקופות לטאב Performance */
export type PerformancePeriod = '1W' | '1M' | '3M' | 'YTD' | '1Y' | '5Y' | 'All';

/* ============================================================================
 * Trade model (migration 20260723) — trades עם OPEN/CLOSED
 * ========================================================================= */

/** סטטוס פוזיציה */
export type TradeStatus = 'OPEN' | 'CLOSED';

/**
 * רשומה בטבלת trades (DB entity).
 * פוזיציה בודדת עם כניסה/יציאה, leverage, ו-profit_loss אוטומטי.
 */
export interface Trade {
  id: string;
  portfolio_id: string;
  user_id: string;
  symbol: string;
  asset_type: AssetType;
  exchange: string | null;
  currency: string;
  direction: TradeDirection;
  status: TradeStatus;
  entry_date: string;
  entry_price: number;
  quantity: number;
  leverage: number;
  exit_date: string | null;
  exit_price: number | null;
  /** P&L ממומש — מחושב אוטומטית ע"י PG trigger בסגירה. null כל עוד OPEN. */
  profit_loss: number | null;
  /** ערך לנקודה עבור פיוצ'רס (לדוגמה $50 ל-ES). null לנכסים רגילים. */
  point_value: number | null;
  commission: number;
  notes: string | null;
  stop_loss: number | null;
  target_price: number | null;
  strategy_name: string | null;
  journal_details: Record<string, unknown> | null;
  /** מזהה פוזיציה ב-Colmex — ל-upsert idempotent בסנכרון ברוקר */
  colmex_position_id?: string | null;
  /** מקור הטרייד: manual | colmex_pro | import */
  source?: string | null;
  created_at: string;
  updated_at: string;
}

/** Insert payload ל-trades (user_id ממולא ע"י השירות) */
export interface TradeInsert {
  portfolio_id: string;
  symbol: string;
  asset_type: AssetType;
  exchange?: string | null;
  currency?: string;
  direction?: TradeDirection;
  entry_date: string;
  entry_price: number;
  quantity: number;
  leverage?: number;
  point_value?: number | null;
  commission?: number;
  notes?: string | null;
  stop_loss?: number | null;
  target_price?: number | null;
  strategy_name?: string | null;
  journal_details?: Record<string, unknown> | null;
}

/** Snapshot יומי מטבלת daily_portfolio_snapshots */
export interface DailyPortfolioSnapshot {
  portfolio_id: string;
  snapshot_date: string;
  portfolio_value: number;
  realized_pnl: number;
  cash: number;
  trade_count: number;
  /** הפקדות שנכנסו ביום זה (הון חיצוני — משמש לחישוב TWR) */
  deposits_today: number;
  /** משיכות שיצאו ביום זה (הון חיצוני — משמש לחישוב TWR) */
  withdrawals_today: number;
  /** דיבידנדים שהתקבלו ביום זה (תשואה, לא הון חיצוני) */
  dividends_today: number;
  /** עמלות/דמי-ניהול שנגבו ביום זה (הוצאה, לא הון חיצוני) */
  fees_today: number;
}

/** סטטיסטיקות תיק מטבלת portfolio_stats */
export interface PortfolioStats {
  portfolio_id: string;
  total_trades: number;
  open_trades: number;
  closed_trades: number;
  win_trades: number;
  loss_trades: number;
  total_pnl: number;
  win_rate: number | null;
  avg_pnl: number | null;
  /** ממוצע P&L של trades רווחיים בלבד */
  avg_win: number | null;
  /** ממוצע P&L של trades הפסדיים בלבד */
  avg_loss: number | null;
  /** סך דיבידנדים מ-portfolio_transactions */
  total_dividends: number;
  /** סך עמלות/דמי-ניהול מ-portfolio_transactions */
  total_fees: number;
  /** הפקדות פחות משיכות — הון חיצוני נטו */
  net_deposits: number;
  updated_at: string;
}
