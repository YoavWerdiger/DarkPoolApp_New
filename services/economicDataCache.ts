import { supabase } from '../lib/supabase';
import EconomicCalendarService, { EconomicEvent } from './economicCalendarService';
import EODHDService from './eodhdService';

// אפשרות לנטרל כתיבה ל-cache במסד (למשל כש-RLS חוסם/אין צורך בכתיבה)
const DISABLE_CACHE_WRITES = (process.env.EXPO_PUBLIC_DISABLE_CACHE_WRITES || '').toLowerCase() === 'true';

export interface CachedEconomicEvent {
  id: string;
  title: string;
  description?: string;
  country: string;
  currency?: string;
  importance: 'high' | 'medium' | 'low';
  date: string;
  time?: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  category?: string;
  source: string;
  period?: string;
  last_updated?: string;
  created_at?: string;
}

export interface CacheMetadata {
  id: string;
  cache_key: string;
  last_updated: string;
  next_update: string;
  total_events: number;
  source: string;
  country: string;
  importance?: string;
  date_range_start?: string;
  date_range_end?: string;
  is_active: boolean;
  error_count: number;
  last_error?: string;
  created_at: string;
}

class EconomicDataCacheService {
  private readonly CACHE_DURATION_HOURS = 6; // עדכון כל 6 שעות
  private readonly CACHE_DURATION_DAYS = 1; // עדכון יומי לנתונים עתידיים
  private readonly MAX_ERROR_COUNT = 3; // מקסימום 3 שגיאות לפני השבתת cache

  // קבלת מפתח cache
  private getCacheKey(country: string = 'US', importance?: string, dateRange?: { start: string; end: string }): string {
    let key = `${country}`;
    if (importance && importance !== 'all') {
      key += `_${importance}`;
    }
    if (dateRange) {
      key += `_${dateRange.start}_${dateRange.end}`;
    }
    return key;
  }

