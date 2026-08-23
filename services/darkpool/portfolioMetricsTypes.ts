/** טיפוסים משותפים לשחזור תיק (פוליטיקאים / בכירים) */

export interface PortfolioHoldingMetric {
  ticker: string;
  qty: number;
  cost_usd: number;
  current_price: number;
  market_value: number;
  allocation_pct: number;
  return_pct: number;
  /** תאריך קנייה ראשון בפוזיציה הפתוחה הנוכחית (YYYY-MM-DD) — משחזור עסקאות */
  first_added_date?: string | null;
  /**
   * true רק כש־qty/cost מבוססים על מניות מדווחות + מחיר Form4.
   * בלי זה — «מחיר כניסה» = Yahoo ב־first_added_date.
   */
  basis_reliable?: boolean;
  /** true כש־qty ממניות מדווחות (גם בלי מחיר Form4) */
  qty_disclosed?: boolean;
  /**
   * מחיר כניסה מוצר:
   * - basis_reliable: cost/qty
   * - אחרת: מחיר שוק ב־first_added_date
   */
  entry_price?: number | null;
}

export interface PortfolioValuePoint {
  date: string;
  value: number;
}

export interface ReconstructedPortfolioMetrics {
  portfolio_value: number;
  total_cost: number;
  total_return_usd: number;
  total_return_pct: number;
  series: PortfolioValuePoint[];
  holdings: PortfolioHoldingMetric[];
  period_returns: Record<string, number | null>;
  win_rate: number | null;
  avg_delay_days: number | null;
  trade_count: number;
  /** מטריקות סיכון — Sharpe, volatility, max drawdown */
  risk?: ProfilePortfolioRiskMetrics;
  /** ריכוזיות — HHI, top-3 */
  concentration?: ProfilePortfolioConcentration;
  /** ציון פרופיל 0–100 */
  score?: ProfilePortfolioScore;
}

export interface ProfilePortfolioRiskMetrics {
  volatility_pct: number | null;
  sharpe: number | null;
  sortino: number | null;
  max_drawdown_pct: number | null;
  period_days: number;
}

export interface ProfilePortfolioConcentration {
  /** Herfindahl 0–1 (1 = מניה בודדת) */
  hhi: number;
  top3_pct: number;
  unique_tickers: number;
}

export interface ProfilePortfolioScore {
  total: number;
  components: {
    return: number;
    win_rate: number;
    sharpe: number;
    diversification: number;
    activity: number;
  };
}

export type PortfolioSource =
  | 'reconstructed'
  | 'form4_reconstructed'
  | 'snapshot'
  | 'trades_only'
  | 'none';
