// Benzinga API Service
// שירות לשליפת נתוני earnings calendar מ-Benziga API

export interface BenzingaEarnings {
  id: string;
  date: string;
  date_confirmed: string;
  time: string;
  ticker: string;
  exchange: string;
  name: string;
  currency: string;
  period: string;
  period_year: number;
  eps_type: string;
  eps: string;
  eps_est: string;
  eps_prior: string;
  eps_surprise: string;
  eps_surprise_percent: string;
  revenue_type: string;
  revenue: string;
  revenue_est: string;
  revenue_prior: string;
  revenue_surprise: string;
  revenue_surprise_percent: string;
  importance: number;
  notes: string;
  updated: number;
}

export interface BenzingaEarningsResponse {
  earnings: BenzingaEarnings[];
}

// ממשק לחדשות Benzinga
export interface BenzingaNewsArticle {
  id: string;
  author: string;
  created: string; // ISO timestamp
  updated: string; // ISO timestamp
  title: string;
  teaser: string;
  body: string;
  url: string;
  image?: {
    size?: string;
    url?: string;
  }[];
  channels?: {
    name: string;
  }[];
  stocks?: {
    name: string;
  }[];
  tags?: {
    name: string;
  }[];
}

export interface BenzingaNewsResponse {
  news: BenzingaNewsArticle[];
}

// ממשק ליומן כלכלי Benzinga
export interface BenzingaEconomicEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  country: string;
  event_name: string;
  event_period: string;
  period_year: number; // YYYY
  actual: string; // float
  actual_t: string;
  consensus: string; // float
  consensus_t: string;
  prior: string; // float
  prior_t: string;
  importance: number; // 0-5
  updated: number; // Unix timestamp
  description: string;
}

export interface BenzingaEconomicsResponse {
  economics: BenzingaEconomicEvent[];
}

// ממיר Benzinga earnings לפורמט EODHD (להתאמה עם הקוד הקיים)
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

