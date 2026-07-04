export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  quantity: number;
  entry_date: string;
  exit_date: string;
  pnl: number;
  return_percentage?: number;
  notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  /** Risk management */
  stop_loss?: number | null;
  target_price?: number | null;
  strategy_name?: string | null;
  /** JSONB — מסגרת זמן, רגש, תוכנית, אסטרטגיה, סיבות, טעויות */
  journal_details?: Record<string, unknown> | null;
}
