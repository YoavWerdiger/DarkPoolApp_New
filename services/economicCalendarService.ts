// EconomicCalendarService.ts - גרסה נקייה ומהירה
import { supabase } from '../lib/supabase';

const FRED_API_KEY = process.env.EXPO_PUBLIC_FRED_API_KEY ?? '';
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

// EOD Historical Data API לאירועים עתידיים
const EOD_API_KEY = process.env.EXPO_PUBLIC_EODHD_API_KEY ?? '';
const EOD_ECONOMIC_EVENTS_API = 'https://eodhd.com/api/economic-events';

// Trading Economics API לנתונים כלכליים
const TRADING_ECONOMICS_API_KEY = process.env.EXPO_PUBLIC_TRADING_ECONOMICS_API_KEY || '';
const TRADING_ECONOMICS_API = 'https://api.tradingeconomics.com/calendar';

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
  source?: string;
  isRead?: boolean;
  createdAt?: string;
  dateObject?: Date;
  // שדות חדשים עבור EODHD
  type?: string;
  period?: string;
  comparison?: 'yoy' | 'qoq' | 'mom';
  unit?: string;
  // שדות נוספים עבור מדדים מאקרו
  value?: number;
  indicator?: string;
}

export interface UnreadEventData {
  eventId: string;
  userId: string;
  readAt: string;
}

export class EconomicCalendarService {
  // קבלת נתונים כלכליים אמיתיים מ-FRED API (Federal Reserve Economic Data)
  static async getFREDEconomicData(): Promise<EconomicEvent[]> {
    try {
      
      // מדדים ראשיים + משניים למילוי ימים ריקים - סה"כ ~50 מדדים
      const fredSeries = [
        // 🏛️ FOMC Rate Decision
        { id: 'FEDFUNDS', name: 'FOMC Rate Decision - ריבית פדרל ריזרב', category: 'מדיניות מוניטרית', importance: 'high' },
        
        // 📊 Inflation (CPI, PPI, PCE) - הכי חשוב
        { id: 'CPIAUCSL', name: 'CPI Headline - מדד המחירים לצרכן', category: 'אינפלציה', importance: 'high' },
        { id: 'CPILFESL', name: 'CPI Core - CPI ליבה', category: 'אינפלציה', importance: 'high' },
        { id: 'PPIFIS', name: 'PPI - מדד מחירי יצרן', category: 'אינפלציה', importance: 'high' },
        { id: 'PCEPI', name: 'PCE Price Index - מדד PCE', category: 'אינפלציה', importance: 'high' },
        { id: 'PCEPILFE', name: 'PCE Core - PCE ליבה', category: 'אינפלציה', importance: 'high' },
        
        // 💼 Employment - הכי חשוב
        { id: 'PAYEMS', name: 'NFP - תעסוקה לא-חקלאית', category: 'תעסוקה', importance: 'high' },
        { id: 'UNRATE', name: 'Unemployment Rate - שיעור אבטלה', category: 'תעסוקה', importance: 'high' },
        { id: 'ICSA', name: 'Initial Jobless Claims - תביעות אבטלה', category: 'תעסוקה', importance: 'high' },
        { id: 'JTSJOL', name: 'JOLTS Job Openings - משרות פנויות', category: 'תעסוקה', importance: 'high' },
        { id: 'AHETPI', name: 'Average Hourly Earnings - שכר לשעה', category: 'תעסוקה', importance: 'high' },
        
        // 📈 GDP
        { id: 'GDPC1', name: 'GDP - תמ"ג ריאלי', category: 'צמיחה כלכלית', importance: 'high' },
        
        // 🛒 Consumer
        { id: 'RSAFS', name: 'Retail Sales - מכירות קמעונאיות', category: 'צריכה', importance: 'high' },
        { id: 'UMCSENT', name: 'Consumer Confidence - אמון צרכנים', category: 'צריכה', importance: 'high' },
        
        // 🏠 Housing - Case-Shiller
        { id: 'CSUSHPISA', name: 'Case-Shiller Home Price Index - מדד מחירי בתים', category: 'נדל"ן', importance: 'high' },
        
        // 🏗️ Durable Goods
        { id: 'DGORDER', name: 'Durable Goods Orders - הזמנות סחורות מתינות', category: 'תעשייה', importance: 'high' },
        
        // 🏠 Housing
        { id: 'HOUST', name: 'Housing Starts - התחלות בנייה', category: 'נדל"ן', importance: 'high' },
        { id: 'PERMIT', name: 'Building Permits - רישיונות בנייה', category: 'נדל"ן', importance: 'high' },
        
        // 📊 Treasury Yields (רק 10Y - הכי חשוב)
        { id: 'GS10', name: 'Treasury 10Y - אג"ח 10 שנים', category: 'מדיניות מוניטרית', importance: 'high' },
        { id: 'T10Y2Y', name: 'Yield Curve 10Y-2Y - עקום תשואות', category: 'מדיניות מוניטרית', importance: 'high' },
        
        // 📊 מדדים משניים למילוי ימים (חשיבות בינונית)
        // Industrial Production - תעשייה
        { id: 'INDPRO', name: 'Industrial Production - ייצור תעשייתי', category: 'תעשייה', importance: 'medium' },
        { id: 'CAPUTL', name: 'Capacity Utilization - ניצול קיבולת', category: 'תעשייה', importance: 'medium' },
        
        // More Employment
        { id: 'CIVPART', name: 'Labor Force Participation - השתתפות בכוח העבודה', category: 'תעסוקה', importance: 'medium' },
        { id: 'EMRATIO', name: 'Employment-Population Ratio - יחס תעסוקה', category: 'תעסוקה', importance: 'medium' },
        { id: 'CCSA', name: 'Continuing Claims - תביעות אבטלה מתמשכות', category: 'תעסוקה', importance: 'medium' },
        
        // Consumer Spending
        { id: 'PCE', name: 'Personal Consumption - צריכה אישית', category: 'צריכה', importance: 'medium' },
        { id: 'PSAVERT', name: 'Personal Saving Rate - שיעור חיסכון', category: 'צריכה', importance: 'medium' },
        { id: 'RRSFS', name: 'Retail Sales Ex Auto - מכירות ללא רכב', category: 'צריכה', importance: 'medium' },
        
        // Business Investment
        { id: 'NEWORDER', name: 'New Orders - הזמנות חדשות', category: 'תעשייה', importance: 'medium' },
        { id: 'BUSINV', name: 'Business Inventories - מלאי עסקים', category: 'תעשייה', importance: 'medium' },
        
        // Housing Secondary
        { id: 'EXHOSLUSM495S', name: 'Existing Home Sales - מכירות בתים קיימים', category: 'נדל"ן', importance: 'medium' },
        { id: 'MSPUS', name: 'Median Sales Price - מחיר בתים חציוני', category: 'נדל"ן', importance: 'medium' },
        
        // Money Supply & Credit
        { id: 'M2SL', name: 'M2 Money Supply - היצע כסף M2', category: 'מדיניות מוניטרית', importance: 'medium' },
        { id: 'TOTCI', name: 'Commercial & Industrial Loans - הלוואות עסקיות', category: 'מדיניות מוניטרית', importance: 'medium' },
        
        // International Trade
        { id: 'BOPGSTB', name: 'Trade Balance - מאזן סחר', category: 'סחר חוץ', importance: 'medium' },
        { id: 'EXPGS', name: 'Exports - יצוא', category: 'סחר חוץ', importance: 'medium' },
        { id: 'IMPGS', name: 'Imports - יבוא', category: 'סחר חוץ', importance: 'medium' },
        
        
        // Economic Indicators
        { id: 'CCLACBW027SBOG', name: 'Bank Credit - אשראי בנקאי', category: 'מדיניות מוניטרית', importance: 'medium' },
        { id: 'DEXUSEU', name: 'USD/EUR Exchange Rate - שער דולר/יורו', category: 'מטבעות', importance: 'medium' },
        
        // Weekly Data (more frequent updates)
        { id: 'WALCL', name: 'Fed Balance Sheet - מאזן הפדרל ריזרב', category: 'מדיניות מוניטרית', importance: 'medium' },
        { id: 'WTREGEN', name: 'Weekly Economic Index - מדד כלכלי שבועי', category: 'צמיחה כלכלית', importance: 'medium' },
        
        // Consumer Price Sub-indices (monthly updates)
        { id: 'CUSR0000SEHE', name: 'CPI Energy - מדד מחירי אנרגיה', category: 'אינפלציה', importance: 'low' },
        { id: 'CUSR0000SAF1', name: 'CPI Food - מדד מחירי מזון', category: 'אינפלציה', importance: 'low' },
        
        // Additional Important Indicators
        { id: 'T10Y3M', name: '3-Month Treasury Bill Rate - אג"ח 3 חודשים', category: 'מדיניות מוניטרית', importance: 'high' },
        { id: 'GS2', name: 'Treasury 2Y - אג"ח 2 שנים', category: 'מדיניות מוניטרית', importance: 'high' },
        { id: 'GS30', name: 'Treasury 30Y - אג"ח 30 שנים', category: 'מדיניות מוניטרית', importance: 'high' },
        { id: 'VIXCLS', name: 'VIX - מדד תנודתיות', category: 'שוקי הון', importance: 'high' },
        { id: 'DGS10', name: '10-Year Treasury Rate - ריבית אג"ח 10 שנים', category: 'מדיניות מוניטרית', importance: 'high' },
        { id: 'DEXUSEU', name: 'USD/EUR Exchange Rate - שער דולר/יורו', category: 'מטבעות', importance: 'medium' },
        { id: 'DEXJPUS', name: 'USD/JPY Exchange Rate - שער דולר/ין', category: 'מטבעות', importance: 'medium' },
        { id: 'DEXUSUK', name: 'USD/GBP Exchange Rate - שער דולר/לירה', category: 'מטבעות', importance: 'medium' }
      ];
      
      const events: EconomicEvent[] = [];
      
      // טווח תאריכים רחב יותר - שנה שלמה לקבלת יותר נתונים
      const today = new Date();
      const startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 6); // 6 חודשים לפני
      
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 6); // 6 חודשים אחרי
      