class BenzingaService {
  private apiKey: string;
  private baseUrl = 'https://api.benzinga.com/api/v2';

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_BENZINGA_API_KEY || 'bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC';
  }

  /**
   * המרת Benzinga earnings לפורמט EODHD
   */
  private convertToEODHDFormat(earning: BenzingaEarnings): EODHDEarningsReport {
    // קובע לפני/אחרי שוק לפי השעה
    let before_after_market: 'Before Market' | 'After Market' | undefined = undefined;
    if (earning.time) {
      const hour = parseInt(earning.time.split(':')[0]);
      // לפני השוק: 4:00-9:30, אחרי השוק: 16:00-20:00
      if (hour >= 4 && hour < 10) {
        before_after_market = 'Before Market';
      } else if (hour >= 16 && hour < 20) {
        before_after_market = 'After Market';
      }
    }

    // מחשב difference ו-percent מ-EPS
    let actual: number | undefined = undefined;
    let estimate: number | undefined = undefined;
    let difference: number | undefined = undefined;
    let percent: number | undefined = undefined;

    // משתמש ב-EPS אם יש, אחרת ב-revenue
    if (earning.eps && earning.eps !== '') {
      actual = parseFloat(earning.eps);
      if (!isNaN(actual)) {
        if (earning.eps_est && earning.eps_est !== '') {
          estimate = parseFloat(earning.eps_est);
          if (!isNaN(estimate)) {
            difference = actual - estimate;
            percent = estimate !== 0 ? (difference / Math.abs(estimate)) * 100 : 0;
          }
        }
      }
    } else if (earning.revenue && earning.revenue !== '') {
      actual = parseFloat(earning.revenue);
      if (!isNaN(actual)) {
        if (earning.revenue_est && earning.revenue_est !== '') {
          estimate = parseFloat(earning.revenue_est);
          if (!isNaN(estimate)) {
            difference = actual - estimate;
            percent = estimate !== 0 ? (difference / Math.abs(estimate)) * 100 : 0;
          }
        }
      }
    }

    // טיקר בפורמט .US
    const tickerCode = earning.ticker.includes('.') ? earning.ticker : `${earning.ticker}.US`;

    return {
      code: tickerCode,
      name: earning.name || earning.ticker,
      report_date: earning.date,
      date: earning.date,
      before_after_market,
      currency: earning.currency || 'USD',
      actual,
      estimate,
      difference,
      percent,
      updated: earning.updated ? new Date(earning.updated * 1000).toISOString() : undefined,
    };
  }

  /**
   * שליפת earnings calendar
   */
  async getEarningsCalendar(params: {
    from?: string;
    to?: string;
    symbols?: string; // סמלים מופרדים בפסיק, לדוגמה: "AAPL,MSFT"
    page?: number;
    pagesize?: number;
  } = {}): Promise<EODHDEarningsReport[]> {
    try {
      const allEarnings: BenzingaEarnings[] = [];
      let currentPage = params.page || 0;
      const pageSize = params.pagesize || 1000; // מקסימום 1000
      let hasMore = true;

      // Benzinga תומך ב-pagination
      while (hasMore) {
        const url = new URL(`${this.baseUrl}/calendar/earnings`);
        url.searchParams.append('token', this.apiKey);
        url.searchParams.append('accept', 'application/json');

        if (params.from) {
          url.searchParams.append('parameters[date_from]', params.from);
        }
        if (params.to) {
          url.searchParams.append('parameters[date_to]', params.to);
        }
        if (params.symbols) {
          // ממיר מפורמט .US לפורמט נקי
          const cleanSymbols = params.symbols
            .split(',')
            .map(s => s.trim().replace('.US', ''))
            .join(',');
          url.searchParams.append('parameters[tickers]', cleanSymbols);
        }
        url.searchParams.append('page', currentPage.toString());
        url.searchParams.append('pagesize', pageSize.toString());

        console.log(`📡 Calling Benzinga API (page ${currentPage})...`);
        const response = await fetch(url.toString());

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(`Benzinga API: Unauthorized - Invalid API key`);
          }
          throw new Error(`Benzinga API Error: ${response.status} ${response.statusText}`);
        }

        const data: BenzingaEarningsResponse = await response.json();

        if (data.earnings && Array.isArray(data.earnings)) {
          allEarnings.push(...data.earnings);
          
          // אם קיבלנו פחות מ-pageSize, זה הסוף
          if (data.earnings.length < pageSize) {
            hasMore = false;
          } else {
            currentPage++;
            // מגביל ל-10 עמודים מקסימום (10,000 רשומות)
            if (currentPage >= 10) {
              hasMore = false;
            }
          }
        } else {
          hasMore = false;
        }

        // קצב בקשות סביבי
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`📊 Received ${allEarnings.length} earnings from Benzinga`);

      // המרה לפורמט EODHD
      const convertedEarnings = allEarnings.map(earning => this.convertToEODHDFormat(earning));

      // מיון לפי תאריך
      return convertedEarnings.sort((a, b) => {
        const dateA = new Date(a.report_date);
        const dateB = new Date(b.report_date);
        return dateB.getTime() - dateA.getTime(); // מהחדש לישן
      });
    } catch (error) {
      console.error('Error fetching earnings calendar from Benzinga:', error);
      throw error;
    }
  }

  /**
   * בדיקת זמינות API
   */
  async checkApiAvailability(): Promise<boolean> {
    try {
      const url = new URL(`${this.baseUrl}/calendar/earnings`);
      url.searchParams.append('token', this.apiKey);
      url.searchParams.append('accept', 'application/json');
      url.searchParams.append('pagesize', '1');

      const response = await fetch(url.toString());

      if (response.status === 401) {
        console.log('❌ Benzinga API: 401 Unauthorized - API key invalid');
        return false;
      }

      return response.ok;
    } catch (error) {
      console.error('Benzinga API not available:', error);
      return false;
    }
  }

  /**
   * קבלת WebSocket URL ל-earnings stream
   * הערה: WebSocket צריך לרוץ ב-edge function (ראה benzinga-websocket-stream)
   */
  getWebSocketUrl(tickers?: string[]): string {
    const wsBaseUrl = 'wss://api.benzinga.com/api/v2.1/calendar/earnings/stream';
    const url = new URL(wsBaseUrl);
    url.searchParams.append('token', this.apiKey);
    
    if (tickers && tickers.length > 0) {
      // ממיר tickers לפורמט נקי (ללא .US)
      const cleanTickers = tickers
        .map(t => t.trim().replace('.US', ''))
        .join(',');
      url.searchParams.append('tickers', cleanTickers);
    }
    
    return url.toString();
  }

  /**
   * שליפת יומן כלכלי (Economic Calendar) מ-Benzinga
   * @param params - פרמטרים לסינון האירועים
   */
  async getEconomicCalendar(params: {
    pageSize?: number;
    page?: number;
    dateFrom?: string; // YYYY-MM-DD
    dateTo?: string; // YYYY-MM-DD
    countries?: string[]; // רשימת מדינות (US, GB, EU, etc.)
    importance?: number; // 0-5 (ככל שגבוה יותר, כך חשוב יותר)
    updated?: number; // Unix timestamp - אירועים שעודכנו מאז
  } = {}): Promise<BenzingaEconomicEvent[]> {
    try {
      const allEvents: BenzingaEconomicEvent[] = [];
      let currentPage = params.page || 0;
      const pageSize = params.pageSize || 1000; // מקסימום 1000
      let hasMore = true;

      while (hasMore) {
        const url = new URL(`${this.baseUrl}/calendar/economics`);
        url.searchParams.append('token', this.apiKey);
        url.searchParams.append('accept', 'application/json');
        url.searchParams.append('page', currentPage.toString());
        url.searchParams.append('pagesize', pageSize.toString());

        if (params.dateFrom) {
          url.searchParams.append('parameters[date_from]', params.dateFrom);
        }
        if (params.dateTo) {
          url.searchParams.append('parameters[date_to]', params.dateTo);
        }
        if (params.countries && params.countries.length > 0) {
          url.searchParams.append('parameters[country]', params.countries.join(','));
        }
        if (params.importance !== undefined) {
          url.searchParams.append('parameters[importance]', params.importance.toString());
        }
        if (params.updated) {
          url.searchParams.append('parameters[updated]', params.updated.toString());
        }

        console.log(`📡 Calling Benzinga Economics API (page ${currentPage})...`);
        const response = await fetch(url.toString());

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(`Benzinga API: Unauthorized - Invalid API key`);
          }
          throw new Error(`Benzinga Economics API Error: ${response.status} ${response.statusText}`);
        }

        const data: BenzingaEconomicsResponse = await response.json();

        if (data.economics && Array.isArray(data.economics) && data.economics.length > 0) {
          allEvents.push(...data.economics);
          
          // אם קיבלנו פחות מ-pageSize, זה הסוף
          if (data.economics.length < pageSize) {
            hasMore = false;
          } else {
            currentPage++;
            // מגביל ל-10 עמודים מקסימום (10,000 אירועים)
            if (currentPage >= 10) {
              hasMore = false;
            }
          }
        } else {
          hasMore = false;
        }

        // קצב בקשות סביבי
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`📊 Received ${allEvents.length} economic events from Benzinga`);
      return allEvents;
    } catch (error) {
      console.error('Error fetching economic calendar from Benzinga:', error);
      throw error;
    }
  }

  /**
   * שליפת אירועים כלכליים עתידיים
   */
  async getUpcomingEconomicEvents(days: number = 30, countries: string[] = ['US']): Promise<BenzingaEconomicEvent[]> {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    return this.getEconomicCalendar({
      dateFrom: now.toISOString().split('T')[0],
      dateTo: future.toISOString().split('T')[0],
      countries,
    });
  }

  /**
   * שליפת אירועים כלכליים בעלי חשיבות גבוהה בלבד
   */
  async getHighImportanceEconomicEvents(days: number = 30, minImportance: number = 3): Promise<BenzingaEconomicEvent[]> {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    return this.getEconomicCalendar({
      dateFrom: now.toISOString().split('T')[0],
      dateTo: future.toISOString().split('T')[0],
      countries: ['US'],
      importance: minImportance,
    });
  }

  /**
   * המרת אירוע כלכלי של Benzinga לפורמט של האפליקציה
   */
  convertEconomicEventToAppFormat(event: BenzingaEconomicEvent) {
    // ממיר importance של Benzinga (0-5) לפורמט של האפליקציה (high/medium/low)
    let importance: 'high' | 'medium' | 'low' = 'low';
    if (event.importance >= 4) {
      importance = 'high';
    } else if (event.importance >= 2) {
      importance = 'medium';
    }

    return {
      id: event.id,
      title: event.event_name,
      description: event.description || '',
      date: event.date,
      time: event.time,
      country: event.country,
      importance,
      actual: event.actual || undefined,
      forecast: event.consensus || undefined,
      previous: event.prior || undefined,
      period: event.event_period || undefined,
      period_year: event.period_year,
      updated: event.updated ? new Date(event.updated * 1000).toISOString() : undefined,
      source: 'Benzinga',
    };
  }

  /**
   * שליפת חדשות מ-Benzinga
   * @param params - פרמטרים לסינון החדשות
   */
  async getNews(params: {
    pageSize?: number;
    page?: number;
    displayOutput?: 'full' | 'headline';
    dateFrom?: string; // YYYY-MM-DD
    dateTo?: string; // YYYY-MM-DD
    tickers?: string[]; // רשימת טיקרים
    channels?: string[]; // ערוצי חדשות (News, Ratings, etc.)
    topics?: string[]; // נושאים
    updatedSince?: number; // Unix timestamp
  } = {}): Promise<BenzingaNewsArticle[]> {
    try {
      const allNews: BenzingaNewsArticle[] = [];
      let currentPage = params.page || 0;
      const pageSize = params.pageSize || 100; // מקסימום 100
      let hasMore = true;

      while (hasMore) {
        const url = new URL(`${this.baseUrl}/news`);
        url.searchParams.append('token', this.apiKey);
        url.searchParams.append('accept', 'application/json');
        url.searchParams.append('page', currentPage.toString());
        url.searchParams.append('pagesize', pageSize.toString());
        url.searchParams.append('displayOutput', params.displayOutput || 'full');

        if (params.dateFrom) {
          url.searchParams.append('dateFrom', params.dateFrom);
        }
        if (params.dateTo) {
          url.searchParams.append('dateTo', params.dateTo);
        }
        if (params.tickers && params.tickers.length > 0) {
          const cleanTickers = params.tickers
            .map(t => t.trim().replace('.US', ''))
            .join(',');
          url.searchParams.append('tickers', cleanTickers);
        }
        if (params.channels && params.channels.length > 0) {
          url.searchParams.append('channels', params.channels.join(','));
        }
        if (params.topics && params.topics.length > 0) {
          url.searchParams.append('topics', params.topics.join(','));
        }
        if (params.updatedSince) {
          url.searchParams.append('updatedSince', params.updatedSince.toString());
        }

        console.log(`📡 Calling Benzinga News API (page ${currentPage})...`);
        const response = await fetch(url.toString());

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(`Benzinga API: Unauthorized - Invalid API key`);
          }
          throw new Error(`Benzinga News API Error: ${response.status} ${response.statusText}`);
        }

        const data: BenzingaNewsArticle[] = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          allNews.push(...data);
          
          // אם קיבלנו פחות מ-pageSize, זה הסוף
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            currentPage++;
            // מגביל ל-5 עמודים מקסימום (500 חדשות)
            if (currentPage >= 5) {
              hasMore = false;
            }
          }
        } else {
          hasMore = false;
        }

        // קצב בקשות סביבי
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`📰 Received ${allNews.length} news articles from Benzinga`);
      return allNews;
    } catch (error) {
      console.error('Error fetching news from Benzinga:', error);
      throw error;
    }
  }

  /**
   * שליפת חדשות אחרונות (ברירת מחדל - 24 שעות אחרונות)
   */
  async getRecentNews(hours: number = 24, pageSize: number = 50): Promise<BenzingaNewsArticle[]> {
    const now = new Date();
    const past = new Date(now.getTime() - hours * 60 * 60 * 1000);
    
    return this.getNews({
      dateFrom: past.toISOString().split('T')[0],
      dateTo: now.toISOString().split('T')[0],
      pageSize,
      displayOutput: 'full',
    });
  }

  /**
   * שליפת חדשות לפי טיקרים ספציפיים
   */
  async getNewsByTickers(tickers: string[], days: number = 7): Promise<BenzingaNewsArticle[]> {
    const now = new Date();
    const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return this.getNews({
      tickers,
      dateFrom: past.toISOString().split('T')[0],
      dateTo: now.toISOString().split('T')[0],
      displayOutput: 'full',
    });
  }

  /**
   * המרת חדשת Benzinga לפורמט של האפליקציה
   */
  convertNewsToAppFormat(article: BenzingaNewsArticle) {
    return {
      id: article.id,
      title: article.title,
      content: article.body,
      teaser: article.teaser,
      author: article.author,
      published_at: article.created,
      updated_at: article.updated,
      url: article.url,
      source: 'Benzinga',
      image_url: article.image && article.image.length > 0 ? article.image[0].url : undefined,
      tickers: article.stocks?.map(s => s.name) || [],
      channels: article.channels?.map(c => c.name) || [],
      tags: article.tags?.map(t => t.name) || [],
      time: new Date(article.created).getTime(),
    };
  }
}

export default new BenzingaService();

