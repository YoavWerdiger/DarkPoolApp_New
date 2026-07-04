/** טיפוסים משותפים לשחזור תיק (פוליטיקאים / בכירים) */

export interface PortfolioHoldingMetric {
  ticker: string;
  qty: number;
  cost_usd: number;
  current_price: number;
  market_value: number;
  allocation_pct: number;
  return_pct: number;
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
}

export type PortfolioSource = 'reconstructed' | 'trades_only' | 'none';
