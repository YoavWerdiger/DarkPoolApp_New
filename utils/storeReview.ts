import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { logger } from './logger';

const KEY = 'store_review_state_v1';
const MIN_POSITIVE_MOMENTS = 3;
const MIN_DAYS_BETWEEN = 120;

type State = { positive: number; lastAskedAt: number | null };

/**
 * בקשת דירוג בחנות אחרי «רגעי ערך» (שיעור שהושלם, מנוי שנרכש, הוספה ל-Watchlist...).
 * מבקשים רק אחרי כמה רגעים כאלה, ולא יותר מפעם ב-120 יום (Apple מגבילה גם היא ל-3 בשנה).
 */
export async function recordPositiveMoment(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const st: State = raw ? JSON.parse(raw) : { positive: 0, lastAskedAt: null };
    st.positive += 1;
    const dueByTime = !st.lastAskedAt || Date.now() - st.lastAskedAt > MIN_DAYS_BETWEEN * 86_400_000;
    if (st.positive >= MIN_POSITIVE_MOMENTS && dueByTime && (await StoreReview.hasAction())) {
      await StoreReview.requestReview();
      st.positive = 0;
      st.lastAskedAt = Date.now();
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(st));
  } catch (e) {
    logger.warn('storeReview', 'request failed', e);
  }
}
