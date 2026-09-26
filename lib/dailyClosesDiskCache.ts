import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CongressBasketPricePoint } from '../screens/DarkPool/utils/investorHoldings';

const KEY_PREFIX = '@app_yahoo_daily_v1:';
const TTL_MS = 24 * 60 * 60 * 1000;

type Entry = {
  updatedAt: number;
  points: CongressBasketPricePoint[];
};

function storageKey(ticker: string, range: '1y' | '5y'): string {
  return `${KEY_PREFIX}${range}:${ticker.toUpperCase()}`;
}

export async function readDailyClosesFromDisk(
  ticker: string,
  range: '1y' | '5y'
): Promise<CongressBasketPricePoint[] | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(ticker, range));
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry;
    if (Date.now() - entry.updatedAt > TTL_MS) return null;
    if (!Array.isArray(entry.points) || entry.points.length < 2) return null;
    return entry.points;
  } catch {
    return null;
  }
}

export async function writeDailyClosesToDisk(
  ticker: string,
  range: '1y' | '5y',
  points: CongressBasketPricePoint[]
): Promise<void> {
  if (points.length < 2) return;
  try {
    const payload: Entry = { updatedAt: Date.now(), points };
    await AsyncStorage.setItem(storageKey(ticker, range), JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}
