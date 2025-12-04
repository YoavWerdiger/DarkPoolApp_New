// Fear and Greed Index Service
// שירות לשליפת מדד הפחד והתאווה (Fear and Greed Index)

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

class FearAndGreedService {
  private static instance: FearAndGreedService;
  private apiKey: string;
  private baseUrl = 'https://fear-and-greed-index.p.rapidapi.com';
  private cache: { data: FearAndGreedResponse | null; timestamp: number } | null = null;
  private cacheTimeout = 60 * 60 * 1000; // 1 שעה (המדד מתעדכן פעם ביום)

  private constructor() {
    // מפתח API מ-RapidAPI
    // אפשר להגדיר ב-.env כ-EXPO_PUBLIC_RAPIDAPI_KEY
    // או להגדיר ישירות כאן (לא מומלץ ל-production)
    // מפתח מהתמונה - להחליף במפתח שלך אם צריך
    const fallbackKey = '1728faf808msh542edbc5ac19c5dp1ac7a7jsna9780db906e3';
    this.apiKey = (process.env.EXPO_PUBLIC_RAPIDAPI_KEY || fallbackKey).trim();
    
    if (!this.apiKey) {
      console.warn('⚠️ FearAndGreedService: No RapidAPI key found. Set EXPO_PUBLIC_RAPIDAPI_KEY in your .env file');
    } else {
      console.log('✅ FearAndGreedService: RapidAPI key configured');
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
      console.log('📦 FearAndGreedService: Cache hit');
      return this.cache.data;
    }
    console.log('❌ FearAndGreedService: Cache miss');
    return null;
  }

  // שמירה ב-cache
  private setCachedData(data: FearAndGreedResponse): void {
    this.cache = { data, timestamp: Date.now() };
    console.log('💾 FearAndGreedService: Cached data');
  }

  // שליפת מדד הפחד והתאווה
  async getFearAndGreedIndex(): Promise<FearAndGreedResponse> {
    try {
      // בדיקת cache
      const cached = this.getCachedData();
      if (cached) {
        return cached;
      }

      if (!this.apiKey) {
        throw new Error('RapidAPI key is not configured');
      }

      console.log('🌐 FearAndGreedService: Fetching Fear and Greed Index from API');

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
      console.log('📊 FearAndGreedService: Raw API response:', JSON.stringify(rawData, null, 2));
      
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
        console.error('❌ FearAndGreedService: Unexpected API response format:', rawData);
        throw new Error(`Unexpected API response format. Received: ${JSON.stringify(rawData).substring(0, 200)}`);
      }
      
      // וידוא שהערך תקין (0-100)
      if (data.fgi.now.value < 0 || data.fgi.now.value > 100) {
        console.warn('⚠️ FearAndGreedService: Value out of range, normalizing:', data.fgi.now.value);
        data.fgi.now.value = Math.max(0, Math.min(100, data.fgi.now.value));
      }

      // שמירה ב-cache
      this.setCachedData(data);

      console.log('✅ FearAndGreedService: Successfully fetched Fear and Greed Index', {
        value: data.fgi.now.value,
        classification: data.fgi.now.valueClassification,
        timestamp: new Date(data.fgi.now.timestamp * 1000).toISOString(),
      });
      return data;
    } catch (error: any) {
      console.error('❌ FearAndGreedService: Error fetching Fear and Greed Index:', error);
      
      // אם יש cache ישן, נחזיר אותו במקום לזרוק שגיאה
      if (this.cache?.data) {
        console.log('📦 FearAndGreedService: Returning cached data due to error');
        return this.cache.data;
      }
      
      throw error;
    }
  }

  // קבלת הערך הנוכחי בלבד
  async getCurrentValue(): Promise<FearAndGreedData> {
    try {
      const data = await this.getFearAndGreedIndex();
      return data.fgi.now;
    } catch (error) {
      console.error('❌ FearAndGreedService: Error getting current value, returning fallback:', error);
      // החזרת ערך fallback במקרה של שגיאה
      return {
        value: 50,
        valueClassification: 'Neutral',
        timestamp: Math.floor(Date.now() / 1000),
      };
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

  // קבלת צבע לפי הערך - תואם לצבעי הגייג'
  getValueColor(value: number): string {
    if (value >= 75) return '#00FF00'; // ירוק - תאווה (75-100)
    if (value >= 50) return '#FFD700'; // צהוב - ניטרלי (50-75)
    if (value >= 25) return '#FF8C00'; // כתום - פחד (25-50)
    return '#FF0000'; // אדום - פחד קיצוני (0-25)
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

