// Fear and Greed Index Service
// שירות לשליפת מדד הפחד והתאווה (Fear and Greed Index)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface FearAndGreedData {
  value: number; // 0-100
  valueClassification: string; // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  timestamp: number;
  timeUntilUpdate?: number;
}

export interface FearAndGreedResponse {
  fgi: {
    now: FearAndGreedData;
    previousClose: FearAndGreedData;
    oneWeekAgo: FearAndGreedData;
    oneMonthAgo: FearAndGreedData;
    oneYearAgo: FearAndGreedData;
  };
}

/**
 * פלטה בולטת לרקע כהה — רוויה וברורה (סגנון CNN Fear & Greed).
 */
export const FEAR_GREED_COLORS = {
  extremeFear: '#FF3B3B',
  fear: '#FF8A00',
  neutral: '#FFD400',
  greed: '#4CAF50',
  greedExtreme: '#00C805',
} as const;

/** מקטעי הגייג' המלא — 5 אזורים, זוויות פרופורציונליות לטווחי 0–100 */
export const FEAR_GREED_GAUGE_SEGMENTS = [
  { start: -180, end: -135, color: FEAR_GREED_COLORS.extremeFear, label: 'פחד קיצוני' },
  { start: -135, end: -99, color: FEAR_GREED_COLORS.fear, label: 'פחד' },
  { start: -99, end: -81, color: FEAR_GREED_COLORS.neutral, label: 'ניטרלי' },
  { start: -81, end: -45, color: FEAR_GREED_COLORS.greed, label: 'תאווה' },
  { start: -45, end: 0, color: FEAR_GREED_COLORS.greedExtreme, label: 'תאווה קיצונית' },
] as const;

/** פס מיני (5 מקטעים — גבולות תואמים ל-getValueDescription) */
export const FEAR_GREED_MINI_SEGMENTS = [
  { label: 'פחד\nקיצוני', color: FEAR_GREED_COLORS.extremeFear, from: 0, to: 25 },
  { label: 'פחד', color: FEAR_GREED_COLORS.fear, from: 25, to: 45 },
  { label: 'ניטרלי', color: FEAR_GREED_COLORS.neutral, from: 45, to: 55 },
  { label: 'תאווה', color: FEAR_GREED_COLORS.greed, from: 55, to: 75 },
  { label: 'תאווה\nקיצונית', color: FEAR_GREED_COLORS.greedExtreme, from: 75, to: 100 },
] as const;

// v2 — מבטל קאש ישן (RapidAPI/יולי) שנשמר תחת v1 והציג 45/Neutral לנצח.
const PERSISTENT_CACHE_KEY = '@fear_and_greed_index_cache_v2';
const LEGACY_PERSISTENT_CACHE_KEY = '@fear_and_greed_index_cache_v1';
const PERSISTENT_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // נשתמש בקאש עד שבוע במקרה של offline

/** CNN stock-market Fear & Greed (RapidAPI listing is gone — 404). */
const CNN_FGI_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
const CNN_FGI_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://www.cnn.com',
  Referer: 'https://www.cnn.com/markets/fear-and-greed',
};

class FearAndGreedService {
  private static instance: FearAndGreedService;
  private cache: { data: FearAndGreedResponse | null; timestamp: number } | null = null;
  private cacheTimeout = 15 * 60 * 1000; // 15 דק' — בפרודקשן ה-cron מעדכן את המסד כל 15 דק'
  private persistentRestorePromise: Promise<void> | null = null;

  private constructor() {
    // טעינה אסינכרונית של קאש מתמשך מ-AsyncStorage כך שגם בהפעלה ראשונה
    // (לפני שהבקשה הראשונה הסתיימה) יהיה לנו ערך אמיתי אחרון להציג.
    this.persistentRestorePromise = this.restoreFromPersistentCache();
  }

