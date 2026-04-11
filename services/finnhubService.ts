// FinnhubService.ts - שירות לנתונים כלכליים מ-Finnhub API
import { supabase } from '../lib/supabase';

// API Configuration
const FINNHUB_API_KEY = 'd1uf6gpr01qpci1cbg00d1uf6gpr01qpci1cbg0g';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const FINNHUB_WS_URL = 'wss://ws.finnhub.io';

// טיפוסים עבור Finnhub Economic Calendar
export interface FinnhubEconomicEvent {
  actual: number | null;
  country: string;
  estimate: number | null;
  event: string;
  impact: 'low' | 'medium' | 'high';
  prev: number | null;
  time: string; // ISO 8601 format
  unit: string;
}

export interface FinnhubEconomicCalendarResponse {
  economicCalendar: FinnhubEconomicEvent[];
}

// טיפוסים נוספים
export interface FinnhubCompanyNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface FinnhubMarketNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

// טיפוס מאוחד לאירוע כלכלי באפליקציה
export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  currency: string;
  importance: 'high' | 'medium' | 'low';
  date: string;
  time: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  description?: string;
  category?: string;
  impact?: string;
  source: string;
  unit?: string;
}

class FinnhubService {
  private apiKey: string;
  private baseUrl: string;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 דקות

  constructor() {
    this.apiKey = FINNHUB_API_KEY;
    this.baseUrl = FINNHUB_BASE_URL;
  }

