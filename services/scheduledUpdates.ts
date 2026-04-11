import { supabase } from '../lib/supabase';
import EconomicDataCacheService from './economicDataCache';

class ScheduledUpdatesService {
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000; // כל 6 שעות
  private readonly CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // כל 24 שעות
  private cleanupInterval: NodeJS.Timeout | null = null;

  // התחלת עדכונים מתוזמנים
  startScheduledUpdates(): void {
    
    // עדכון ראשוני
    this.performUpdate();
    
    // עדכון כל 6 שעות
    this.updateInterval = setInterval(() => {
      this.performUpdate();
    }, this.UPDATE_INTERVAL_MS);

    // ניקוי כל 24 שעות
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL_MS);

  }

  // עצירת עדכונים מתוזמנים
  stopScheduledUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
  }

  // ביצוע עדכון
  private async performUpdate(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // עדכון נתונים עתידיים (30 ימים קדימה)
      await EconomicDataCacheService.getEconomicEvents(
        'US', 
        undefined, 
        {
          start: new Date().toISOString().split('T')[0],
          end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        true // force refresh
      );

      // עדכון נתונים היסטוריים (7 ימים אחורה)
      await EconomicDataCacheService.getEconomicEvents(
        'US',
        undefined,
        {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        },
        true // force refresh
      );

      const duration = Date.now() - startTime;
      // לוג בלבד – ללא webhook

    } catch (error) {
      
      // לוג שגיאה – ללא webhook
    }
  }

  // ביצוע ניקוי
  private async performCleanup(): Promise<void> {
    
    try {
      await EconomicDataCacheService.cleanupOldCache();
    } catch (error) {
    }
  }

  // בוטל: תמיכה ב-webhook הוסרה. נשארו רק לוגים.

  // עדכון ידני
  async manualUpdate(): Promise<{ success: boolean; message: string }> {
    try {
      await this.performUpdate();
      return { success: true, message: 'Update completed successfully' };
    } catch (error) {
      return { success: false, message: `Update failed: ${(error as any)?.message || String(error)}` };
    }
  }

  // קבלת סטטוס עדכונים
  async getUpdateStatus(): Promise<{
    isRunning: boolean;
    lastUpdate: string;
    nextUpdate: string;
    stats: any;
  }> {
    try {
      const stats = await EconomicDataCacheService.getCacheStats();
      
      const { data: lastUpdateData } = await supabase
        .from('economic_data_cache_meta')
        .select('last_updated, next_update')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      return {
        isRunning: this.updateInterval !== null,
        lastUpdate: lastUpdateData?.last_updated || 'Never',
        nextUpdate: lastUpdateData?.next_update || 'Unknown',
        stats
      };
    } catch (error) {
      return {
        isRunning: false,
        lastUpdate: 'Error',
        nextUpdate: 'Error',
        stats: {}
      };
    }
  }

  // עדכון cache עבור תאריך ספציפי
  async updateForDate(date: string): Promise<{ success: boolean; message: string }> {
    try {
      
      await EconomicDataCacheService.getEconomicEvents(
        'US',
        undefined,
        { start: date, end: date },
        true
      );

      return { success: true, message: `Cache updated for ${date}` };
    } catch (error) {
      return { success: false, message: `Failed to update for ${date}: ${(error as any)?.message || String(error)}` };
    }
  }

  // עדכון cache עבור מדד ספציפי
  async updateForIndicator(indicator: string): Promise<{ success: boolean; message: string }> {
    try {
      
      // עדכון עבור 30 ימים קדימה
      await EconomicDataCacheService.getEconomicEvents(
        'US',
        'all',
        {
          start: new Date().toISOString().split('T')[0],
          end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        true
      );

      return { success: true, message: `Cache updated for ${indicator}` };
    } catch (error) {
      return { success: false, message: `Failed to update for ${indicator}: ${error.message}` };
    }
  }
}

export default new ScheduledUpdatesService();


