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

const PERSISTENT_CACHE_KEY = '@fear_and_greed_index_cache_v1';
const PERSISTENT_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // נשתמש בקאש עד שבוע במקרה של offline

class FearAndGreedService {
  private static instance: FearAndGreedService;
  private apiKey: string;
  private baseUrl = 'https://fear-and-greed-index.p.rapidapi.com';
  private cache: { data: FearAndGreedResponse | null; timestamp: number } | null = null;
  private cacheTimeout = 15 * 60 * 1000; // 15 דק' — בפרודקשן ה-cron מעדכן את המסד כל 15 דק'
  private persistentRestorePromise: Promise<void> | null = null;

  private constructor() {
    const key = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;
    this.apiKey = (key ?? '').trim();
    // טעינה אסינכרונית של קאש מתמשך מ-AsyncStorage כך שגם בהפעלה ראשונה
    // (לפני שהבקשה הראשונה הסתיימה) יהיה לנו ערך אמיתי אחרון להציג.
    this.persistentRestorePromise = this.restoreFromPersistentCache();
  }

  private async restoreFromPersistentCache(): Promise<void> {
    try {
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
        this.cache = parsed;
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
   * Edge Function (cron) — this is what makes the card work in production
   * even when no `EXPO_PUBLIC_RAPIDAPI_KEY` is bundled in the client.
   */
  private async getFromSupabase(): Promise<FearAndGreedResponse | null> {
    try {
      const { data, error } = await supabase
        .from('fear_and_greed_index')
        .select('value, value_classification, timestamp, raw_data, updated_at')
        .eq('id', 1)
        .maybeSingle();

      if (error || !data) return null;
      return this.buildFromSupabaseRow(data as any);
    } catch {
      return null;
    }
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

      // 1) קודם כל ננסה Supabase — הטבלה מתעדכנת ע״י Edge Function עם הסוד מוסתר.
      //    זה גם הפתרון לפרודקשן (אין EXPO_PUBLIC_RAPIDAPI_KEY ב-bundle).
      const fromDb = await this.getFromSupabase();
      if (fromDb) {
        this.setCachedData(fromDb);
        return fromDb;
      }

      // 2) אם אין נתונים ב-DB, ננסה RapidAPI (במצבי dev/preview עם מפתח ב-.env)
      if (!this.apiKey) {
        throw new Error('RapidAPI key is not configured');
      }


      const response = await fetch(`${this.baseUrl}/v1/fgi`, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': 'fear-and-greed-index.p.rapidapi.com',
          'x-rapidapi-key': this.apiKey,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid RapidAPI key');
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const rawData = await response.json();
      
      // המרת הנתונים לפורמט אחיד
      let data: FearAndGreedResponse;
      
      // טיפול בפורמטים שונים של תגובה
      let nowData: FearAndGreedData;
      
      // פורמט 1: fgi.now (הפורמט הסטנדרטי)
      if (rawData.fgi?.now) {
        // קבלת הערך - יכול להיות value או valueClassification
        const value = rawData.fgi.now.value ?? 
                     (typeof rawData.fgi.now.valueClassification === 'number' ? rawData.fgi.now.valueClassification : null) ??
                     50;
        
        // קבלת התיאור - יכול להיות valueText או valueClassification
        const classification = rawData.fgi.now.valueText || 
                              rawData.fgi.now.valueClassification || 
                              this.getValueDescription(value);
        
        // קבלת timestamp - יכול להיות timestamp, lastUpdated.epochUnixSeconds, או lastUpdated.humanDate
        let timestamp = rawData.fgi.now.timestamp;
        if (!timestamp && rawData.lastUpdated) {
          timestamp = rawData.lastUpdated.epochUnixSeconds || 
                     (rawData.lastUpdated.humanDate ? Math.floor(new Date(rawData.lastUpdated.humanDate).getTime() / 1000) : null);
        }
        if (!timestamp) {
          timestamp = Math.floor(Date.now() / 1000);
        }
        
        nowData = {
          value: typeof value === 'number' ? value : parseInt(String(value)) || 50,
          valueClassification: classification,
          timestamp: timestamp,
          timeUntilUpdate: rawData.fgi.now.timeUntilUpdate,
        };
        
        // פונקציה עזר ליצירת נתונים היסטוריים
        const createHistoricalData = (item: any) => {
          if (!item) return nowData;
          const itemValue = item.value ?? 50;
          const itemClassification = item.valueText || item.valueClassification || this.getValueDescription(itemValue);
          return {
            value: typeof itemValue === 'number' ? itemValue : parseInt(String(itemValue)) || 50,
            valueClassification: itemClassification,
            timestamp: item.timestamp || timestamp,
            timeUntilUpdate: item.timeUntilUpdate,
          };
        };
        
        data = {
          fgi: {
            now: nowData,
            previousClose: createHistoricalData(rawData.fgi.previousClose),
            oneWeekAgo: createHistoricalData(rawData.fgi.oneWeekAgo),
            oneMonthAgo: createHistoricalData(rawData.fgi.oneMonthAgo),
            oneYearAgo: createHistoricalData(rawData.fgi.oneYearAgo),
          },
        };
      }
      // פורמט 2: נתונים ישירים ברמה העליונה
      else if (rawData.value !== undefined || rawData.now) {
        const value = rawData.value ?? rawData.now?.value ?? 50;
        const classification = rawData.valueClassification || rawData.now?.valueClassification || this.getValueDescription(value);
        
        nowData = {
          value: typeof value === 'number' ? value : parseInt(value) || 50,
          valueClassification: classification,
          timestamp: rawData.timestamp || rawData.now?.timestamp || Math.floor(Date.now() / 1000),
          timeUntilUpdate: rawData.timeUntilUpdate || rawData.now?.timeUntilUpdate,
        };
        
        data = {
          fgi: {
            now: nowData,
            previousClose: nowData,
            oneWeekAgo: nowData,
            oneMonthAgo: nowData,
            oneYearAgo: nowData,
          },
        };
      }
      // פורמט 3: מבנה אחר (למשל array או מבנה שונה)
      else if (Array.isArray(rawData) && rawData.length > 0) {
        const firstItem = rawData[0];
        nowData = {
          value: firstItem.value ?? firstItem.score ?? 50,
          valueClassification: firstItem.valueClassification || firstItem.classification || this.getValueDescription(firstItem.value ?? 50),
          timestamp: firstItem.timestamp || Math.floor(Date.now() / 1000),
          timeUntilUpdate: firstItem.timeUntilUpdate,
        };
        
        data = {
          fgi: {
            now: nowData,
            previousClose: nowData,
            oneWeekAgo: nowData,
            oneMonthAgo: nowData,
            oneYearAgo: nowData,
          },
        };
      }
      // פורמט לא צפוי - נזרוק שגיאה עם פרטים
      else {
        throw new Error(`Unexpected API response format. Received: ${JSON.stringify(rawData).substring(0, 200)}`);
      }
      
      // וידוא שהערך תקין (0-100)
      if (data.fgi.now.value < 0 || data.fgi.now.value > 100) {
        data.fgi.now.value = Math.max(0, Math.min(100, data.fgi.now.value));
      }

      // שמירה ב-cache
      this.setCachedData(data);

      return data;
    } catch (error: any) {

      // אם יש cache ישן, נחזיר אותו במקום לזרוק שגיאה
      if (this.cache?.data) {
        return this.cache.data;
      }

      // ניסיון אחרון — לקרוא מ-Supabase גם אם RapidAPI נכשל
      const fromDb = await this.getFromSupabase();
      if (fromDb) {
        this.setCachedData(fromDb);
        return fromDb;
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

