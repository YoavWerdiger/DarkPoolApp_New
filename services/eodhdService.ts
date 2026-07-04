import { supabase } from '../lib/supabase';
import benzingaService from './benzingaService';

// טיפוסים עבור EODHD API
export interface EODHDEconomicEvent {
  id: string;
  date: string;
  time: string;
  country: string;
  country_code: string;
  event: string;
  type: string;
  importance: 'high' | 'medium' | 'low';
  actual?: string | number;
  estimate?: string | number;
  previous?: string | number;
  currency?: string;
  period?: string;
  comparison?: 'yoy' | 'qoq' | 'mom';
}

export interface EODHDMacroIndicator {
  country_code: string;
  country_name: string;
  indicator: string;
  date: string;
  period: string;
  value: number;
  unit?: string;
}

export interface EODHDEarningsReport {
  code: string;
  name: string;
  report_date: string;
  date: string;
  before_after_market?: 'Before Market' | 'After Market';
  currency?: string;
  actual?: number;
  estimate?: number;
  difference?: number;
  percent?: number;
  updated?: string;
}

export interface EODHDResponse<T> {
  data: T[];
  total_count?: number;
  has_more?: boolean;
}

// רשימת מדדים כלכליים נתמכים
export const SUPPORTED_ECONOMIC_INDICATORS = {
  // מדדי מחירים
  CPI: 'Consumer Price Index',
  PPI: 'Producer Price Index',
  CORE_CPI: 'Core Consumer Price Index',
  CORE_PPI: 'Core Producer Price Index',
  
  // מדדי תעסוקה
  NFP: 'Non-Farm Payrolls',
  UNEMPLOYMENT_RATE: 'Unemployment Rate',
  JOBLESS_CLAIMS: 'Jobless Claims',
  AVERAGE_HOURLY_EARNINGS: 'Average Hourly Earnings',
  
  // מדדי ייצור ותעשייה
  PMI_MANUFACTURING: 'Manufacturing PMI',
  PMI_SERVICES: 'Services PMI',
  PMI_COMPOSITE: 'Composite PMI',
  ISM_MANUFACTURING: 'ISM Manufacturing',
  ISM_SERVICES: 'ISM Services',
  INDUSTRIAL_PRODUCTION: 'Industrial Production',
  MANUFACTURING_PRODUCTION: 'Manufacturing Production',
  
  // מדדי צריכה וקמעונאות
  RETAIL_SALES: 'Retail Sales',
  CONSUMER_SPENDING: 'Consumer Spending',
  PCE: 'Personal Consumption Expenditures',
  CORE_PCE: 'Core PCE',
  
  // מדדי נדל"ן
  EXISTING_HOME_SALES: 'Existing Home Sales',
  NEW_HOME_SALES: 'New Home Sales',
  HOUSING_STARTS: 'Housing Starts',
  BUILDING_PERMITS: 'Building Permits',
  
  // מדדי ריבית ומדיניות מוניטרית
  FED_FUNDS_RATE: 'Federal Funds Rate',
  INTEREST_RATE_DECISION: 'Interest Rate Decision',
  FOMC_MEETING: 'FOMC Meeting',
  
  // מדדי GDP וצמיחה
  GDP: 'GDP',
  GDP_GROWTH: 'GDP Growth Rate',
  REAL_GDP: 'Real GDP',
  
  // מדדי סחר
  TRADE_BALANCE: 'Trade Balance',
  EXPORTS: 'Exports',
  IMPORTS: 'Imports',
  
  // מדדי אמון
  CONSUMER_CONFIDENCE: 'Consumer Confidence',
  BUSINESS_CONFIDENCE: 'Business Confidence',
  MICHIGAN_CONSUMER_SENTIMENT: 'Michigan Consumer Sentiment'
};

// רשימת מדינות נתמכות
export const SUPPORTED_COUNTRIES = {
  US: 'United States',
  EU: 'European Union',
  UK: 'United Kingdom',
  JP: 'Japan',
  CA: 'Canada',
  AU: 'Australia',
  CH: 'Switzerland',
  CN: 'China',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  IL: 'Israel'
};

class EODHDService {
  private apiKey: string;
  private baseUrl = 'https://eodhd.com/api';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 דקות

  constructor() {
    const key = process.env.EXPO_PUBLIC_EODHD_API_KEY;
    if (!key) {
    }
    this.apiKey = key ?? '';
  }

