// Fundamentals Service
// שירות לשליפת נתונים פיננסיים מ-EODHD Fundamentals API

import { supabase } from '../lib/supabase';

const EODHD_API_KEY = '68e3c3af900997.85677801';
const EODHD_BASE_URL = 'https://eodhd.com/api';

// ====================================
// Types
// ====================================

export interface QuarterlyFinancials {
  date: string; // YYYY-MM-DD
  revenue: number | null; // Total Revenue
  netIncome: number | null; // Net Income
  eps: number | null; // EPS (Diluted)
  operatingIncome: number | null; // Operating Income
  grossProfit: number | null; // Gross Profit
}

export interface FundamentalsData {
  symbol: string;
  quarterly: QuarterlyFinancials[];
}

// ====================================
// Fundamentals Service
// ====================================

export class FundamentalsService {
  /**
   * שליפת נתונים פיננסיים רבעוניים עבור סימבול
   */
  static async getQuarterlyFinancials(symbol: string): Promise<QuarterlyFinancials[]> {
    try {
      console.log(`📊 Fetching quarterly financials for ${symbol}...`);
      
      const response = await fetch(
        `${EODHD_BASE_URL}/fundamentals/${symbol}?api_token=${EODHD_API_KEY}&fmt=json&filter=Financials::Income_Statement::quarterly`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // המבנה של ה-API: data.Financials.Income_Statement.quarterly
      const quarterlyData = data?.Financials?.Income_Statement?.quarterly || {};
      
      // המרת האובייקט למערך ממוין
      const financials: QuarterlyFinancials[] = Object.entries(quarterlyData)
        .map(([date, values]: [string, any]) => ({
          date,
          revenue: values?.totalRevenue || null,
          netIncome: values?.netIncome || null,
          eps: values?.eps || null,
          operatingIncome: values?.operatingIncome || null,
          grossProfit: values?.grossProfit || null,
        }))
        .sort((a, b) => b.date.localeCompare(a.date)); // מהחדש לישן

      console.log(`✅ Fetched ${financials.length} quarterly records for ${symbol}`);
      return financials;
      
    } catch (error) {
      console.error(`❌ Error fetching fundamentals for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * שליפת נתוני רבעון ספציפי
   */
  static async getQuarterFinancials(
    symbol: string, 
    targetDate: string
  ): Promise<QuarterlyFinancials | null> {
    try {
      const financials = await this.getQuarterlyFinancials(symbol);
      
      // מציאת הרבעון הקרוב ביותר לתאריך
      const closest = financials.find(q => {
        const quarterDate = new Date(q.date);
        const target = new Date(targetDate);
        const diffDays = Math.abs((quarterDate.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays < 100; // בטווח של 100 יום
      });

      return closest || null;
      
    } catch (error) {
      console.error(`❌ Error fetching quarter financials:`, error);
      return null;
    }
  }

  /**
   * שליפת 4 רבעונים אחרונים
   */
  static async getLastFourQuarters(symbol: string): Promise<QuarterlyFinancials[]> {
    try {
      const financials = await this.getQuarterlyFinancials(symbol);
      return financials.slice(0, 4);
    } catch (error) {
      console.error(`❌ Error fetching last four quarters:`, error);
      return [];
    }
  }

  /**
   * חישוב צמיחה YoY (שנה על שנה)
   */
  static calculateYoYGrowth(current: number, previous: number): number | null {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  }

  /**
   * חישוב Surprise (הפתעה)
   */
  static calculateSurprise(actual: number, estimate: number): number | null {
    if (!estimate || estimate === 0) return null;
    return ((actual - estimate) / estimate) * 100;
  }
}

export default FundamentalsService;

