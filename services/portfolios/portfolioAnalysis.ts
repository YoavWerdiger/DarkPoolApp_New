/**
 * portfolioAnalysis.ts
 * --------------------------------------------------------------------------
 * עטיפה לקריאה ל-Edge Function portfolio-metrics.
 * מחזיר את כל מטריקות האנליזה + סדרות ערך לגרף Performance.
 */

import { supabase } from '../../lib/supabase';
import type {
  PortfolioAnalysis,
  PortfolioValuePoint,
} from '../../screens/Portfolios/portfolioTypes';

export interface PortfolioMetricsResponse extends PortfolioAnalysis {
  portfolio_series: { date: string; close: number }[];
  benchmark_series: { date: string; close: number }[];
}

export async function fetchPortfolioMetrics(
  portfolioId: string
): Promise<PortfolioMetricsResponse> {
  const { data, error } = await supabase.functions.invoke<PortfolioMetricsResponse>(
    'portfolio-metrics',
    { body: { portfolio_id: portfolioId } }
  );
  if (error) throw error;
  if (!data) throw new Error('empty_response');
  return data;
}

/** ממיר portfolio_series ל-PortfolioValuePoint (לשימוש בגרף) */
export function toValueHistory(
  series: { date: string; close: number }[]
): PortfolioValuePoint[] {
  return series.map((p) => ({
    date: p.date,
    total_value: p.close,
    cash: 0,
    invested: 0,
    unrealized: 0,
    realized: 0,
  }));
}