  private async restoreFromPersistentCache(): Promise<void> {
    try {
      // ניקוי חד-פעמי של קאש v1 (יולי / RapidAPI) שלא יחזור כ-fallback
      void AsyncStorage.removeItem(LEGACY_PERSISTENT_CACHE_KEY).catch(() => undefined);

      const raw = await AsyncStorage.getItem(PERSISTENT_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        data: FearAndGreedResponse;
        timestamp: number;
      } | null;
      if (!parsed || !parsed.data?.fgi?.now) return;
      // לא משחזרים נתון ישן מדי כדי לא להציג ערך מטעה לאחר תקופה ארוכה ללא רשת
      if (Date.now() - parsed.timestamp > PERSISTENT_CACHE_MAX_AGE) return;
      if (!this.cache) {
        // לשחזר רק כ-offline fallback — timestamp:0 מבטיח ש-getCachedData
        // לא יחזיר את הערך כ"טרי" ויחסום fetch מ-DB/CNN.
        this.cache = { data: parsed.data, timestamp: 0 };
      }
    } catch {
      /* קאש פגום — נתעלם */
    }
  }

  private async persistCache(data: FearAndGreedResponse): Promise<void> {
    try {
      await AsyncStorage.setItem(
        PERSISTENT_CACHE_KEY,
        JSON.stringify({ data, timestamp: Date.now() })
      );
    } catch {
      /* כתיבה לקאש לא קריטית */
    }
  }

  static getInstance(): FearAndGreedService {
    if (!FearAndGreedService.instance) {
      FearAndGreedService.instance = new FearAndGreedService();
    }
    return FearAndGreedService.instance;
  }

  // בדיקה אם יש נתונים ב-cache
  private getCachedData(): FearAndGreedResponse | null {
    if (this.cache && Date.now() - this.cache.timestamp < this.cacheTimeout) {
      return this.cache.data;
    }
    return null;
  }

  // שמירה ב-cache (בזיכרון + persistent)
  private setCachedData(data: FearAndGreedResponse): void {
    this.cache = { data, timestamp: Date.now() };
    void this.persistCache(data);
  }

  /**
   * "Best effort" — מחזיר את הקאש האחרון שזמין כרגע (גם persistent),
   * בלי לזרוק שגיאה ובלי לסנתז ערך מזויף. שימושי בתור fallback ל-UI.
   */
  private async getAnyAvailableCache(): Promise<FearAndGreedResponse | null> {
    if (this.cache?.data) return this.cache.data;
    if (this.persistentRestorePromise) {
      try {
        await this.persistentRestorePromise;
      } catch {
        /* ignore */
      }
    }
    return this.cache?.data ?? null;
  }

  /**
   * Build a FearAndGreedResponse from a `fear_and_greed_index` row (DB cache
   * populated by the `fear-greed-update` Edge Function). Uses `raw_data` for
   * historical values when available, falling back to `now` for everything.
   */
  private buildFromSupabaseRow(row: {
    value: number;
    value_classification: string;
    timestamp: number;
    raw_data?: any;
  }): FearAndGreedResponse {
    const nowData: FearAndGreedData = {
      value: typeof row.value === 'number' ? row.value : parseInt(String(row.value)) || 50,
      valueClassification: row.value_classification || this.getValueDescription(row.value),
      timestamp: row.timestamp || Math.floor(Date.now() / 1000),
    };

    const buildHistorical = (item: any): FearAndGreedData => {
      if (!item) return nowData;
      const v = item.value ?? 50;
      return {
        value: typeof v === 'number' ? v : parseInt(String(v)) || 50,
        valueClassification:
          item.valueText || item.valueClassification || this.getValueDescription(v),
        timestamp: item.timestamp || nowData.timestamp,
      };
    };

    const fgi = row.raw_data?.fgi;

    return {
      fgi: {
        now: nowData,
        previousClose: buildHistorical(fgi?.previousClose),
        oneWeekAgo: buildHistorical(fgi?.oneWeekAgo),
        oneMonthAgo: buildHistorical(fgi?.oneMonthAgo),
        oneYearAgo: buildHistorical(fgi?.oneYearAgo),
      },
    };
  }

