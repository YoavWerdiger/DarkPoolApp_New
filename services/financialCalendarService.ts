// Financial Calendar Service
// מערכת ניהול היומן הפיננסי המורחב

import { supabase } from '../lib/supabase';

// ====================================
// Types
// ====================================

export interface EarningsReport {
  id: string;
  code: string;
  report_date: string;
  date: string;
  before_after_market: string | null;
  currency: string | null;
  actual: number | null;
  estimate: number | null;
  difference: number | null;
  percent: number | null;
  source: string;
  created_at?: string;
  updated_at?: string;
}

export interface EarningsTrend {
  id: string;
  code: string;
  name?: string;
  date: string;
  period: string;
  earnings_estimate_avg: number | null;
  earnings_estimate_low: number | null;
  earnings_estimate_high: number | null;
  earnings_estimate_year_ago: number | null;
  earnings_estimate_analysts_count: number | null;
  earnings_estimate_growth: number | null;
  revenue_estimate_avg: number | null;
  revenue_estimate_low: number | null;
  revenue_estimate_high: number | null;
  revenue_estimate_year_ago: number | null;
  revenue_estimate_analysts_count: number | null;
  revenue_estimate_growth: number | null;
  eps_trend_current: number | null;
  eps_trend_7days_ago: number | null;
  eps_trend_30days_ago: number | null;
  eps_trend_60days_ago: number | null;
  eps_trend_90days_ago: number | null;
  eps_revisions_up_last_7days: number | null;
  eps_revisions_up_last_30days: number | null;
  eps_revisions_down_last_30days: number | null;
  growth: number | null;
  source: string;
  created_at?: string;
  updated_at?: string;
}

export interface IPO {
  id: string;
  code: string;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  start_date: string | null;
  filing_date: string | null;
  amended_date: string | null;
  price_from: number;
  price_to: number;
  offer_price: number;
  shares: number;
  deal_type: string;
  source: string;
  created_at?: string;
  updated_at?: string;
}

export interface Split {
  id: string;
  code: string;
  name: string | null;
  exchange: string | null;
  date: string;
  ratio: string;
  numerator: number;
  denominator: number;
  is_reverse: boolean;
  source: string;
  created_at?: string;
  updated_at?: string;
}

export interface Dividend {
  id: string;
  symbol: string;
  date: string;
  source: string;
  created_at?: string;
  updated_at?: string;
}

// ====================================
// Earnings Reports Service
// ====================================

export class EarningsReportsService {
  /**
   * טעינת כל דיווחי התוצאות
   */
  static async getAll(limit: number = 200): Promise<EarningsReport[]> {
    try {
      const { data, error } = await supabase
        .from('earnings_calendar')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching earnings reports:', error);
      return [];
    }
  }

  /**
   * טעינת דיווחי תוצאות עתידיים
   */
  static async getUpcoming(limit: number = 100): Promise<EarningsReport[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('earnings_calendar')
        .select('*')
        .gte('report_date', today)
        .order('report_date', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching upcoming earnings:', error);
      return [];
    }
  }

  /**
   * טעינת דיווחי תוצאות לפי תאריך
   */
  static async getByDate(date: string): Promise<EarningsReport[]> {
    try {
      const { data, error } = await supabase
        .from('earnings_calendar')
        .select('*')
        .eq('report_date', date)
        .order('before_after_market', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching earnings by date:', error);
      return [];
    }
  }

  /**
   * טעינת דיווחי תוצאות לפי סימבול
   */
  static async getBySymbol(code: string): Promise<EarningsReport[]> {
    try {
      const { data, error } = await supabase
        .from('earnings_calendar')
        .select('*')
        .eq('code', code)
        .order('report_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching earnings by symbol:', error);
      return [];
    }
  }

  /**
   * טעינת דיווחי תוצאות לפי טווח תאריכים
   */
  static async getByDateRange(startDate: string, endDate: string): Promise<EarningsReport[]> {
    try {
      const { data, error } = await supabase
        .from('earnings_calendar')
        .select('*')
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .order('report_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching earnings by date range:', error);
      return [];
    }
  }

  /**
   * טעינת דיווחי תוצאות של היום
   */
  static async getToday(): Promise<EarningsReport[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      return await this.getByDate(today);
    } catch (error) {
      console.error('❌ Error fetching today earnings:', error);
      return [];
    }
  }

  /**
   * טעינת דיווחי תוצאות של השבוע
   */
  static async getThisWeek(): Promise<EarningsReport[]> {
    try {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // ראשון
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // שבת

      const startDate = startOfWeek.toISOString().split('T')[0];
      const endDate = endOfWeek.toISOString().split('T')[0];

      return await this.getByDateRange(startDate, endDate);
    } catch (error) {
      console.error('❌ Error fetching this week earnings:', error);
      return [];
    }
  }
}

// ====================================
// Earnings Trends Service
// ====================================

export class EarningsTrendsService {
  /**
   * טעינת כל תחזיות הרווחים
   */
  static async getAll(limit: number = 100): Promise<EarningsTrend[]> {
    try {
      const { data, error } = await supabase
        .from('earnings_trends')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching earnings trends:', error);
      return [];
    }
  }

  /**
   * טעינת תחזיות לפי סימבול
   */
  static async getBySymbol(code: string): Promise<EarningsTrend[]> {
    try {
      const { data, error } = await supabase
        .from('earnings_trends')
        .select('*')
        .eq('code', code)
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching earnings trends by symbol:', error);
      return [];
    }
  }