  // קבלת מידע מה-cache
  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  // שמירה ב-cache
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // בקשה כללית ל-API
  private async makeRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      return cached;
    }

    const url = new URL(`${this.baseUrl}/${endpoint}`);
    url.searchParams.append('token', this.apiKey);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        throw new Error(`Finnhub API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      throw error;
    }
  }

  // ============= Economic Calendar =============
  
  /**
   * שליפת יומן אירועים כלכליים
   * @param from תאריך התחלה (YYYY-MM-DD) - אופציונלי
   * @param to תאריך סיום (YYYY-MM-DD) - אופציונלי
   */
  async getEconomicCalendar(from?: string, to?: string): Promise<FinnhubEconomicEvent[]> {
    try {
      
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to) params.to = to;

      const response = await this.makeRequest<FinnhubEconomicCalendarResponse>(
        'calendar/economic',
        params
      );

      return response.economicCalendar || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * המרת אירוע Finnhub לפורמט של האפליקציה
   */
  convertToAppFormat(event: FinnhubEconomicEvent): EconomicEvent {
    const eventDate = new Date(event.time);
    const dateStr = eventDate.toISOString().split('T')[0];
    const timeStr = eventDate.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });

    // מיפוי מדינות לקודי מטבע
    const currencyMap: Record<string, string> = {
      'US': 'USD',
      'EU': 'EUR',
      'GB': 'GBP',
      'JP': 'JPY',
      'CA': 'CAD',
      'AU': 'AUD',
      'CH': 'CHF',
      'CN': 'CNY',
      'IL': 'ILS'
    };

    // קביעת קטגוריה לפי שם האירוע
    const category = this.determineCategory(event.event);

    return {
      id: `finnhub_${event.time}_${event.event.replace(/\s+/g, '_')}`,
      title: event.event,
      country: this.getCountryName(event.country),
      currency: currencyMap[event.country] || 'USD',
      importance: event.impact,
      date: dateStr,
      time: timeStr,
      actual: event.actual?.toString(),
      forecast: event.estimate?.toString(),
      previous: event.prev?.toString(),
      description: `${event.event} - ${this.getCountryName(event.country)}`,
      category,
      impact: event.impact,
      source: 'Finnhub',
      unit: event.unit
    };
  }

  /**
   * קביעת קטגוריה לפי שם האירוע
   */
  private determineCategory(eventName: string): string {
    const lowerName = eventName.toLowerCase();
    
    if (lowerName.includes('gdp') || lowerName.includes('growth')) {
      return 'צמיחה';
    }
    if (lowerName.includes('cpi') || lowerName.includes('inflation') || lowerName.includes('price')) {
      return 'אינפלציה';
    }
    if (lowerName.includes('employment') || lowerName.includes('unemployment') || lowerName.includes('jobs') || lowerName.includes('payroll')) {
      return 'תעסוקה';
    }
    if (lowerName.includes('retail') || lowerName.includes('sales') || lowerName.includes('consumer')) {
      return 'צריכה';
    }
    if (lowerName.includes('rate') || lowerName.includes('interest') || lowerName.includes('fed') || lowerName.includes('fomc')) {
      return 'ריבית';
    }
    if (lowerName.includes('manufacturing') || lowerName.includes('industrial') || lowerName.includes('production')) {
      return 'תעשייה';
    }
    if (lowerName.includes('trade') || lowerName.includes('export') || lowerName.includes('import')) {
      return 'סחר';
    }
    if (lowerName.includes('housing') || lowerName.includes('home') || lowerName.includes('building')) {
      return 'נדל"ן';
    }
    
    return 'כללי';
  }

  /**
   * המרת קוד מדינה לשם מלא
   */
  private getCountryName(code: string): string {
    const countryNames: Record<string, string> = {
      'US': 'ארצות הברית',
      'EU': 'גוש האירו',
      'GB': 'בריטניה',
      'JP': 'יפן',
      'CA': 'קנדה',
      'AU': 'אוסטרליה',
      'CH': 'שוויץ',
      'CN': 'סין',
      'DE': 'גרמניה',
      'FR': 'צרפת',
      'IT': 'איטליה',
      'ES': 'ספרד',
      'IL': 'ישראל',
      'IN': 'הודו',
      'BR': 'ברזיל',
      'RU': 'רוסיה',
      'KR': 'דרום קוריאה'
    };

    return countryNames[code] || code;
  }

  /**
   * קבלת אירועים לשבוע הקרוב
   */
  async getUpcomingWeekEvents(): Promise<EconomicEvent[]> {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const from = today.toISOString().split('T')[0];
    const to = nextWeek.toISOString().split('T')[0];

    const events = await this.getEconomicCalendar(from, to);
    return events.map(event => this.convertToAppFormat(event));
  }

  /**
   * קבלת אירועים לחודש הקרוב
   */
  async getUpcomingMonthEvents(): Promise<EconomicEvent[]> {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);

    const from = today.toISOString().split('T')[0];
    const to = nextMonth.toISOString().split('T')[0];

    const events = await this.getEconomicCalendar(from, to);
    return events.map(event => this.convertToAppFormat(event));
  }

  /**
   * קבלת אירועים בעלי חשיבות גבוהה בלבד
   */
  async getHighImportanceEvents(days: number = 30): Promise<EconomicEvent[]> {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + days);

    const from = today.toISOString().split('T')[0];
    const to = futureDate.toISOString().split('T')[0];

    const events = await this.getEconomicCalendar(from, to);
    const highImpactEvents = events.filter(event => event.impact === 'high');
    
    return highImpactEvents.map(event => this.convertToAppFormat(event));
  }

  // ============= Market News =============

  /**
   * קבלת חדשות שוק כלליות
   */
  async getMarketNews(category: string = 'general', minId: number = 0): Promise<FinnhubMarketNews[]> {
    try {
      
      const response = await this.makeRequest<FinnhubMarketNews[]>('news', {
        category,
        minId
      });

      return response || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * קבלת חדשות חברה
   */
  async getCompanyNews(
    symbol: string,
    from: string,
    to: string
  ): Promise<FinnhubCompanyNews[]> {
    try {
      
      const response = await this.makeRequest<FinnhubCompanyNews[]>('company-news', {
        symbol,
        from,
        to
      });

      return response || [];
    } catch (error) {
      return [];
    }
  }

  // ============= Additional Features =============

  /**
   * בדיקת זמינות API
   */
  async checkApiAvailability(): Promise<boolean> {
    try {
      
      // בדיקה פשוטה - קבלת חדשות כלליות
      const news = await this.makeRequest<any>('news', { category: 'general' });
      
      const isAvailable = Array.isArray(news) && news.length > 0;
      
      return isAvailable;
    } catch (error) {
      return false;
    }
  }

  /**
   * ניקוי cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * קבלת מידע על גודל ה-cache
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// יצוא instance יחיד (Singleton)
export default new FinnhubService();


