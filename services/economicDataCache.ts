import { supabase } from '../lib/supabase';
import EconomicCalendarService, { EconomicEvent } from './economicCalendarService';
import EODHDService from './eodhdService';

// אפשרות לנטרל כתיבה ל-cache במסד (למשל כש-RLS חוסם/אין צורך בכתיבה)
const DISABLE_CACHE_WRITES = (process.env.EXPO_PUBLIC_DISABLE_CACHE_WRITES || '').toLowerCase() === 'true';

export interface CachedEconomicEvent {
  id: string;
  event_id: string;
  title: string;
  description?: string;
  country: string;
  currency: string;
  importance: 'high' | 'medium' | 'low';
  event_date: string;
  event_time?: string;
  actual_value?: string;
  forecast_value?: string;
  previous_value?: string;
  category?: string;
  source: string;
  event_type?: string;
  period?: string;
  comparison_type?: 'yoy' | 'qoq' | 'mom';
  unit?: string;
  value_number?: number;
  is_historical: boolean;
  is_upcoming: boolean;
  created_at: string;
  updated_at: string;
  last_fetched_at: string;
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
        .from('economic_data_cache_meta')
        .select('next_update, is_active, error_count')
        .eq('cache_key', cacheKey)
        .single();

      if (error || !data) {
        return false;
      }

      // אם יש יותר מדי שגיאות, נשבית את ה-cache
      if (data.error_count >= this.MAX_ERROR_COUNT) {
        console.log(`⚠️ Cache ${cacheKey} disabled due to too many errors (${data.error_count})`);
        return false;
      }

      // אם ה-cache לא פעיל
      if (!data.is_active) {
        return false;
      }

      // בדיקה אם הגיע הזמן לעדכון
      const nextUpdate = new Date(data.next_update);
      const now = new Date();
      