  private async getCachedData(key: string): Promise<any | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
    const cached = await this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    const url = `${this.baseUrl}/${endpoint}`;
    const queryParams = new URLSearchParams({
      api_token: this.apiKey,
      fmt: 'json',
      ...params
    });

    try {
      const response = await fetch(`${url}?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`EODHD API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      throw error;
    }
  }

  // שליפת אירועים כלכליים - משתמש ב-Benzinga API (עדכונים בזמן אמת)
  async getEconomicEvents(params: {
    country?: string;
    type?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
    importance?: 'high' | 'medium' | 'low';
  } = {}): Promise<EODHDEconomicEvent[]> {
    try {
      // משתמש ב-Benzinga API במקום EODHD
      const countries = params.country ? [params.country] : ['US'];
      
      // ממיר importance מפורמט מחרוזת למספר של Benzinga
      let importanceNum: number | undefined = undefined;
      if (params.importance === 'high') {
        importanceNum = 4;
      } else if (params.importance === 'medium') {
        importanceNum = 2;
      }

      const benzingaEvents = await benzingaService.getEconomicCalendar({
        dateFrom: params.from,
        dateTo: params.to,
        countries,
        importance: importanceNum,
      });

      // המרה לפורמט EODHD (תאימות עם הקוד הקיים)
      return benzingaEvents.map(event => ({
        id: event.id,
        date: event.date,
        time: event.time,
        country: event.country,
        country_code: event.country,
        event: event.event_name,
        type: params.type || 'economic',
        importance: event.importance >= 4 ? 'high' : event.importance >= 2 ? 'medium' : 'low',
        actual: event.actual || undefined,
        estimate: event.consensus || undefined,
        previous: event.prior || undefined,
        period: event.event_period || undefined,
      }));
    } catch (error) {
      return [];
    }
  }

  // שליפת מדדים מאקרו
  async getMacroIndicators(params: {
    country: string;
    indicator?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<EODHDMacroIndicator[]> {
    try {
      const indicators = await this.makeRequest<EODHDMacroIndicator[]>('macroeconomic', params);
      return Array.isArray(indicators) ? indicators : [];
    } catch (error) {
      return [];
    }
  }

  // שליפת אירועים כלכליים עם pagination
  async getAllEconomicEvents(params: {
    country?: string;
    type?: string;
    from?: string;
    to?: string;
    importance?: 'high' | 'medium' | 'low';
  } = {}): Promise<EODHDEconomicEvent[]> {
    const allEvents: EODHDEconomicEvent[] = [];
    const limit = 100;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const events = await this.getEconomicEvents({
          ...params,
          limit,
          offset
        });

        if (events.length === 0) {
          hasMore = false;
        } else {
          allEvents.push(...events);
          offset += limit;
          
          // אם קיבלנו פחות מ-limit, זה אומר שזה הסוף
          if (events.length < limit) {
            hasMore = false;
          }
        }
      } catch (error) {
        hasMore = false;
      }
    }

    return allEvents;
  }