  /**
   * Try to load the cached Fear & Greed value from Supabase. The
   * `fear_and_greed_index` table is populated by the `fear-greed-update`
   * Edge Function (cron).
   *
   * Rows older than 36h are treated as a miss so the client can refresh
   * from CNN when the cron/updater is broken (RapidAPI outage left a July row).
   */
  private async getFromSupabase(opts?: {
    allowStale?: boolean;
  }): Promise<FearAndGreedResponse | null> {
    try {
      const { data, error } = await supabase
        .from('fear_and_greed_index')
        .select('value, value_classification, timestamp, raw_data, updated_at')
        .eq('id', 1)
        .maybeSingle();

      if (error || !data) return null;

      if (!opts?.allowStale && data.updated_at) {
        const ageMs = Date.now() - new Date(data.updated_at).getTime();
        if (Number.isFinite(ageMs) && ageMs > 36 * 60 * 60 * 1000) {
          return null;
        }
      }

      return this.buildFromSupabaseRow(data as any);
    } catch {
      return null;
    }
  }

  private clampScore(raw: unknown): number | null {
    const n =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim() !== ''
          ? Number(raw)
          : NaN;
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  private toUnixSeconds(raw: unknown): number {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
    }
    if (typeof raw === 'string' && raw.trim() !== '') {
      const ms = Date.parse(raw);
      if (Number.isFinite(ms)) return Math.floor(ms / 1000);
    }
    return Math.floor(Date.now() / 1000);
  }

  private normalizeEnglishRating(rating: unknown, score: number): string {
    const raw = typeof rating === 'string' ? rating.trim().toLowerCase() : '';
    if (raw.includes('extreme') && raw.includes('fear')) return 'Extreme Fear';
    if (raw.includes('extreme') && raw.includes('greed')) return 'Extreme Greed';
    if (raw === 'fear') return 'Fear';
    if (raw === 'greed') return 'Greed';
    if (raw === 'neutral') return 'Neutral';
    return this.getValueDescription(score);
  }

  /**
   * Direct CNN Fear & Greed fetch (no API key). Used when Supabase cache is
   * empty/stale-unreachable. RapidAPI was retired (endpoint 404).
   */
  private async getFromCnn(): Promise<FearAndGreedResponse> {
    const response = await fetch(CNN_FGI_URL, {
      method: 'GET',
      headers: CNN_FGI_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`CNN Fear & Greed API Error: ${response.status} ${response.statusText}`);
    }

    const cnn = await response.json();
    const fg = cnn?.fear_and_greed;
    const value = this.clampScore(fg?.score);
    if (value == null) {
      throw new Error('CNN Fear & Greed response missing score');
    }

    const timestamp = this.toUnixSeconds(fg.timestamp);
    const nowData: FearAndGreedData = {
      value,
      valueClassification: this.normalizeEnglishRating(fg.rating, value),
      timestamp,
    };

    const hist = (score: unknown): FearAndGreedData => {
      const v = this.clampScore(score);
      if (v == null) return nowData;
      return {
        value: v,
        valueClassification: this.normalizeEnglishRating(null, v),
        timestamp,
      };
    };

    return {
      fgi: {
        now: nowData,
        previousClose: hist(fg.previous_close),
        oneWeekAgo: hist(fg.previous_1_week),
        oneMonthAgo: hist(fg.previous_1_month),
        oneYearAgo: hist(fg.previous_1_year),
      },
    };
  }

