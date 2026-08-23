// Earnings Service
// מערכת ניהול דיווחי תוצאות בלבד

import { supabase } from '../lib/supabase';
import { getSymbolsByCategory } from './marketCapFilters';
// majorIndices / filterMajorIndexStocks אינם בשימוש בנתיב לוח הדוחות (getDateWindow).
// getByCategory למטה עדיין מסנן לפי רשימות marketCapFilters — לא נקרא ממסך הלוח.

// רשימת השדות שבאמת מוצגים ב-UI (UI + Bottom Sheet + TradingView chart).
// עדיף על-פני `*` כי חוסך ~40% מגודל ה-payload.
const EARNINGS_SELECT_COLUMNS = [
  'id',
  'code',
  'ticker',
  'company_name',
  'asset_name',
  'report_date',
  'date',
  'before_after_market',
  'currency',
  'actual',
  'estimate',
  'eps_estimate',
  'eps_prior',
  'difference',
  'percent',
  'revenue_actual',
  'revenue_estimate',
  'revenue_estimate_avg',
  'revenue_estimate_year_ago',
  'revenue_surprise',
  'revenue_surprise_percent',
  'period',
  'period_year',
  'importance',
  'earnings_date_time',
  'report_time',
  'exchange',
  'source',
].join(',');

// In-memory cache ברמת המודול — משותף בכל ה-app.
// הגישה החדשה: cache *פר-יום* (במקום קובץ ענק של 10,000 רשומות).
// כל יום נטען ברקע עם השכנים שלו (window) ומתעדכן נקודתית ב-realtime.
interface DateBucket {
  reports: EarningsReport[];
  fetchedAt: number;
}
const dateCache = new Map<string, DateBucket>();
// in-flight fetches לפי rangeKey, כדי שקריאות מקבילות יתאחדו
const inflightFetches = new Map<string, Promise<EarningsReport[]>>();
// cache ישן (בשימוש של getAll לתאימות אחורה) — נשאר עד שנחליף את כל הקריאות
const legacyCache = new Map<string, { data: EarningsReport[]; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 דקות

/** YYYY-MM-DD לפי יום מקומי במכשיר — לא UTC (מונע קפיצה ליום הקודם אחרי חצות בישראל). */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}
function* datesBetween(startStr: string, endStr: string): Generator<string> {
  let cur = startStr;
  while (cur <= endStr) {
    yield cur;
    cur = addDaysStr(cur, 1);
  }
}

// ====================================
// Types
// ====================================

export interface EarningsReport {
  id: string;
  code: string;
  ticker?: string | null;
  company_name?: string | null;
  asset_name?: string | null;
  report_date: string;
  date: string;
  before_after_market: string | null;
  currency: string | null;
  actual: number | null;
  estimate: number | null;
  eps_estimate?: number | string | null;
  difference: number | null;
  percent: number | null;
  // Revenue fields
  revenue_actual?: number | null;
  revenue_estimate_avg?: number | null;
  revenue_estimate?: number | string | null;
  revenue_surprise?: number | null;
  revenue_surprise_percent?: number | null;
  // Additional fields from new API
  period?: string | null;
  period_year?: number | null;
  importance?: number | null;
  earnings_date_time?: string | null; // TIMESTAMP WITH TIME ZONE
  report_time?: string | null; // Before Market, After Market, etc.
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
   * איפוס ה-cache — לשימוש אחרי sync ידני או כשהמשתמש לוחץ pull-to-refresh.
   */
  static clearCache(): void {
    dateCache.clear();
    legacyCache.clear();
    inflightFetches.clear();
  }

