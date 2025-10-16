// Earnings Service
// מערכת ניהול דיווחי תוצאות בלבד

import { supabase } from '../lib/supabase';
import { getSymbolsByCategory } from './marketCapFilters';
import { filterMajorIndexStocks, isMajorIndexStock } from './majorIndices';

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

// ====================================
// Earnings Service
// ====================================

export class EarningsService {
  /**
   * הסרת כפילויות - לוקח את הדיווח העדכני ביותר לכל מניה
   */
  static removeDuplicates(reports: EarningsReport[]): EarningsReport[] {
    const uniqueMap = new Map<string, EarningsReport>();
    
    reports.forEach(report => {
      const key = report.code;
      const existing = uniqueMap.get(key);
      
      if (!existing || new Date(report.report_date) > new Date(existing.report_date)) {
        uniqueMap.set(key, report);
      }
    });
    
    return Array.from(uniqueMap.values()).sort((a, b) => 
      new Date(a.report_date).getTime() - new Date(b.report_date).getTime()
    );
  }

  /**
   * סינון דיווחים לפי תאריך (צד לקוח)
   */
  static filterByDate(reports: EarningsReport[], date: string): EarningsReport[] {
    return reports.filter(report => report.report_date === date);
  }

  /**
   * סינון דיווחים לפי טווח תאריכים (צד לקוח)
   */
  static filterByDateRange(reports: EarningsReport[], startDate: string, endDate: string): EarningsReport[] {
    return reports.filter(report => 
      report.report_date >= startDate && report.report_date <= endDate
    );
  }

  /**
   * סינון דיווחים עתידיים (צד לקוח)
   */
  static filterUpcoming(reports: EarningsReport[]): EarningsReport[] {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    return reports.filter(report => report.report_date >= tomorrowStr);
  }

  /**
   * סינון דיווחים לשבוע המסחר הנוכחי (צד לקוח)
   */
  static filterThisWeek(reports: EarningsReport[]): EarningsReport[] {
    const today = new Date();
    
    // חישוב יום שני של השבוע הנוכחי
    const startOfWeek = new Date(today);
    const dayOfWeek = today.getDay(); // 0=ראשון, 1=שני, ..., 6=שבת
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(today.getDate() - daysToMonday);
    
    // חישוב יום שישי של השבוע הנוכחי
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4);

    const startDate = startOfWeek.toISOString().split('T')[0];
    const endDate = endOfWeek.toISOString().split('T')[0];

    return this.filterByDateRange(reports, startDate, endDate);
  }

  /**
   * סינון דיווחים לשבוע המסחר הבא (צד לקוח)
   */
  static filterNextWeek(reports: EarningsReport[]): EarningsReport[] {
    const today = new Date();
    
    // חישוב יום שני של השבוע הנוכחי
    const startOfWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(today.getDate() - daysToMonday);
    
    // חישוב יום שני של השבוע הבא
    const startOfNextWeek = new Date(startOfWeek);
    startOfNextWeek.setDate(startOfWeek.getDate() + 7);
    
    // חישוב יום שישי של השבוע הבא
    const endOfNextWeek = new Date(startOfNextWeek);
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 4);

    const startDate = startOfNextWeek.toISOString().split('T')[0];
    const endDate = endOfNextWeek.toISOString().split('T')[0];

    return this.filterByDateRange(reports, startDate, endDate);
  }

  /**
   * טעינת כל דיווחי התוצאות מהמסד נתונים (טווח: 08/10/2025 - 03/10/2026)
   */
  static async getAll(limit: number = 2000): Promise<EarningsReport[]> {
    try {
      // טווח מדויק כמו ב-Edge Function
      const startDateStr = '2025-10-08';
      
      const { data, error } = await supabase
        .from('earnings_calendar')
        .select('*')
        .like('code', '%.US') // רק מניירות אמריקאיות
        .gte('report_date', startDateStr) // מ-08/10/2025
        .order('report_date', { ascending: true }) // מהישן לחדש
        .limit(limit);

      if (error) throw error;
      
      // סינון למניות מהאינדקסים הגדולים בלבד
      const majorIndexReports = filterMajorIndexStocks(data || []);
      console.log(`📊 Filtered to major indices: ${majorIndexReports.length}/${(data || []).length} reports (from ${startDateStr})`);
      
      return majorIndexReports;
    } catch (error) {
      console.error('❌ Error fetching earnings reports:', error);
      return [];
    }
  }

  /**
   * טעינת דיווחי תוצאות עתידיים (מיום מחר ואילך)
   */
  static async getUpcoming(limit: number = 100): Promise<EarningsReport[]> {
    try {
      const allReports = await this.getAll(limit);
      return this.filterUpcoming(allReports);
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
      const allReports = await this.getAll();
      return this.filterByDate(allReports, date);
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
        .like('code', '%.US') // רק מניירות אמריקאיות
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
   * טעינת דיווחי תוצאות של שבוע המסחר הנוכחי (שני-שישי)
   */
  static async getThisWeek(): Promise<EarningsReport[]> {
    try {
      const allReports = await this.getAll();
      return this.filterThisWeek(allReports);
    } catch (error) {
      console.error('❌ Error fetching this week earnings:', error);
      return [];
    }
  }

  /**
   * טעינת דיווחי תוצאות של שבוע המסחר הבא (שני-שישי)
   */
  static async getNextWeek(): Promise<EarningsReport[]> {
    try {
      const allReports = await this.getAll();
      return this.filterNextWeek(allReports);
    } catch (error) {
      console.error('❌ Error fetching next week earnings:', error);
      return [];
    }
  }

  /**
   * טעינת דיווחי תוצאות לפי קטגוריית Market Cap
   */
  static async getByCategory(
    category: 'large' | 'mid' | 'small' | 'growth' | 'value' | 'tech',
    limit: number = 100
  ): Promise<EarningsReport[]> {
    try {
      const symbols = getSymbolsByCategory(category);
      const symbolsString = symbols.join(',');
      
      const { data, error } = await supabase
        .from('earnings_calendar')
        .select('*')
        .in('code', symbols)
        .order('report_date', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching earnings by category:', error);
      return [];
    }
  }

  /**
   * טעינת דיווחי תוצאות עתידיים לפי קטגוריה
   */
  static async getUpcomingByCategory(
    category: 'large' | 'mid' | 'small' | 'growth' | 'value' | 'tech',
    limit: number = 50
  ): Promise<EarningsReport[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const symbols = getSymbolsByCategory(category);
      
      const { data, error } = await supabase
        .from('earnings_calendar')
        .select('*')
        .in('code', symbols)
        .gte('report_date', today)
        .order('report_date', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching upcoming earnings by category:', error);
      return [];
    }
  }

  /**
   * רענון נתונים (קריאה ל-Edge Function)
   */
  static async refreshData() {
    try {
      const supabaseUrl = 'https://wpmrtczbfcijoocguime.supabase.co';
      const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MjE4MjAsImV4cCI6MjA1MDA5NzgyMH0.JQwC3xJv8zJQwC3xJv8zJQwC3xJv8zJQwC3xJv8zJ';

      console.log('🔄 Calling refresh function...');
      
      const response = await fetch(`${supabaseUrl}/functions/v1/daily-earnings-sync-major-indices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        }
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Function error:', errorText);
        throw new Error(`Function error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ Refresh completed:`, result);

      return {
        success: true,
        message: result.message || 'Refresh completed',
        data: result
      };
    } catch (error) {
      console.error('❌ Error refreshing earnings data:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error refreshing data',
        error: error
      };
    }
  }
}

export default EarningsService;