      const endDateStr = endDate.toISOString().split('T')[0];
      const startDateStr = startDate.toISOString().split('T')[0];
      

      // שליפה מקבילה של כל הסדרות יחד - הרבה יותר מהיר!
      
      const promises = fredSeries.map(async (series) => {
        try {
          
          const url = `${FRED_BASE_URL}/series/observations?series_id=${series.id}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDateStr}&observation_end=${endDateStr}&sort_order=desc&limit=100`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
            if (response.status === 400) {
              const errorData = await response.json();
            }
            return [];
          }
          
          const data = await response.json();
          
          
          const seriesEvents: EconomicEvent[] = [];
          
          if (data && data.observations && data.observations.length > 0) {
            // יצירת אירועים מכל התצפיות - עד 50 נתונים לכל סדרה
            for (let i = 0; i < Math.min(data.observations.length, 50); i++) {
              const current = data.observations[i];
              const previous = i < data.observations.length - 1 ? data.observations[i + 1] : null;
              
              // דילוג על נתונים ריקים
              if (!current.value || current.value === '.') continue;
              
              // דילוג רק על תאריכים לא הגיוניים (יותר מדי רחוק בעתיד)
              const currentDate = new Date(current.date);
              const maxFutureDate = new Date(endDate);
              maxFutureDate.setMonth(maxFutureDate.getMonth() + 6); // מקסימום 6 חודשים קדימה
              
              if (currentDate > maxFutureDate) {
                continue;
              }
              
              // חישוב שינוי אם יש נתון קודם
              const change = previous && current.value !== '.' && previous.value !== '.' 
                ? (parseFloat(current.value) - parseFloat(previous.value)).toFixed(2)
                : '';
              
              // שימוש בתאריך מ-FRED בלבד - ללא שעות מלאכותיות
              seriesEvents.push({
                id: `fred_${series.id}_${current.date}`,
                title: `📊 ${series.name}`,
        country: 'ארצות הברית',
        currency: 'USD',
                importance: series.importance as 'high' | 'medium' | 'low',
                date: current.date, // תאריך מ-FRED כמו שהוא
                time: '', // ללא שעה מלאכותית - נשתמש בנתוני API בלבד
                actual: current.value,
        forecast: '',
                previous: (previous && previous.value !== '.') ? previous.value : '',
                description: `${series.name}: ${current.value}. ${change ? `שינוי מהנתון הקודם: ${change}` : ''}`,
                category: series.category,
                impact: series.importance as 'high' | 'medium' | 'low',
                source: 'FRED - Federal Reserve',
                createdAt: new Date().toISOString(),
                dateObject: new Date(current.date)
              });
            }
          }
          
          return seriesEvents;
          
    } catch (error) {
      return [];
    }
      });
      
      // המתנה לכל הקריאות במקביל
      const results = await Promise.all(promises);
      
      // איחוד כל התוצאות
      results.forEach(seriesEvents => {
        events.push(...seriesEvents);
      });
      

      // הוספת אירועים עתידיים מ-Economic Calendar API
      try {
        const futureEvents = await this.getFutureEconomicEvents();
        events.push(...futureEvents);
      } catch (error) {
      }

      // הוספת תאריכי פרסום אמיתיים מ-FRED Release Calendar
      try {
        const releaseDates = await this.getFREDReleaseDates();
        events.push(...releaseDates);
      } catch (error) {
      }

      // הוספת נתונים כלכליים מ-Trading Economics (רק אם מוגדר מפתח אמיתי)
      if (TRADING_ECONOMICS_API_KEY && TRADING_ECONOMICS_API_KEY.toLowerCase() !== 'demo') {
        try {
          const tradingEconomicsData = await this.getTradingEconomicsData();
          events.push(...tradingEconomicsData);
        } catch (error) {
        }
      } else {
      }

      return events;
      
    } catch (error) {
      return [];
    }
  }

  // שליפת תאריכי פרסום אמיתיים מ-FRED Release Calendar API
  static async getFREDReleaseDates(): Promise<EconomicEvent[]> {
    try {
      
      const releaseEvents: EconomicEvent[] = [];
      
      // מדדים חשובים עם release IDs מ-FRED
      const releases = [
        { id: 10, name: 'Consumer Price Index', category: 'אינפלציה', importance: 'high', emoji: '📊' },
        { id: 50, name: 'Employment Situation', category: 'תעסוקה', importance: 'high', emoji: '💼' },
        { id: 53, name: 'Gross Domestic Product', category: 'צמיחה כלכלית', importance: 'high', emoji: '📈' },
        { id: 54, name: 'Personal Income and Outlays', category: 'צריכה', importance: 'high', emoji: '💰' },
        { id: 25, name: 'New Residential Construction', category: 'נדל"ן', importance: 'high', emoji: '🏠' },
        { id: 144, name: 'Advance Monthly Sales for Retail Trade', category: 'צריכה', importance: 'high', emoji: '🛒' },
        { id: 15, name: 'Producer Price Index', category: 'אינפלציה', importance: 'high', emoji: '🏭' },
        { id: 51, name: 'Job Openings and Labor Turnover Survey', category: 'תעוקה', importance: 'high', emoji: '💼' }
      ];

    const today = new Date();
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 2); // 2 חודשים קדימה

      const todayStr = today.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // שליפת כל תאריכי הפרסום העתידיים (לא לפי release מסוים)
      try {
        
        const url = `${FRED_BASE_URL}/releases/dates?api_key=${FRED_API_KEY}&file_type=json&realtime_start=${todayStr}&realtime_end=${endDateStr}&limit=1000&sort_order=asc`;
        
          
          const response = await fetch(url);
          
          if (!response.ok) {
          const errorText = await response.text();
          return [];
          }
          
          const data = await response.json();
        
        
        if (data && data.release_dates && data.release_dates.length > 0) {
          // מיפוי שמות פרסומים חשובים
          const importantReleases = new Set([
            'Consumer Price Index',
            'Employment Situation', 
            'Producer Price Index',
            'Gross Domestic Product',
            'Personal Income and Outlays',
            'New Residential Construction',
            'Advance Monthly Sales for Retail Trade',
            'Industrial Production and Capacity Utilization',
            'Consumer Credit',
            'Federal Reserve Balance Sheet'
          ]);
          
          for (const releaseDate of data.release_dates) {
            // רק אירועים חשובים
            if (importantReleases.has(releaseDate.release_name)) {
              const releaseDateTime = new Date(releaseDate.date + 'T15:30:00');
              
              releaseEvents.push({
                id: `fred_release_${releaseDate.release_id}_${releaseDate.date}`,
                title: `📊 ${this.translateReleaseName(releaseDate.release_name)}`,
                country: 'ארצות הברית',
                currency: 'USD',
                importance: this.getImportanceByRelease(releaseDate.release_name),
                date: releaseDate.date,
                time: '15:30',
                actual: '',
                forecast: 'צפוי לפרסום',
                previous: '',
                description: `תאריך פרסום רשמי מ-FRED: ${this.translateReleaseName(releaseDate.release_name)}`,
                category: this.getCategoryByRelease(releaseDate.release_name),
                source: 'FRED Release Calendar',
                dateObject: releaseDateTime
              });
            }
          }
        }
        
      } catch (error) {
      }

      return releaseEvents;
      
    } catch (error) {
      return [];
    }
  }

  // תרגום שמות דו"חות לעברית
  static translateReleaseName(name: string): string {
    const translations: { [key: string]: string } = {
      'Consumer Price Index': 'מדד המחירים לצרכן (CPI)',
      'Employment Situation': 'דו"ח תעסוקה (NFP)',
      'Gross Domestic Product': 'תוצר מקומי גולמי (GDP)',
      'Personal Income and Outlays': 'הכנסה אישית והוצאות (PCE)',
      'New Residential Construction': 'בנייה מגורים חדשה',
      'Advance Monthly Sales for Retail Trade': 'מכירות קמעונאיות',
      'Producer Price Index': 'מדד המחירים ליצרנים (PPI)',
      'Industrial Production and Capacity Utilization': 'ייצור תעשייתי וניצולת',
      'Consumer Credit': 'אשראי צרכני',
      'Federal Reserve Balance Sheet': 'מאזן הפדרל ריזרב'
    };
    
    return translations[name] || name;
  }

  // קביעת חשיבות לפי סוג הפרסום
  static getImportanceByRelease(name: string): 'high' | 'medium' | 'low' {
    const highImportance = [
      'Consumer Price Index',
      'Employment Situation', 
      'Producer Price Index',
      'Gross Domestic Product',
      'Personal Income and Outlays'
    ];
    
    const mediumImportance = [
      'New Residential Construction',
      'Advance Monthly Sales for Retail Trade',
      'Industrial Production and Capacity Utilization'
    ];
    
    if (highImportance.includes(name)) return 'high';
    if (mediumImportance.includes(name)) return 'medium';
    return 'low';
  }

  // קביעת קטגוריה לפי סוג הפרסום
  static getCategoryByRelease(name: string): string {
    const categories: { [key: string]: string } = {
      'Consumer Price Index': 'אינפלציה',
      'Employment Situation': 'תעסוקה',
      'Producer Price Index': 'אינפלציה',
      'Gross Domestic Product': 'צמיחה כלכלית',
      'Personal Income and Outlays': 'צריכה',
      'New Residential Construction': 'נדל"ן',
      'Advance Monthly Sales for Retail Trade': 'צריכה',
      'Industrial Production and Capacity Utilization': 'ייצור',
      'Consumer Credit': 'אשראי',
      'Federal Reserve Balance Sheet': 'מדיניות מוניטרית'
    };
    
    return categories[name] || 'כלכלה כללית';
  }

  // שליפת נתונים כלכליים מ-Trading Economics API
  static async getTradingEconomicsData(): Promise<EconomicEvent[]> {
    try {
      
      const tradingEvents: EconomicEvent[] = [];
      
      // תאריכים - 3 חודשים קדימה
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setMonth(futureDate.getMonth() + 3);
      
      const todayStr = today.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      // שליפה מ-Trading Economics Calendar API
      const url = `${TRADING_ECONOMICS_API}?c=${TRADING_ECONOMICS_API_KEY}&d1=${todayStr}&d2=${futureDateStr}&importance=1,2,3&country=united states&format=json`;
      
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 400) {
          const errorData = await response.text();
        }
        return [];
      }
      
      const data = await response.json();
      
      
      if (data && Array.isArray(data)) {
        data.forEach((event: any) => {
          // מיפוי נתונים מ-Trading Economics לפורמט שלנו
          const eventDate = new Date(event.Date);
          if (eventDate > today) {
            tradingEvents.push({
              id: `trading_${event.Country}_${event.Date}_${event.Event}`,
              title: `📊 ${event.Event}`,
              country: event.Country === 'United States' ? 'ארצות הברית' : event.Country,
              currency: event.Country === 'United States' ? 'USD' : '',
              importance: this.mapTradingEconomicsImportance(event.Importance),
              date: event.Date.split('T')[0], // רק התאריך ללא השעה
              time: event.Date.includes('T') ? event.Date.split('T')[1].substring(0, 5) : '00:00',
              actual: event.Actual?.toString() || '',
              forecast: event.Forecast?.toString() || 'צפוי לפרסום',
              previous: event.Previous?.toString() || '',
              description: `${event.Event} - ${event.Category || 'אירוע כלכלי'}`,
              category: this.mapTradingEconomicsCategory(event.Event, event.Category),
              impact: this.mapTradingEconomicsImportance(event.Importance),
              source: 'Trading Economics',
              createdAt: new Date().toISOString(),
              dateObject: eventDate
            });
          }
        });
      }
      
      return tradingEvents;
      
    } catch (error) {
      return [];
    }
  }

  // מיפוי חשיבות Trading Economics
  static mapTradingEconomicsImportance(importance: string | number): 'high' | 'medium' | 'low' {
    if (!importance) return 'medium';
    
    const imp = importance.toString().toLowerCase();
    
    if (imp.includes('high') || imp === '3' || imp === 'red') return 'high';
    if (imp.includes('medium') || imp === '2' || imp === 'orange' || imp === 'yellow') return 'medium';
    if (imp.includes('low') || imp === '1' || imp === 'green') return 'low';
    
    return 'medium';
  }

  // מיפוי קטגוריה Trading Economics
  static mapTradingEconomicsCategory(eventName: string, category?: string): string {
    if (!eventName) return 'כללי';
    
    const name = eventName.toLowerCase();
    const cat = category?.toLowerCase() || '';
    
    if (name.includes('cpi') || name.includes('ppi') || name.includes('pce') || name.includes('inflation') || name.includes('price index') || cat.includes('inflation')) return 'אינפלציה';
    if (name.includes('nfp') || name.includes('employment') || name.includes('unemployment') || name.includes('jobs') || name.includes('payroll') || name.includes('jolts') || name.includes('job openings') || name.includes('jobless claims') || cat.includes('employment')) return 'תעסוקה';
    if (name.includes('gdp') || name.includes('gross domestic product') || name.includes('growth') || cat.includes('gdp')) return 'צמיחה כלכלית';
    if (name.includes('retail') || name.includes('sales') || name.includes('consumer') || name.includes('spending') || cat.includes('retail')) return 'צריכה';
    if (name.includes('housing') || name.includes('construction') || name.includes('building') || name.includes('home') || name.includes('case-shiller') || name.includes('home price index') || cat.includes('housing')) return 'נדל"ן';
    if (name.includes('manufacturing') || name.includes('industrial') || name.includes('production') || name.includes('ism') || name.includes('pmi') || cat.includes('manufacturing')) return 'ייצור';
    if (name.includes('fomc') || name.includes('fed') || name.includes('interest') || name.includes('rate') || name.includes('monetary') || cat.includes('monetary')) return 'מדיניות מוניטרית';
    if (name.includes('trade') || name.includes('export') || name.includes('import') || name.includes('balance') || cat.includes('trade')) return 'סחר חוץ';
    if (name.includes('durable') || name.includes('goods') || name.includes('orders')) return 'ייצור';
    if (name.includes('confidence') || name.includes('sentiment')) return 'צריכה';
    
    return 'כללי';
  }


  // פונקציות עזר ישנות - לא נחוצות יותר
  // יצירת אירועי ISM PMI (יום עסקים ראשון בחודש)
  static generateISMPMIEvents(): EconomicEvent[] {
    const ismEvents: EconomicEvent[] = [];
    const today = new Date();
    
    // יצירת אירועי ISM PMI לחודשים הבאים
    for (let i = 0; i <= 6; i++) {
      const targetMonth = new Date(today);
      targetMonth.setMonth(targetMonth.getMonth() + i);
      
      // מציאת יום העסקים הראשון של החודש
      const firstDayOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      
      // אם יום ראשון הוא סוף שבוע, מעבירים ליום העסקים הבא
      while (firstDayOfMonth.getDay() === 0 || firstDayOfMonth.getDay() === 6) {
        firstDayOfMonth.setDate(firstDayOfMonth.getDate() + 1);
      }
      
      const dateStr = firstDayOfMonth.toISOString().split('T')[0];
      
      // ISM Manufacturing PMI (יום עסקים ראשון)
      if (firstDayOfMonth > today) {
        ismEvents.push({
          id: `ism_manufacturing_${dateStr}`,
          title: '🏭 ISM Manufacturing PMI - מדד PMI תעשייתי',
        country: 'ארצות הברית',
        currency: 'USD',
          importance: 'high' as const,
          date: dateStr,
          time: '17:00',
        actual: '',
          forecast: 'צפוי לפרסום',
          previous: '',
          description: 'מדד מנהלי הרכש התעשייתי - מדד מוביל לכלכלה',
        category: 'תעשייה',
          source: 'ISM',
          dateObject: new Date(dateStr + 'T17:00:00')
        });
      }
      
      // ISM Services PMI (3 ימי עסקים אחרי Manufacturing)
      const servicesDate = new Date(firstDayOfMonth);
      servicesDate.setDate(servicesDate.getDate() + 3);
      
      // וידוא שזה יום עסקים
      while (servicesDate.getDay() === 0 || servicesDate.getDay() === 6) {
        servicesDate.setDate(servicesDate.getDate() + 1);
      }
      
      const servicesDateStr = servicesDate.toISOString().split('T')[0];
      
      if (servicesDate > today) {
        ismEvents.push({
          id: `ism_services_${servicesDateStr}`,
          title: '🏢 ISM Services PMI - מדד PMI שירותים',
        country: 'ארצות הברית',
        currency: 'USD',
          importance: 'high' as const,
          date: servicesDateStr,
          time: '17:00',
        actual: '',
          forecast: 'צפוי לפרסום',
        previous: '',
          description: 'מדד מנהלי הרכש בשירותים - 70% מהכלכלה האמריקנית',
          category: 'שירותים',
          source: 'ISM',
          dateObject: new Date(servicesDateStr + 'T17:00:00')
        });
      }
    }
    
    return ismEvents;
  }

  // יצירת אירועים עתידיים חשובים נוספים
  static generateKeyUpcomingEvents(): EconomicEvent[] {
    const keyEvents: EconomicEvent[] = [];
    const today = new Date();
    
    // CPI - ב-10 לכל חודש (יום עסקים)
    for (let i = 0; i <= 3; i++) {
      const targetDate = new Date(today);
      targetDate.setMonth(targetDate.getMonth() + i);
      targetDate.setDate(10);
      
      // וידוא שזה יום עסקים
      while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      
      if (targetDate > today) {
        const dateStr = targetDate.toISOString().split('T')[0];
        keyEvents.push({
          id: `upcoming_cpi_${dateStr}`,
          title: '📊 CPI Release - פרסום מדד המחירים לצרכן',
      country: 'ארצות הברית',
      currency: 'USD',
          importance: 'high' as const,
          date: dateStr,
          time: '15:30',
          actual: '',
          forecast: 'צפוי לפרסום',
          previous: '',
          description: 'פרסום מדד המחירים לצרכן - נתון קריטי לאינפלציה',
          category: 'אינפלציה',
          source: 'Bureau of Labor Statistics',
          dateObject: new Date(dateStr + 'T15:30:00')
        });
      }
    }

    // NFP - שישי הראשון של כל חודש
    for (let i = 0; i <= 3; i++) {
      const targetDate = new Date(today);
      targetDate.setMonth(targetDate.getMonth() + i);
      targetDate.setDate(1);
      
      // מציאת השישי הראשון
      while (targetDate.getDay() !== 5) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      
      if (targetDate > today) {
        const dateStr = targetDate.toISOString().split('T')[0];
        keyEvents.push({
          id: `upcoming_nfp_${dateStr}`,
          title: '💼 NFP Release - פרסום נתוני תעסוקה',
        country: 'ארצות הברית',
        currency: 'USD',
          importance: 'high' as const,
          date: dateStr,
          time: '15:30',
        actual: '',
          forecast: 'צפוי לפרסום',
        previous: '',
          description: 'פרסום נתוני התעסוקה הלא-חקלאית - נתון קריטי לשוק העבודה',
          category: 'תעסוקה',
          source: 'Bureau of Labor Statistics',
          dateObject: new Date(dateStr + 'T15:30:00')
        });
      }
    }

    return keyEvents;
  }

  // יצירת תאריך פרסום ריאלי (לא רק תחילת החודש)
  static getRealisticPublishDate(dataDate: string, seriesId: string): string {
    const date = new Date(dataDate);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-based
    
    // תאריכי פרסום ריאליים לפי סוג הנתון
    const publishDates: { [key: string]: number } = {
      // Employment data - שישי הראשון של החודש הבא
      'PAYEMS': 4, // NFP - 4 לחודש הבא
      'UNRATE': 4, // Unemployment - 4 לחודש הבא
      'AHETPI': 4, // Hourly Earnings - 4 לחודש הבא
      
      // Inflation data - אמצע החודש הבא
      'CPIAUCSL': 12, // CPI - 12 לחודש הבא
      'CPILFESL': 12, // CPI Core - 12 לחודש הבא
      'PPIFIS': 14, // PPI - 14 לחודש הבא
      'PCEPI': 26, // PCE - 26 לחודש הבא
      'PCEPILFE': 26, // PCE Core - 26 לחודש הבא
      
      // Retail & Consumer - אמצע החודש הבא
      'RSAFS': 15, // Retail Sales - 15 לחודש הבא
      'UMCSENT': 28, // Consumer Confidence - סוף החודש
      
      // Housing - אמצע החודש הבא
      'HOUST': 17, // Housing Starts - 17 לחודש הבא
      'PERMIT': 17, // Building Permits - 17 לחודש הבא
      
      // Durable Goods - סוף החודש הבא
      'DGORDER': 24, // Durable Goods - 24 לחודש הבא
      
      // GDP - רבעון אחרי
      'GDPC1': 28, // GDP - 28 לחודש הרבעון
      
      // FOMC - תאריכי ישיבות ספציפיים
      'FEDFUNDS': 18, // FOMC - 18 בחודש (ממוצע)
      
      // Treasury - יומי, נשאיר כמו שזה
      'GS2': 1,
      'GS10': 1, 
      'GS30': 1,
      'T10Y2Y': 1,
      
      // Weekly data - שבועי
      'ICSA': 5 // Initial Claims - כל חמישי
    };
    
    const publishDay = publishDates[seriesId] || 15; // default 15th
    
    // חישוב חודש הפרסום (בדרך כלל החודש הבא)
    let publishMonth = month + 1;
    let publishYear = year;
    
    if (publishMonth > 11) {
      publishMonth = 0;
      publishYear += 1;
    }
    
    // יצירת תאריך הפרסום
    const publishDate = new Date(publishYear, publishMonth, publishDay);
    
    // וידוא שהתאריך לא עתידי מדי
    const today = new Date();
    if (publishDate > today) {
      // אם התאריך עתידי, נחזיר את התאריך המקורי
      return dataDate;
    }
    
    return publishDate.toISOString().split('T')[0];
  }

  // קבלת שעת פרסום אמיתית לפי סדרה
  // שליפת אירועים עתידיים מ-EOD Economic Events API
  static async getFutureEconomicEvents(): Promise<EconomicEvent[]> {
    try {
      
      // תאריכים עתידיים - 3 חודשים קדימה
    const today = new Date();
      const futureDate = new Date(today);
      futureDate.setMonth(futureDate.getMonth() + 3);
      
      const todayStr = today.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      // שליפה מ-EOD Economic Events API - הendpoint הנכון!
      const economicEventsUrl = `${EOD_ECONOMIC_EVENTS_API}?api_token=${EOD_API_KEY}&from=${todayStr}&to=${futureDateStr}&country=US&fmt=json`;
      
      
      const response = await fetch(economicEventsUrl);
      
      if (!response.ok) {
        if (response.status === 400) {
          const errorData = await response.text();
        }
        // אין נפילה ל-mock
        return [];
      }
      
      const data = await response.json();
      const futureEvents: EconomicEvent[] = [];
      
      
      if (data && Array.isArray(data)) {
        data.forEach((event: any) => {
          // וידוא שזה אירוע עתידי
          const eventDate = new Date(event.date);
          if (eventDate > today) {
            futureEvents.push({
              id: `eod_${event.country}_${event.date}_${event.period}`,
              title: `📊 ${event.type || 'Economic Event'}`,
              country: event.country === 'US' ? 'ארצות הברית' : event.country,
              currency: event.country === 'US' ? 'USD' : '',
              importance: this.mapEODEventImportance(event.type),
              date: event.date,
              time: '00:00', // EOD API doesn't provide explicit times
              actual: event.actual?.toString() || '',
              forecast: event.estimate?.toString() || 'צפוי לפרסום',
              previous: event.previous?.toString() || '',
              description: `${event.type} (${event.comparison}) - תקופה: ${event.period}`,
              category: this.mapEODEventCategory(event.type),
              impact: this.mapEODEventImportance(event.type),
              source: 'EODHD Economic Events',
              createdAt: new Date().toISOString(),
              dateObject: new Date(event.date)
            });
          }
        });
      }
      
      
      // אם לא נמצאו אירועים עתידיים, לא נחזיר mock
      if (futureEvents.length === 0) {
        return [];
      }
      
      return futureEvents;
      
    } catch (error) {
      // אין נפילה ל-mock
      return [];
    }
  }

  // אירועים עתידיים בסיסיים (גיבוי אם ה-API לא עובד)
  static getBasicFutureEvents(): EconomicEvent[] {
    
    const today = new Date();
    const futureEvents: EconomicEvent[] = [];
    
    // יצירת אירועים עתידיים ריאליסטיים לשבועיים הקרובים
    for (let i = 1; i <= 14; i++) {
      const eventDate = new Date(today);
      eventDate.setDate(today.getDate() + i);
      const dateStr = eventDate.toISOString().split('T')[0];
      
      // אירועים קבועים שידועים מראש
      const dayOfWeek = eventDate.getDay();
      
      // אירועים יומיים
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // ימי חול
        // תביעות אבטלה - כל יום חמישי
        if (dayOfWeek === 4) {
          futureEvents.push({
            id: `future_claims_${dateStr}`,
            title: '📊 Initial Jobless Claims - תביעות אבטלה ראשוניות',
            country: 'ארצות הברית',
            currency: 'USD',
            importance: 'high',
            date: dateStr,
            time: '13:30',
            forecast: '220K',
            previous: '220K',
            description: 'מדד תביעות האבטלה הראשוניות - אינדיקטור חשוב למצב שוק העבודה',
            category: 'תעסוקה',
            impact: 'בינוני',
            source: 'Department of Labor',
            isRead: false,
            createdAt: new Date().toISOString(),
            dateObject: eventDate
          });
        }
        
        // מדדי אינפלציה - בדרך כלל ב-13-15 לחודש
        if (eventDate.getDate() >= 13 && eventDate.getDate() <= 15) {
          futureEvents.push({
            id: `future_cpi_${dateStr}`,
            title: '📊 CPI - מדד המחירים לצרכן',
            country: 'ארצות הברית',
            currency: 'USD',
            importance: 'high',
            date: dateStr,
            time: '13:30',
            forecast: '0.3%',
            previous: '0.2%',
            description: 'מדד המחירים לצרכן - האינדיקטור החשוב ביותר לאינפלציה',
            category: 'אינפלציה',
            impact: 'גבוה',
            source: 'Bureau of Labor Statistics',
            isRead: false,
            createdAt: new Date().toISOString(),
            dateObject: eventDate
          });
        }
        
        // NFP - בדרך כלל ביום שישי הראשון של החודש
        if (dayOfWeek === 5 && eventDate.getDate() <= 7) {
          futureEvents.push({
            id: `future_nfp_${dateStr}`,
            title: '📊 NFP - תעסוקה לא-חקלאית',
            country: 'ארצות הברית',
            currency: 'USD',
            importance: 'high',
            date: dateStr,
            time: '13:30',
            forecast: '180K',
            previous: '175K',
            description: 'מדד התעסוקה הלא-חקלאית - האינדיקטור החשוב ביותר למצב הכלכלה',
            category: 'תעסוקה',
            impact: 'גבוה',
            source: 'Bureau of Labor Statistics',
            isRead: false,
            createdAt: new Date().toISOString(),
            dateObject: eventDate
          });
        }
        
        // FOMC - בדרך כלל ב-15-16 לחודש
        if (eventDate.getDate() >= 15 && eventDate.getDate() <= 16) {
          futureEvents.push({
            id: `future_fomc_${dateStr}`,
            title: '🏛️ FOMC Rate Decision - החלטת ריבית',
            country: 'ארצות הברית',
            currency: 'USD',
            importance: 'high',
            date: dateStr,
            time: '19:00',
            forecast: '5.25%',
            previous: '5.25%',
            description: 'החלטת הריבית של הפדרל ריזרב - האירוע הכלכלי החשוב ביותר',
            category: 'מדיניות מוניטרית',
            impact: 'גבוה',
            source: 'Federal Reserve',
            isRead: false,
            createdAt: new Date().toISOString(),
            dateObject: eventDate
          });
        }
      }
    }
    
    return futureEvents;
  }

  // מיפוי חשיבות
  static mapImportance(importance: string): 'high' | 'medium' | 'low' {
    if (!importance) return 'medium';
    const imp = importance.toLowerCase();
    if (imp.includes('high') || imp.includes('3')) return 'high';
    if (imp.includes('low') || imp.includes('1')) return 'low';
    return 'medium';
  }

  // מיפוי קטגוריה
  static mapCategory(eventName: string): string {
    if (!eventName) return 'כללי';
    const name = eventName.toLowerCase();
    
    if (name.includes('cpi') || name.includes('inflation') || name.includes('ppi')) return 'אינפלציה';
    if (name.includes('employment') || name.includes('nfp') || name.includes('unemployment') || name.includes('jobs')) return 'תעסוקה';
    if (name.includes('gdp') || name.includes('growth')) return 'צמיחה כלכלית';
    if (name.includes('retail') || name.includes('consumer') || name.includes('spending')) return 'צריכה';
    if (name.includes('housing') || name.includes('construction')) return 'נדל"ן';
    if (name.includes('fed') || name.includes('fomc') || name.includes('rate')) return 'מדיניות מוניטרית';
    if (name.includes('trade') || name.includes('export') || name.includes('import')) return 'סחר חוץ';
    
    return 'כללי';
  }

  // מיפוי חשיבות EOD לפורמט שלנו
  static mapEODImportance(impact: string | number): 'high' | 'medium' | 'low' {
    if (!impact) return 'medium';
    
    const impactStr = impact.toString().toLowerCase();
    
    if (impactStr.includes('high') || impactStr === '3' || impactStr === 'red') return 'high';
    if (impactStr.includes('medium') || impactStr === '2' || impactStr === 'orange' || impactStr === 'yellow') return 'medium';
    if (impactStr.includes('low') || impactStr === '1' || impactStr === 'green') return 'low';
    
    return 'medium';
  }

  // מיפוי קטגוריה EOD לפורמט שלנו
  static mapEODCategory(eventName: string): string {
    if (!eventName) return 'כללי';
    
    const name = eventName.toLowerCase();
    
    if (name.includes('cpi') || name.includes('ppi') || name.includes('pce') || name.includes('inflation') || name.includes('price')) return 'אינפלציה';
    if (name.includes('nfp') || name.includes('employment') || name.includes('unemployment') || name.includes('jobs') || name.includes('payroll')) return 'תעסוקה';
    if (name.includes('gdp') || name.includes('growth') || name.includes('economic growth')) return 'צמיחה כלכלית';
    if (name.includes('retail') || name.includes('sales') || name.includes('consumer') || name.includes('spending')) return 'צריכה';
    if (name.includes('housing') || name.includes('construction') || name.includes('building') || name.includes('home')) return 'נדל"ן';
    if (name.includes('manufacturing') || name.includes('industrial') || name.includes('production') || name.includes('ism') || name.includes('pmi')) return 'ייצור';
    if (name.includes('fomc') || name.includes('fed') || name.includes('interest') || name.includes('rate') || name.includes('monetary')) return 'מדיניות מוניטרית';
    if (name.includes('trade') || name.includes('export') || name.includes('import') || name.includes('balance')) return 'סחר חוץ';
    if (name.includes('durable') || name.includes('goods') || name.includes('orders')) return 'ייצור';
    if (name.includes('confidence') || name.includes('sentiment')) return 'צריכה';
    
    return 'כללי';
  }

  // מיפוי חשיבות לפי סוג אירוע EOD Economic Events
  static mapEODEventImportance(eventType: string): 'high' | 'medium' | 'low' {
    if (!eventType) return 'medium';
    
    const type = eventType.toLowerCase();
    
    // אירועים בחשיבות גבוהה
    if (type.includes('cpi') || type.includes('consumer price index')) return 'high';
    if (type.includes('nfp') || type.includes('nonfarm payroll') || type.includes('employment')) return 'high';
    if (type.includes('gdp') || type.includes('gross domestic product')) return 'high';
    if (type.includes('fomc') || type.includes('federal funds rate') || type.includes('interest rate')) return 'high';
    if (type.includes('ppi') || type.includes('producer price index')) return 'high';
    if (type.includes('unemployment rate')) return 'high';
    if (type.includes('jolts') || type.includes('job openings')) return 'high';
    if (type.includes('initial jobless claims') || type.includes('jobless claims')) return 'high';
    if (type.includes('retail sales')) return 'high';
    if (type.includes('case-shiller') || type.includes('home price index')) return 'high';
    
    // אירועים בחשיבות בינונית
    if (type.includes('industrial production')) return 'medium';
    if (type.includes('housing') || type.includes('building permits') || type.includes('housing starts')) return 'medium';
    if (type.includes('consumer confidence') || type.includes('consumer sentiment')) return 'medium';
    if (type.includes('durable goods') || type.includes('manufacturing')) return 'medium';
    if (type.includes('trade balance') || type.includes('imports') || type.includes('exports')) return 'medium';
    if (type.includes('pmi') || type.includes('ism')) return 'medium';
    
    return 'low';
  }

  // מיפוי קטגוריה לפי סוג אירוע EOD Economic Events
  static mapEODEventCategory(eventType: string): string {
    if (!eventType) return 'כללי';
    
    const type = eventType.toLowerCase();
    
    if (type.includes('cpi') || type.includes('ppi') || type.includes('pce') || type.includes('inflation') || type.includes('price index')) return 'אינפלציה';
    if (type.includes('nfp') || type.includes('employment') || type.includes('unemployment') || type.includes('jobs') || type.includes('payroll') || type.includes('jolts') || type.includes('job openings') || type.includes('jobless claims')) return 'תעסוקה';
    if (type.includes('gdp') || type.includes('gross domestic product') || type.includes('growth')) return 'צמיחה כלכלית';
    if (type.includes('retail') || type.includes('sales') || type.includes('consumer') || type.includes('spending')) return 'צריכה';
    if (type.includes('housing') || type.includes('construction') || type.includes('building') || type.includes('home') || type.includes('case-shiller') || type.includes('home price index')) return 'נדל"ן';
    if (type.includes('manufacturing') || type.includes('industrial') || type.includes('production') || type.includes('ism') || type.includes('pmi')) return 'ייצור';
    if (type.includes('fomc') || type.includes('fed') || type.includes('interest') || type.includes('rate') || type.includes('monetary')) return 'מדיניות מוניטרית';
    if (type.includes('trade') || type.includes('export') || type.includes('import') || type.includes('balance')) return 'סחר חוץ';
    if (type.includes('durable') || type.includes('goods') || type.includes('orders')) return 'ייצור';
    if (type.includes('confidence') || type.includes('sentiment')) return 'צריכה';
    
    return 'כללי';
  }

  // פונקציה ראשית לקבלת אירועים כלכליים - FRED + אירועים עתידיים
  static async getEconomicEvents(): Promise<EconomicEvent[]> {
    try {
      
      // שליפה מקבילה: נתונים היסטוריים מ-FRED + אירועים עתידיים
      const [fredData, futureData] = await Promise.allSettled([
        this.getFREDEconomicData(),     // נתונים היסטוריים מ-FRED
        this.getFutureEconomicEvents()  // אירועים עתידיים מ-API חיצוני + גיבוי
      ]);
      
      // איחוד הנתונים
      let allEvents: EconomicEvent[] = [];
      
      // הוספת נתוני FRED
      if (fredData.status === 'fulfilled') {
        allEvents.push(...fredData.value);
      } else {
      }
      
      // הוספת אירועים עתידיים
      if (futureData.status === 'fulfilled') {
        allEvents.push(...futureData.value);
      } else {
      }
      
      
      // סידור כרונולוגי לפי תאריך (הישנים ביותר ראשון - לניווט הגיוני)
      const sortedEvents = allEvents.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });
      
      return sortedEvents;
      
    } catch (error) {
      return [];
    }
  }

  // ניהול אירועים שנקראו
  static async markEventAsRead(eventId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_read_events')
        .upsert({
          event_id: eventId,
          user_id: userId,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  static async getUnreadEventsCount(userId: string): Promise<number> {
    try {
      const events = await this.getEconomicEvents();
      const { data: readEvents, error } = await supabase
        .from('user_read_events')
        .select('event_id')
        .eq('user_id', userId);

      if (error) {
        return events.length;
      }

      const readEventIds = readEvents?.map(item => item.event_id) || [];
      return events.filter(event => !readEventIds.includes(event.id)).length;
    } catch (error) {
      return 0;
    }
  }

  static async getUserReadEvents(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('user_read_events')
        .select('event_id')
        .eq('user_id', userId);
      
      if (error) {
        return [];
      }
      
      return data?.map(item => item.event_id) || [];
    } catch (error) {
      return [];
    }
  }
}

export default EconomicCalendarService;