  // שליפת מדדים מאקרו עם pagination
  async getAllMacroIndicators(params: {
    country: string;
    indicator?: string;
    from?: string;
    to?: string;
  }): Promise<EODHDMacroIndicator[]> {
    const allIndicators: EODHDMacroIndicator[] = [];
    const limit = 100;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const indicators = await this.getMacroIndicators({
          ...params,
          limit,
          offset
        });

        if (indicators.length === 0) {
          hasMore = false;
        } else {
          allIndicators.push(...indicators);
          offset += limit;
          
          if (indicators.length < limit) {
            hasMore = false;
          }
        }
      } catch (error) {
        hasMore = false;
      }
    }

    return allIndicators;
  }

  // שליפת אירועים כלכליים עבור תאריך ספציפי (ארה"ב בלבד)
  async getEventsForDate(date: string): Promise<EODHDEconomicEvent[]> {
    return this.getEconomicEvents({
      country: 'US',
      from: date,
      to: date
    });
  }

  // שליפת אירועים כלכליים עבור שבוע (ארה"ב בלבד)
  async getEventsForWeek(startDate: string): Promise<EODHDEconomicEvent[]> {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    
    return this.getEconomicEvents({
      country: 'US',
      from: startDate,
      to: endDate.toISOString().split('T')[0]
    });
  }

  // שליפת מדדים כלכליים פופולריים (ארה"ב בלבד) - משתמש ב-Benzinga
  async getPopularEconomicIndicators(): Promise<EODHDEconomicEvent[]> {
    try {
      // שליפת אירועים בעלי חשיבות גבוהה מ-Benzinga
      const benzingaEvents = await benzingaService.getHighImportanceEconomicEvents(60, 2); // 60 ימים, חשיבות 2+

      // המרה לפורמט EODHD
      return benzingaEvents.map(event => ({
        id: event.id,
        date: event.date,
        time: event.time,
        country: event.country,
        country_code: event.country,
        event: event.event_name,
        type: 'economic',
        importance: event.importance >= 4 ? 'high' as const : event.importance >= 2 ? 'medium' as const : 'low' as const,
        actual: event.actual || undefined,
        estimate: event.consensus || undefined,
        previous: event.prior || undefined,
        period: event.event_period || undefined,
      })).sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateA.getTime() - dateB.getTime();
      });
    } catch (error) {
      return [];
    }
  }

  // שליפת דיווחי רווחים - משתמש ב-Benziga API (עדכונים בזמן אמת)
  async getEarningsCalendar(params: {
    from?: string;
    to?: string;
    symbols?: string; // סמלים מופרדים בפסיק, לדוגמה: "AAPL.US,MSFT.US"
  } = {}): Promise<EODHDEarningsReport[]> {
    try {
      // משתמש ב-Benziga API במקום EODHD
      return await benzingaService.getEarningsCalendar({
        from: params.from,
        to: params.to,
        symbols: params.symbols
      });
    } catch (error) {
      return [];
    }
  }

  // נתונים דמה לבדיקה במקרה של בעיית API
  private getSampleEarningsData(): EODHDEarningsReport[] {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    
    return [
      {
        code: 'AAPL.US',
        name: 'Apple Inc.',
        report_date: today.toISOString().split('T')[0],
        date: today.toISOString().split('T')[0],
        before_after_market: 'After Market',
        currency: 'USD',
        actual: 1.52,
        estimate: 1.50,
        difference: 0.02,
        percent: 1.33,
        updated: new Date().toISOString()
      },
      {
        code: 'MSFT.US',
        name: 'Microsoft Corporation',
        report_date: tomorrow.toISOString().split('T')[0],
        date: tomorrow.toISOString().split('T')[0],
        before_after_market: 'After Market',
        currency: 'USD',
        actual: 2.81,
        estimate: 2.75,
        difference: 0.06,
        percent: 2.18,
        updated: new Date().toISOString()
      },
      {
        code: 'GOOGL.US',
        name: 'Alphabet Inc.',
        report_date: dayAfter.toISOString().split('T')[0],
        date: dayAfter.toISOString().split('T')[0],
        before_after_market: 'After Market',
        currency: 'USD',
        actual: 1.45,
        estimate: 1.40,
        difference: 0.05,
        percent: 3.57,
        updated: new Date().toISOString()
      },
      {
        code: 'TSLA.US',
        name: 'Tesla Inc.',
        report_date: today.toISOString().split('T')[0],
        date: today.toISOString().split('T')[0],
        before_after_market: 'After Market',
        currency: 'USD',
        actual: 0.85,
        estimate: 0.90,
        difference: -0.05,
        percent: -5.56,
        updated: new Date().toISOString()
      }
    ];
  }

  // שליפת דיווחי רווחים עבור טווח תאריכים
  async getEarningsForDateRange(days: number = 7): Promise<EODHDEarningsReport[]> {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);
    
    const from = today.toISOString().split('T')[0];
    const to = futureDate.toISOString().split('T')[0];
    
    return this.getEarningsCalendar({ from, to });
  }

  // המרת אירוע EODHD לפורמט של האפליקציה
  convertToAppFormat(event: EODHDEconomicEvent) {
    return {
      id: event.id,
      title: event.event,
      description: `${event.type} - ${event.country}`,
      date: event.date,
      time: event.time,
      country: event.country,
      currency: event.currency || 'USD',
      importance: event.importance,
      actual: event.actual?.toString(),
      forecast: event.estimate?.toString(),
      previous: event.previous?.toString(),
      type: event.type,
      period: event.period
    };
  }

  // בדיקת זמינות API
  async checkApiAvailability(): Promise<boolean> {
    try {
      // בדיקה פשוטה עם בקשה מינימלית
      const testUrl = `${this.baseUrl}/economic-events?api_token=${this.apiKey}&fmt=json&limit=1&country=US`;
      const response = await fetch(testUrl);
      
      if (response.status === 403) {
        return false;
      }
      
      if (response.status === 401) {
        return false;
      }
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export default new EODHDService();