  /**
   * מביא רשימת דיווחים לטווח תאריכים מסוים, עם cache פר-יום.
   * - כל יום שכבר נמצא ב-cache (ולא פג תוקפו) נקרא מהזיכרון (0 רשת).
   * - ימים חדשים נמשכים בשליפה אחת (gte/lte) על הטווח שלהם.
   * - שליפות מקבילות לאותו טווח מתאחדות להבטחה אחת.
   *
   * שימוש מומלץ: `EarningsService.getDateWindow(selectedDate, 7, 14)`.
   */
  static async getDateWindow(
    centerDate: Date | string,
    daysBefore: number = 7,
    daysAfter: number = 14
  ): Promise<EarningsReport[]> {
    const centerStr = typeof centerDate === 'string' ? centerDate : toDateStr(centerDate);
    const startStr = addDaysStr(centerStr, -Math.abs(daysBefore));
    const endStr = addDaysStr(centerStr, Math.abs(daysAfter));

    // מה כבר ב-cache ותקף?
    const now = Date.now();
    const missing: string[] = [];
    for (const d of datesBetween(startStr, endStr)) {
      const bucket = dateCache.get(d);
      if (!bucket || (now - bucket.fetchedAt) >= CACHE_TTL_MS) {
        missing.push(d);
      }
    }

    if (missing.length === 0) {
      return this.getReportsFromCache(startStr, endStr);
    }

    // שליפה רציפה אחת על הטווח החסר (אפילו אם יש תאים ב-cache ברווח — עדיף שליפה אחת)
    const fetchStart = missing[0];
    const fetchEnd = missing[missing.length - 1];
    const fetchKey = `win:${fetchStart}..${fetchEnd}`;

    const existing = inflightFetches.get(fetchKey);
    if (existing) {
      await existing;
      return this.getReportsFromCache(startStr, endStr);
    }

    const promise = (async () => {
      const t0 = Date.now();
      const rows = await this.fetchRangePaginated(fetchStart, fetchEnd);
      // קיבוץ לפי יום ושמירה ב-cache (כולל ימים ללא דיווחים, כדי שלא נטעין אותם שוב)
      const byDate = new Map<string, EarningsReport[]>();
      for (const r of rows) {
        const d = r.report_date;
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d)!.push(r);
      }
      for (const d of datesBetween(fetchStart, fetchEnd)) {
        dateCache.set(d, { reports: byDate.get(d) ?? [], fetchedAt: now });
      }
      if (__DEV__) {
        console.log(`[earningsService.getDateWindow] fetched ${rows.length} rows across ${fetchStart}..${fetchEnd} in ${Date.now() - t0}ms`);
      }
      return rows;
    })();

    inflightFetches.set(fetchKey, promise);
    try {
      await promise;
    } finally {
      inflightFetches.delete(fetchKey);
    }