  /**
   * טעינת תחזיות לפי תקופה (0q, +1q, 0y, +1y)
   */
  static async getByPeriod(period: string): Promise<EarningsTrend[]> {
    try {
      const { data, error } = await supabase
        .from('earnings_trends')
        .select('*')
        .eq('period', period)
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching earnings trends by period:', error);
      return [];
    }
  }
}

// ====================================
// IPOs Service
// ====================================

export class IPOsService {
  /**
   * טעינת כל ההנפקות
   */
  static async getAll(limit: number = 100): Promise<IPO[]> {
    try {
      const { data, error } = await supabase
        .from('ipos_calendar')
        .select('*')
        .order('start_date', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching IPOs:', error);
      return [];
    }
  }

  /**
   * טעינת הנפקות עתידיות בלבד
   */
  static async getUpcoming(): Promise<IPO[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('ipos_calendar')
        .select('*')
        .gte('start_date', today)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching upcoming IPOs:', error);
      return [];
    }
  }

  /**
   * טעינת הנפקות לפי סטטוס
   */
  static async getByStatus(dealType: string): Promise<IPO[]> {
    try {
      const { data, error } = await supabase
        .from('ipos_calendar')
        .select('*')
        .eq('deal_type', dealType)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching IPOs by status:', error);
      return [];
    }
  }
}

// ====================================
// Splits Service
// ====================================

export class SplitsService {
  /**
   * טעינת כל הפיצולים
   */
  static async getAll(limit: number = 100): Promise<Split[]> {
    try {
      const { data, error } = await supabase
        .from('splits_calendar')
        .select('*')
        .order('date', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching splits:', error);
      return [];
    }
  }

  /**
   * טעינת פיצולים עתידיים בלבד
   */
  static async getUpcoming(): Promise<Split[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('splits_calendar')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching upcoming splits:', error);
      return [];
    }
  }

  /**
   * טעינת פיצולים רגילים בלבד
   */
  static async getRegular(): Promise<Split[]> {
    try {
      const { data, error } = await supabase
        .from('splits_calendar')
        .select('*')
        .eq('is_reverse', false)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching regular splits:', error);
      return [];
    }
  }

  /**
   * טעינת פיצולים הפוכים בלבד
   */
  static async getReverse(): Promise<Split[]> {
    try {
      const { data, error } = await supabase
        .from('splits_calendar')
        .select('*')
        .eq('is_reverse', true)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching reverse splits:', error);
      return [];
    }
  }
}

// ====================================
// Dividends Service
// ====================================

export class DividendsService {
  /**
   * טעינת כל הדיבידנדים
   */
  static async getAll(limit: number = 200): Promise<Dividend[]> {
    try {
      const { data, error } = await supabase
        .from('dividends_calendar')
        .select('*')
        .order('date', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching dividends:', error);
      return [];
    }
  }

  /**
   * טעינת דיבידנדים עתידיים בלבד
   */
  static async getUpcoming(): Promise<Dividend[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('dividends_calendar')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching upcoming dividends:', error);
      return [];
    }
  }

  /**
   * טעינת דיבידנדים לפי סימבול
   */
  static async getBySymbol(symbol: string): Promise<Dividend[]> {
    try {
      const { data, error } = await supabase
        .from('dividends_calendar')
        .select('*')
        .eq('symbol', symbol)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching dividends by symbol:', error);
      return [];
    }
  }

  /**
   * טעינת דיבידנדים לפי טווח תאריכים
   */
  static async getByDateRange(startDate: string, endDate: string): Promise<Dividend[]> {
    try {
      const { data, error } = await supabase
        .from('dividends_calendar')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching dividends by date range:', error);
      return [];
    }
  }
}

// ====================================
// All-in-One Service
// ====================================

export class FinancialCalendarService {
  static EarningsReports = EarningsReportsService;
  static EarningsTrends = EarningsTrendsService;
  static IPOs = IPOsService;
  static Splits = SplitsService;
  static Dividends = DividendsService;

  /**
   * טעינת כל הנתונים בבת אחת
   */
  static async loadAll() {
    try {
      const [earnings, trends, ipos, splits, dividends] = await Promise.all([
        EarningsReportsService.getAll(),
        EarningsTrendsService.getAll(),
        IPOsService.getAll(),
        SplitsService.getAll(),
        DividendsService.getAll()
      ]);

      return {
        earnings,
        trends,
        ipos,
        splits,
        dividends,
        totalCount: earnings.length + trends.length + ipos.length + splits.length + dividends.length
      };
    } catch (error) {
      console.error('❌ Error loading all financial calendar data:', error);
      return {
        earnings: [],
        trends: [],
        ipos: [],
        splits: [],
        dividends: [],
        totalCount: 0
      };
    }
  }

  /**
   * רענון כל הנתונים (קריאה ל-Edge Functions)
   */
  static async refreshAll() {
    try {
      const supabaseUrl = 'https://wpmrtczbfcijoocguime.supabase.co';
      const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MjE4MjAsImV4cCI6MjA1MDA5NzgyMH0.JQwC3xJv8zJQwC3xJv8zJQwC3xJv8zJQwC3xJv8zJ';

      const functions = [
        'daily-earnings-sync',
        'daily-earnings-trends',
        'daily-ipos-sync',
        'daily-splits-sync',
        'daily-dividends-sync'
      ];

      const results = await Promise.allSettled(
        functions.map(functionName =>
          fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`
            }
          })
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`✅ Refresh completed: ${successful} successful, ${failed} failed`);

      return {
        success: successful > 0,
        successful,
        failed
      };
    } catch (error) {
      console.error('❌ Error refreshing financial calendar:', error);
      return {
        success: false,
        successful: 0,
        failed: 5
      };
    }
  }
}

export default FinancialCalendarService;