      return now < nextUpdate;
    } catch (error) {
      console.error('Error checking cache validity:', error);
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
      const nextUpdate = new Date();
      nextUpdate.setHours(nextUpdate.getHours() + this.CACHE_DURATION_HOURS);

      const { error: upsertError } = await supabase
        .from('economic_data_cache_meta')
        .upsert({
          cache_key: cacheKey,
          last_updated: new Date().toISOString(),
          next_update: nextUpdate.toISOString(),
          total_events: totalEvents,
          source,
          country,
          is_active: true,
          error_count: error ? 1 : 0,
          last_error: error || null
        }, {
          onConflict: 'cache_key'
        });

      if (upsertError) {
        // המרה לאזהרה כדי לא לזהם את הטרמינל בשגיאות, הזרימה ממשיכה
        console.warn('Warning: cache metadata not updated (RLS/policy?):', upsertError?.message || upsertError);
      }
    } catch (error) {
      console.warn('Warning: updateCacheMetadata failed:', (error as any)?.message || String(error));
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
        event_id: event.id,
        title: event.title,
        description: event.description,
        country: event.country || 'US',
        currency: event.currency || 'USD',
        importance: event.importance,
        event_date: event.date,
        event_time: event.time || null,
        actual_value: event.actual,
        forecast_value: event.forecast,
        previous_value: event.previous,
        category: event.category,
        source,
        event_type: event.type,
        period: event.period,
        comparison_type: event.comparison,
        unit: event.unit,
        value_number: event.value,
        is_historical: new Date(event.date) < new Date(),
        is_upcoming: new Date(event.date) >= new Date(),
        last_fetched_at: new Date().toISOString()
      }));

      // שימוש ב-upsert כדי למנוע כפילויות
      const { error } = await supabase
        .from('economic_events')
        .upsert(eventsToInsert, {
          onConflict: 'event_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.warn('Warning: events not saved to database (RLS/policy?):', error?.message || error);
        return 0;
      }

      console.log(`✅ Saved ${eventsToInsert.length} events to database from ${source}`);
      return eventsToInsert.length;
    } catch (error) {
      console.warn('Warning: saveEventsToDatabase failed:', (error as any)?.message || String(error));
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
        .from('economic_events')
        .select('*')
        .eq('country', country)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true, nullsFirst: false });

      if (importance && importance !== 'all') {
        query = query.eq('importance', importance);
      }

      if (dateRange) {
        query = query
          .gte('event_date', dateRange.start)
          .lte('event_date', dateRange.end);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading events from cache:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in loadEventsFromCache:', error);
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
        console.log(`📦 Loading from cache: ${cacheKey}`);
        return await this.loadEventsFromCache(country, importance, dateRange);
      }

      console.log(`🔄 Refreshing cache: ${cacheKey}`);
      
      // טעינת נתונים חדשים
      let events: EconomicEvent[] = [];
      let source = 'FRED';

      try {
        // ניסיון טעינה מ-EODHD
        const isEODHDAvailable = await EODHDService.checkApiAvailability();
        if (isEODHDAvailable) {
          console.log('📊 Loading from EODHD API...');
          const eodhdEvents = await EODHDService.getPopularEconomicIndicators();
          events = eodhdEvents.map(event => EODHDService.convertToAppFormat(event));
          source = 'EODHD';
        } else {
          throw new Error('EODHD not available');
        }
      } catch (eodhdError) {
        console.log('⚠️ EODHD failed, falling back to FRED');
        // גיבוי ל-FRED
        events = await EconomicCalendarService.getEconomicEvents();
        source = 'FRED';
      }

      // שמירה במסד הנתונים
      const savedCount = await this.saveEventsToDatabase(events, source);
      
      // עדכון metadata
      await this.updateCacheMetadata(cacheKey, source, country, savedCount);

      // טעינה מ-cache (עם הנתונים החדשים)
      return await this.loadEventsFromCache(country, importance, dateRange);

    } catch (error) {
      console.error('Error in getEconomicEvents:', error);
      
      // עדכון metadata עם שגיאה
      await this.updateCacheMetadata(cacheKey, 'ERROR', country, 0, error.message);
      
      // נסיון טעינה מ-cache ישן
      console.log('📦 Falling back to cached data...');
      return await this.loadEventsFromCache(country, importance, dateRange);
    }
  }

  // טעינת אירועים עבור תאריך ספציפי
  async getEventsForDate(date: string, country: string = 'US'): Promise<CachedEconomicEvent[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_economic_events_by_date', {
          target_date: date,
          target_country: country
        });

      if (error) {
        console.error('Error getting events for date:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getEventsForDate:', error);
      return [];
    }
  }

  // טעינת אירועים עתידיים
  async getUpcomingEvents(daysAhead: number = 30, country: string = 'US'): Promise<CachedEconomicEvent[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_upcoming_economic_events', {
          days_ahead: daysAhead,
          target_country: country
        });

      if (error) {
        console.error('Error getting upcoming events:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUpcomingEvents:', error);
      return [];
    }
  }

  // עדכון מתוזמן של cache
  async scheduledCacheUpdate(): Promise<void> {
    console.log('🔄 Starting scheduled cache update...');
    
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
      
      console.log('✅ Scheduled cache update completed');
    } catch (error) {
      console.error('❌ Scheduled cache update failed:', error);
    }
  }

  // ניקוי cache ישן
  async cleanupOldCache(): Promise<void> {
    try {
      const { data, error } = await supabase
        .rpc('cleanup_old_economic_events');

      if (error) {
        console.error('Error cleaning up old cache:', error);
        return;
      }

      console.log(`🧹 Cleaned up ${data} old events`);
    } catch (error) {
      console.error('Error in cleanupOldCache:', error);
    }
  }

  // המרת CachedEconomicEvent ל-EconomicEvent
  convertToAppFormat(cachedEvent: CachedEconomicEvent): EconomicEvent {
    return {
      id: cachedEvent.event_id,
      title: cachedEvent.title,
      description: cachedEvent.description,
      country: cachedEvent.country,
      currency: cachedEvent.currency,
      importance: cachedEvent.importance,
      date: cachedEvent.event_date,
      time: cachedEvent.event_time || '',
      actual: cachedEvent.actual_value,
      forecast: cachedEvent.forecast_value,
      previous: cachedEvent.previous_value,
      category: cachedEvent.category,
      source: cachedEvent.source,
      type: cachedEvent.event_type,
      period: cachedEvent.period,
      comparison: cachedEvent.comparison_type,
      unit: cachedEvent.unit,
      value: cachedEvent.value_number,
      createdAt: cachedEvent.created_at,
      dateObject: new Date(cachedEvent.event_date)
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
      const { data: totalData } = await supabase
        .from('economic_events')
        .select('id', { count: 'exact' });

      const { data: upcomingData } = await supabase
        .from('economic_events')
        .select('id', { count: 'exact' })
        .eq('is_upcoming', true);

      const { data: historicalData } = await supabase
        .from('economic_events')
        .select('id', { count: 'exact' })
        .eq('is_historical', true);

      const { data: sourcesData } = await supabase
        .from('economic_events')
        .select('source')
        .not('source', 'is', null);

      const { data: lastUpdateData } = await supabase
        .from('economic_data_cache_meta')
        .select('last_updated')
        .order('last_updated', { ascending: false })
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
        lastUpdate: lastUpdateData?.last_updated || 'Never',
        sources
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
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