    return this.getReportsFromCache(startStr, endStr);
  }

  /**
   * מחזיר את כל הדיווחים מה-cache לטווח תאריכים (ללא רשת).
   */
  private static getReportsFromCache(startStr: string, endStr: string): EarningsReport[] {
    const out: EarningsReport[] = [];
    for (const d of datesBetween(startStr, endStr)) {
      const bucket = dateCache.get(d);
      if (bucket) out.push(...bucket.reports);
    }
    return out;
  }

  /**
   * עדכון/הוספה של דיווח בודד ב-cache (לשימוש רילטיים).
   * מחזיר true אם ה-cache עודכן (כלומר היום היה טעון), false אחרת.
   */
  static patchReport(report: EarningsReport): boolean {
    const date = report.report_date;
    const bucket = dateCache.get(date);
    if (!bucket) return false; // יום לא טעון — נתעלם
    const idx = bucket.reports.findIndex(r => r.id === report.id);
    if (idx >= 0) bucket.reports[idx] = report;
    else bucket.reports.push(report);
    return true;
  }

  /**
   * הסרת דיווח מה-cache (לשימוש ב-DELETE event).
   */
  static removeReport(id: string, reportDate?: string): boolean {
    if (reportDate) {
      const bucket = dateCache.get(reportDate);
      if (!bucket) return false;
      const next = bucket.reports.filter(r => r.id !== id);
      if (next.length === bucket.reports.length) return false;
      bucket.reports = next;
      return true;
    }
    let removed = false;
    for (const bucket of dateCache.values()) {
      const next = bucket.reports.filter(r => r.id !== id);
      if (next.length !== bucket.reports.length) {
        bucket.reports = next;
        removed = true;
      }
    }
    return removed;
  }

  /**
   * פונקציית עזר פנימית: שליפת range עם pagination אוטומטי (עוקף את מגבלת 1000).
   */
  private static async fetchRangePaginated(startStr: string, endStr: string): Promise<EarningsReport[]> {
    const PAGE_SIZE = 1000;
    const all: EarningsReport[] = [];
    const maxAttempts = 3;
    let page = 0;

    while (true) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let pageData: EarningsReport[] | null = null;
      let lastError: { message?: string } | null = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await supabase
            .from('earnings_calendar')
            .select(EARNINGS_SELECT_COLUMNS)
            .gte('report_date', startStr)
            .lte('report_date', endStr)
            .order('report_date', { ascending: true })
            .order('ticker', { ascending: true })
            .range(from, to);

          if (result.error) {
            lastError = result.error;
            if (attempt < maxAttempts) {
              await new Promise(r => setTimeout(r, 1500));
              continue;
            }
            break;
          }
          pageData = (result.data || []) as unknown as EarningsReport[];
          lastError = null;
          break;
        } catch (err) {
          const isNetworkError = err instanceof Error && String(err.message).includes('Network request failed');
          if (isNetworkError && attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 1500));
          } else {
            throw err;
          }
        }
      }

      if (lastError) {
        console.warn('[earningsService.fetchRangePaginated] page fetch error:', lastError.message);
        break;
      }
      if (!pageData || pageData.length === 0) break;
      all.push(...pageData);
      if (pageData.length < PAGE_SIZE) break;
      page += 1;
      if (page > 10) {
        console.warn('[earningsService.fetchRangePaginated] pagination safety limit hit');
        break;
      }
    }
    return all;
  }

  /**
   * מחזיר את התאריך הקרוב ביותר (>=today) שיש לו דיווחים.
   * שליפה קטנה ומהירה (LIMIT 1) לצרכי auto-jump.
   */
  static async getNextDateWithReports(fromDate: Date | string = new Date()): Promise<string | null> {
    const dateStr = typeof fromDate === 'string' ? fromDate : toDateStr(fromDate);
    try {
      const { data, error } = await supabase
        .from('earnings_calendar')
        .select('report_date')
        .gte('report_date', dateStr)
        .order('report_date', { ascending: true })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.report_date ?? null;
    } catch (error) {
      console.error('[earningsService.getNextDateWithReports] failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * @deprecated השתמש ב-getDateWindow במקום. נשמר לתאימות אחורה למסכים ישנים.
   */
  static async getAll(options: { limit?: number } | number = {}): Promise<EarningsReport[]> {
    // תאימות לאחור: getAll(100) עדיין עובד
    const opts = typeof options === 'number' ? { limit: options } : options;
    const { limit } = opts;
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - 1); // חודש אחורה (במקום 3)
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 3); // 3 חודשים קדימה (במקום 6)

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const rangeKey = `legacy:${startDateStr}..${endDateStr}`;

    // Cache hit — מחזירים מיידית
    const cached = legacyCache.get(rangeKey);
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
      if (__DEV__) console.log(`[earningsService.getAll] cache hit key=${rangeKey} (${cached.data.length} rows)`);
      return cached.data;
    }

    // יש כבר שליפה מקבילה לאותו key — נחזיר אותה הבטחה
    const existingInflight = inflightFetches.get(rangeKey);
    if (existingInflight) {
      if (__DEV__) console.log(`[earningsService.getAll] joining in-flight fetch key=${rangeKey}`);
      return existingInflight;
    }

    const fetchPromise = (async () => {
      const PAGE_SIZE = 1000;
      const maxRows = typeof limit === 'number' && limit > 0 ? limit : Number.POSITIVE_INFINITY;
      const maxAttempts = 3;
      const all: EarningsReport[] = [];
      const queryStartTime = Date.now();
      let page = 0;

      try {
        while (all.length < maxRows) {
          const from = page * PAGE_SIZE;
          const to = Math.min(from + PAGE_SIZE - 1, from + (maxRows - all.length) - 1);

          let pageData: EarningsReport[] | null = null;
          let lastError: { code?: string; message?: string; details?: string } | null = null;

          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              const result = await supabase
                .from('earnings_calendar')
                .select(EARNINGS_SELECT_COLUMNS)
                .gte('report_date', startDateStr)
                .lte('report_date', endDateStr)
                .order('report_date', { ascending: false })
                .order('ticker', { ascending: true })
                .range(from, to);

              if (result.error) {
                lastError = result.error;
                if (attempt < maxAttempts) {
                  await new Promise(r => setTimeout(r, 1500));
                  continue;
                }
                break;
              }
              pageData = (result.data || []) as unknown as EarningsReport[];
              lastError = null;
              break;
            } catch (err) {
              const isNetworkError = err instanceof Error && (
                err.message === 'Network request failed' || String(err.message).includes('Network request failed')
              );
              if (isNetworkError && attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, 1500));
              } else {
                throw err;
              }
            }
          }

          if (lastError) {
            console.warn('[earningsService.getAll] page fetch error:', lastError.message);
            break;
          }

          if (!pageData || pageData.length === 0) break;
          all.push(...pageData);
          if (pageData.length < PAGE_SIZE) break;
          page += 1;
          if (page > 10) {
            console.warn('[earningsService.getAll] pagination safety limit hit');
            break;
          }
        }

        if (__DEV__) {
          console.log(`[earningsService.getAll] range=${rangeKey} rows=${all.length} time=${Date.now() - queryStartTime}ms pages=${page + 1}`);
        }

        legacyCache.set(rangeKey, { data: all, fetchedAt: Date.now() });
        return all;
      } catch (error) {
        console.error('[earningsService.getAll] failed:', error instanceof Error ? error.message : String(error));
        const fallback = legacyCache.get(rangeKey);
        return all.length > 0 ? all : (fallback?.data ?? []);
      } finally {
        inflightFetches.delete(rangeKey);
      }
    })();

    inflightFetches.set(rangeKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * טעינת דיווחי תוצאות עתידיים (מיום מחר ואילך)
   */
  static async getUpcoming(limit: number = 100): Promise<EarningsReport[]> {
    try {
      const allReports = await this.getAll(limit);
      return this.filterUpcoming(allReports);
    } catch (error) {
      console.error('[earningsService.getUpcoming] failed:', error instanceof Error ? error.message : String(error));
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
      console.error('[earningsService.getByDate] failed:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * טעינת דיווח בודד לפי id (לפתיחה מהתראת Push)
   */
  static async getById(id: string): Promise<EarningsReport | null> {
    if (!id?.trim()) return null;
    try {
      const { data, error } = await supabase
        .from('earnings_calendar')
        .select(EARNINGS_SELECT_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (data as EarningsReport) || null;
    } catch (error) {
      console.error('[earningsService.getById] failed:', error instanceof Error ? error.message : String(error));
      return null;
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
      console.error('[earningsService.getBySymbol] failed:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * חיפוש דיווחים לפי טיקר / קוד / שם חברה (אנגלית/עברית).
   * טווח ברירת מחדל: ~שבועיים אחורה עד ~6 חודשים קדימה; ממוין לפי report_date.
   */
  static async searchReports(
    query: string,
    options: { limit?: number; fromDate?: string; toDate?: string } = {},
  ): Promise<EarningsReport[]> {
    const raw = query.trim();
    if (!raw) return [];

    // מנקים סיומת .US ותווים שמפרקים PostgREST or()/ILIKE
    const cleaned = raw
      .replace(/\.US$/i, '')
      .replace(/[%_,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return [];

    const limit = Math.min(Math.max(options.limit ?? 25, 1), 50);
    const today = toDateStr(new Date());
    const fromDate = options.fromDate ?? addDaysStr(today, -14);
    const toDate = options.toDate ?? addDaysStr(today, 180);
    const pattern = `%${cleaned}%`;
    const upper = cleaned.toUpperCase();

    try {
      const { data, error } = await supabase
        .from('earnings_calendar')
        .select(EARNINGS_SELECT_COLUMNS)
        .or(
          [
            `code.ilike.${pattern}`,
            `ticker.ilike.${pattern}`,
            `company_name.ilike.${pattern}`,
            `asset_name.ilike.${pattern}`,
            `ticker.eq.${upper}`,
          ].join(','),
        )
        .gte('report_date', fromDate)
        .lte('report_date', toDate)
        .order('report_date', { ascending: true })
        .limit(limit * 2); // עודף קטן לדדופ לפני limit

      if (error) throw error;

      const rows = (data || []) as unknown as EarningsReport[];
      // דדופ לפי code+report_date — חברה יכולה להופיע כמה פעמים באותו יום ממקורות שונים
      const seen = new Set<string>();
      const unique: EarningsReport[] = [];
      for (const r of rows) {
        const key = `${(r.code || r.ticker || '').toUpperCase()}|${r.report_date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(r);
        if (unique.length >= limit) break;
      }
      return unique;
    } catch (error) {
      console.error('[earningsService.searchReports] failed:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * טעינת דיווחי תוצאות לפי טווח תאריכים (עם pagination כדי לעקוף מגבלת 1000)
   */
  static async getByDateRange(startDate: string, endDate: string): Promise<EarningsReport[]> {
    const PAGE_SIZE = 1000;
    const all: EarningsReport[] = [];
    try {
      for (let page = 0; page < 20; page++) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('earnings_calendar')
          .select('*')
          .gte('report_date', startDate)
          .lte('report_date', endDate)
          .order('report_date', { ascending: true })
          .order('ticker', { ascending: true })
          .range(from, to);

        if (error) throw error;
        const rows = (data || []) as EarningsReport[];
        all.push(...rows);
        if (rows.length < PAGE_SIZE) break;
      }
      return all;
    } catch (error) {
      console.error('[earningsService.getByDateRange] failed:', error instanceof Error ? error.message : String(error));
      return all;
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
      return [];
    }
  }

  /**
   * רענון נתונים (קריאה ל-Edge Function)
   */
  static async refreshData() {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

      
      const response = await fetch(`${supabaseUrl}/functions/v1/daily-earnings-sync-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        }
      });


      if (!response.ok) {
        const errorText = await response.text();
        
        // ניסיון לפרסר את השגיאה כ-JSON
        try {
          const errorJson = JSON.parse(errorText);
          return {
            success: false,
            message: errorJson.error || errorJson.message || `Function error: ${response.status}`,
            error: errorJson
          };
        } catch (parseError) {
          return {
            success: false,
            message: `Function error: ${response.status} - ${errorText}`,
            error: { status: response.status, text: errorText }
          };
        }
      }

      const result = await response.json();

      // אחרי sync מוצלח, הנתונים ב-DB השתנו — מאפסים cache כדי שהשליפה הבאה תהיה טרייה.
      EarningsService.clearCache();

      return {
        success: true,
        message: result.message || 'Refresh completed',
        data: result
      };
    } catch (error) {
      if (error instanceof Error) {
      }
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error refreshing data',
        error: error
      };
    }
  }
}

export default EarningsService;