  // שליפת מדד הפחד והתאווה
  async getFearAndGreedIndex(): Promise<FearAndGreedResponse> {
    // לפני הכל — נמתין לטעינת הקאש המתמשך כדי שלא נחזיר טעות
    // בהפעלה הראשונה (race condition בין constructor לקריאות הראשונות).
    if (this.persistentRestorePromise) {
      try {
        await this.persistentRestorePromise;
      } catch {
        /* ignore */
      }
    }

    try {
      // בדיקת cache בזיכרון
      const cached = this.getCachedData();
      if (cached) {
        return cached;
      }

      // 1) קודם כל ננסה Supabase — הטבלה מתעדכנת ע״י Edge Function.
      const fromDb = await this.getFromSupabase();
      if (fromDb) {
        this.setCachedData(fromDb);
        return fromDb;
      }

      // 2) fallback ישיר מ-CNN (בלי מפתח) אם ה-DB ריק / מיושן / לא נגיש
      const fromCnn = await this.getFromCnn();
      this.setCachedData(fromCnn);
      return fromCnn;
    } catch (error: any) {

      // אם יש cache ישן, נחזיר אותו במקום לזרוק שגיאה
      if (this.cache?.data) {
        return this.cache.data;
      }

      // ניסיון אחרון — DB גם אם מיושן, ואז CNN
      const fromDb = await this.getFromSupabase({ allowStale: true });
      if (fromDb) {
        this.setCachedData(fromDb);
        return fromDb;
      }

      try {
        const fromCnn = await this.getFromCnn();
        this.setCachedData(fromCnn);
        return fromCnn;
      } catch {
        /* fall through */
      }

      throw error;
    }
  }

  /**
   * קבלת הערך הנוכחי בלבד.
   *
   * חשוב: אנחנו **לא** מחזירים יותר ערך סינתטי של 50/Neutral במקרה של כשל —
   * זו הייתה הסיבה שמשתמשים ראו לפעמים 50 בפרודקשן בלי שום הסבר. במקום זה
   * אנחנו זורקים את השגיאה כדי שה-UI יוכל להציג מצב טעינה / שגיאה אמיתיים,
   * ולא ערך מזויף שנראה כמו נתון אמת.
   */
  async getCurrentValue(): Promise<FearAndGreedData> {
    const data = await this.getFearAndGreedIndex();
    return data.fgi.now;
  }

  /**
   * וריאנט לא-זורק שמחזיר `null` במקום ערך מסונתז. שימושי לתצוגות מינימליסטיות
   * שצריכות להעלות מצב "אין נתון" בלי קריסה.
   */
  async getCurrentValueOrNull(): Promise<FearAndGreedData | null> {
    try {
      const data = await this.getFearAndGreedIndex();
      return data.fgi.now;
    } catch {
      // כדי לא להראות 50 דיפולטי — מנסים להציג קאש אחרון אם יש כזה
      const cached = await this.getAnyAvailableCache();
      return cached?.fgi.now ?? null;
    }
  }

  // קבלת תיאור טקסטואלי של הערך
  getValueDescription(value: number): string {
    if (value >= 75) return 'תאווה קיצונית';
    if (value >= 55) return 'תאווה';
    if (value >= 45) return 'ניטרלי';
    if (value >= 25) return 'פחד';
    return 'פחד קיצוני';
  }

  // קבלת צבע לפי הערך - דינמי לפי האזור הנוכחי
  getValueColor(value: number): string {
    if (value >= 75) return FEAR_GREED_COLORS.greedExtreme;
    if (value >= 55) return FEAR_GREED_COLORS.greed;
    if (value >= 45) return FEAR_GREED_COLORS.neutral;
    if (value >= 25) return FEAR_GREED_COLORS.fear;
    return FEAR_GREED_COLORS.extremeFear;
  }

  // קבלת אייקון לפי הערך
  getValueIcon(value: number): string {
    if (value >= 75) return 'trending-up';
    if (value >= 55) return 'arrow-up';
    if (value >= 45) return 'remove';
    if (value >= 25) return 'arrow-down';
    return 'trending-down';
  }
}

// יצירת instance גלובלי
export const fearAndGreedService = FearAndGreedService.getInstance();

