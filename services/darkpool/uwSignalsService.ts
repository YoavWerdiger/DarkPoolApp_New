import { supabase } from '../../lib/supabase';

export interface FlowAlertItem {
  id: string;
  ticker: string;
  type: 'call' | 'put';
  premium: number;
  rule: string;
  strike: string | null;
  expiry: string | null;
  volume_oi_ratio: number | null;
}

export interface UwSignalsPayload {
  flow_alerts: FlowAlertItem[];
  market_tide: {
    label: string;
    net_call_premium: number | null;
    net_put_premium: number | null;
    recorded_at: string | null;
  } | null;
  politics: {
    most_held: Array<{ ticker: string; count?: number }>;
    buy_volume_low: number | null;
    buy_volume_high: number | null;
  } | null;
  fetched_at: string;
}

let cache: { at: number; data: UwSignalsPayload } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function fetchUwSignals(force = false): Promise<UwSignalsPayload> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }
  const { data, error } = await supabase.functions.invoke<UwSignalsPayload | { error: string }>(
    'uw-signals',
    { body: {} }
  );
  if (error) throw error;
  if (data && 'error' in data && data.error) throw new Error(data.error);
  if (!data || !('flow_alerts' in data)) throw new Error('uw-signals: empty');
  cache = { at: Date.now(), data };
  return data;
}

export function clearUwSignalsCache() {
  cache = null;
}

export async function triggerInsiderSync(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ error?: string }>(
    'sync-insider-buys',
    { body: {} }
  );
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