  // בדיקה אם cache עדכני
  private async isCacheValid(cacheKey: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('economic_cache_metadata')
        .select('last_update')
        .eq('id', cacheKey)
        .single();

      if (error || !data) {
        return false;
      }

      // בדיקה אם הגיע הזמן לעדכון (cache תקף ל-6 שעות)
      const lastUpdate = new Date(data.last_update);
      const now = new Date();
      const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      return hoursSinceUpdate < this.CACHE_DURATION_HOURS;
    } catch (error) {
      return false;
    }
  }

  // עדכון metadata של cache
  private async updateCacheMetadata(
    cacheKey: string, 
    source: string, 
    country: string, 
    totalEvents: number,
    error?: string
  ): Promise<void> {
    try {
      if (DISABLE_CACHE_WRITES) {
        // כתיבה למסד מנוטרלת – דילוג שקט
        return;
      }

      const { error: upsertError } = await supabase
        .from('economic_cache_metadata')
        .upsert({
          id: cacheKey,
          source,
          country,
          last_update: new Date().toISOString(),
          total_events: totalEvents
        }, {
          onConflict: 'id'
        });
    } catch (error) {
    }
  }

  // שמירת אירועים במסד הנתונים
  private async saveEventsToDatabase(events: EconomicEvent[], source: string): Promise<number> {
    try {
      if (DISABLE_CACHE_WRITES) {
        // כתיבה למסד מנוטרלת – נחזיר 0 והזרימה תמשיך
        return 0;
      }
      const eventsToInsert = events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        country: event.country || 'US',
        importance: event.importance,
        date: event.date,
        time: event.time || null,
        actual: event.actual,
        forecast: event.forecast,
        previous: event.previous,
        period: event.period,
        source,
        last_updated: new Date().toISOString()
      }));

      // שימוש ב-upsert כדי למנוע כפילויות
      const { error } = await supabase
        .from('economic_events_cache')
        .upsert(eventsToInsert, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) {
        return 0;
      }

      return eventsToInsert.length;
    } catch (error) {
      return 0;
    }
  }

  // טעינת אירועים מ-cache
  private async loadEventsFromCache(
    country: string = 'US',
    importance?: string,
    dateRange?: { start: string; end: string }
  ): Promise<CachedEconomicEvent[]> {
    try {
      let query = supabase
        .from('economic_events_cache')
        .select('*')
        .eq('country', country)
        .order('date', { ascending: true })
        .order('time', { ascending: true, nullsFirst: false });

      if (importance && importance !== 'all') {
        query = query.eq('importance', importance);
      }

      if (dateRange) {
        query = query
          .gte('date', dateRange.start)
          .lte('date', dateRange.end);
      }

      const { data, error } = await query;

      if (error) {
        return [];
      }

      return data || [];
    } catch (error) {
      return [];
    }
  }

  // טעינת אירועים עם cache חכם
  async getEconomicEvents(
    country: string = 'US',
    importance?: string,
    dateRange?: { start: string; end: string },
    forceRefresh: boolean = false
  ): Promise<CachedEconomicEvent[]> {
    const cacheKey = this.getCacheKey(country, importance, dateRange);
    
    try {
      // בדיקה אם cache תקף
      if (!forceRefresh && await this.isCacheValid(cacheKey)) {
        return await this.loadEventsFromCache(country, importance, dateRange);
      }
      
      // טעינת נתונים חדשים - עכשיו מ-Benzinga דרך EODHD Service
      let events: EconomicEvent[] = [];
      let source = 'Benzinga';

      try {
        const eodhdEvents = await EODHDService.getPopularEconomicIndicators();
        events = eodhdEvents.map(event => EODHDService.convertToAppFormat(event));
        source = 'Benzinga';
      } catch (benzingaError) {
        // גיבוי ל-FRED
        try {
          events = await EconomicCalendarService.getEconomicEvents();
          source = 'FRED';
        } catch (fredError) {
          throw fredError;
        }
      }

      // שמירה במסד הנתונים
      const savedCount = await this.saveEventsToDatabase(events, source);
      
      // עדכון metadata
      await this.updateCacheMetadata(cacheKey, source, country, savedCount);

      // טעינה מ-cache (עם הנתונים החדשים)
      return await this.loadEventsFromCache(country, importance, dateRange);

    } catch (error) {
      // עדכון metadata עם שגיאה
      await this.updateCacheMetadata(cacheKey, 'ERROR', country, 0, (error as Error).message);

      // נסיון טעינה מ-cache ישן
      return await this.loadEventsFromCache(country, importance, dateRange);
    }
  }

  // טעינת אירועים עבור תאריך ספציפי
  async getEventsForDate(date: string, country: string = 'US'): Promise<CachedEconomicEvent[]> {
    try {
      const { data, error } = await supabase
        .from('economic_events_cache')
        .select('*')
        .eq('date', date)
        .eq('country', country)
        .order('time', { ascending: true, nullsFirst: false });

      if (error) {
        return [];
      }

      return data || [];
    } catch (error) {
      return [];
    }
  }

  // טעינת אירועים עתידיים
  async getUpcomingEvents(daysAhead: number = 30, country: string = 'US'): Promise<CachedEconomicEvent[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('economic_events_cache')
        .select('*')
        .eq('country', country)
        .gte('date', today)
        .lte('date', futureDate)
        .order('date', { ascending: true })
        .order('time', { ascending: true, nullsFirst: false });

      if (error) {
        return [];
      }

      return data || [];
    } catch (error) {
      return [];
    }
  }

  // עדכון מתוזמן של cache
  async scheduledCacheUpdate(): Promise<void> {
    try {
      // עדכון נתונים עתידיים (30 ימים קדימה)
      const futureDateRange = {
        start: new Date().toISOString().split('T')[0],
        end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };

      await this.getEconomicEvents('US', undefined, futureDateRange, true);
      
      // עדכון נתונים היסטוריים (30 ימים אחורה)
      const historicalDateRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      };

      await this.getEconomicEvents('US', undefined, historicalDateRange, true);
    } catch (error) {
    }
  }

  // ניקוי cache ישן
  async cleanupOldCache(): Promise<void> {
    try {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('economic_events_cache')
        .delete()
        .lt('date', oneYearAgo);

      if (error) {
        return;
      }
    } catch (error) {
    }
  }

  // המרת CachedEconomicEvent ל-EconomicEvent
  convertToAppFormat(cachedEvent: CachedEconomicEvent): EconomicEvent {
    return {
      id: cachedEvent.id,
      title: cachedEvent.title,
      description: cachedEvent.description,
      country: cachedEvent.country,
      currency: cachedEvent.currency || 'USD',
      importance: cachedEvent.importance,
      date: cachedEvent.date,
      time: cachedEvent.time || '',
      actual: cachedEvent.actual,
      forecast: cachedEvent.forecast,
      previous: cachedEvent.previous,
      category: cachedEvent.category,
      source: cachedEvent.source,
      period: cachedEvent.period,
      createdAt: cachedEvent.created_at || '',
      dateObject: new Date(cachedEvent.date)
    };
  }

  // סטטיסטיקות cache
  async getCacheStats(): Promise<{
    totalEvents: number;
    upcomingEvents: number;
    historicalEvents: number;
    lastUpdate: string;
    sources: { [key: string]: number };
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: totalData } = await supabase
        .from('economic_events_cache')
        .select('id', { count: 'exact' });

      const { data: upcomingData } = await supabase
        .from('economic_events_cache')
        .select('id', { count: 'exact' })
        .gte('date', today);

      const { data: historicalData } = await supabase
        .from('economic_events_cache')
        .select('id', { count: 'exact' })
        .lt('date', today);

      const { data: sourcesData } = await supabase
        .from('economic_events_cache')
        .select('source')
        .not('source', 'is', null);

      const { data: lastUpdateData } = await supabase
        .from('economic_cache_metadata')
        .select('last_update')
        .order('last_update', { ascending: false })
        .limit(1)
        .single();

      const sources: { [key: string]: number } = {};
      sourcesData?.forEach(item => {
        sources[item.source] = (sources[item.source] || 0) + 1;
      });

      return {
        totalEvents: totalData?.length || 0,
        upcomingEvents: upcomingData?.length || 0,
        historicalEvents: historicalData?.length || 0,
        lastUpdate: lastUpdateData?.last_update || 'Never',
        sources
      };
    } catch (error) {
      return {
        totalEvents: 0,
        upcomingEvents: 0,
        historicalEvents: 0,
        lastUpdate: 'Error',
        sources: {}
      };
    }
  }
}

export default new EconomicDataCacheService();


