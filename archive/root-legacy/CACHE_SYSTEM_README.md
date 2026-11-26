# מערכת Cache חכמה לנתונים כלכליים - מדריך שימוש

## סקירה כללית

המערכת שודרגה עם מערכת cache חכמה שמאחסנת נתונים כלכליים במסד הנתונים ומעדכנת אותם באופן מתוזמן. זה חוסך קריאות API מיותרות ומשפר משמעותית את הביצועים.

## ארכיטקטורה

### 🗄️ מסד נתונים
- **`economic_events`** - טבלת אירועים כלכליים
- **`economic_data_cache_meta`** - מטא-דאטה של cache
- **`economic_webhook_events`** - אירועי webhook

### 🔄 שירותים
- **`EconomicDataCacheService`** - ניהול cache
- **`ScheduledUpdatesService`** - עדכונים מתוזמנים
- **`economic-webhook`** - webhook endpoint

## תכונות עיקריות

### 📦 Cache חכם
- **אחסון במסד נתונים** - כל הנתונים נשמרים ב-Supabase
- **עדכון אוטומטי** - כל 6 שעות
- **ניקוי אוטומטי** - נתונים ישנים נמחקים
- **Fallback חכם** - אם API לא זמין, חוזר ל-cache ישן

### ⏰ עדכונים מתוזמנים
- **עדכון כל 6 שעות** - נתונים עתידיים והיסטוריים
- **ניקוי כל 24 שעות** - הסרת נתונים ישנים
- **עדכון ידני** - אפשרות לעדכן לפי דרישה
- **ניהול שגיאות** - השבתת cache אחרי 3 שגיאות

### 🌐 Webhook Support
- **עדכונים בזמן אמת** - webhook endpoint
- **ניהול אירועים** - רישום כל הפעולות
- **סטטיסטיקות** - מעקב אחר ביצועים

## שימוש במערכת

### 1. הגדרת מסד נתונים

הרץ את הסקריפט הבא ב-Supabase:

```sql
-- הרץ את create_economic_events_table.sql
\i create_economic_events_table.sql
```

### 2. אתחול אוטומטי

המערכת מתחילה אוטומטית כשהמשתמש נכנס:

```typescript
// ב-App.tsx
useEffect(() => {
  if (user && !isLoading) {
    ScheduledUpdatesService.startScheduledUpdates();
  }
}, [user, isLoading]);
```

### 3. שימוש ב-EconomicCalendarTab

```typescript
// טעינה מ-cache (מומלץ)
const events = await EconomicDataCacheService.getEconomicEvents(
  'US', // מדינה
  'high', // חשיבות
  { start: '2024-01-01', end: '2024-12-31' } // טווח תאריכים
);

// המרה לפורמט האפליקציה
const appEvents = events.map(event => 
  EconomicDataCacheService.convertToAppFormat(event)
);
```

### 4. עדכון ידני

```typescript
// עדכון כללי
const result = await ScheduledUpdatesService.manualUpdate();

// עדכון לתאריך ספציפי
const result = await ScheduledUpdatesService.updateForDate('2024-01-15');

// עדכון למדד ספציפי
const result = await ScheduledUpdatesService.updateForIndicator('CPI');
```

### 5. סטטיסטיקות

```typescript
// סטטיסטיקות cache
const stats = await EconomicDataCacheService.getCacheStats();
console.log('Total events:', stats.totalEvents);
console.log('Upcoming events:', stats.upcomingEvents);
console.log('Last update:', stats.lastUpdate);

// סטטוס עדכונים
const status = await ScheduledUpdatesService.getUpdateStatus();
console.log('Is running:', status.isRunning);
console.log('Next update:', status.nextUpdate);
```

## API Endpoints

### Webhook Endpoints

#### POST `/economic-webhook/webhook`
```json
{
  "event_type": "CACHE_REFRESHED",
  "event_data": {
    "duration_ms": 1500,
    "timestamp": "2024-01-15T10:30:00Z",
    "events_updated": "multiple"
  },
  "source": "scheduled"
}
```

#### POST `/economic-webhook/trigger-update`
```json
{
  "update_type": "manual",
  "date": "2024-01-15",
  "indicator": "CPI"
}
```

#### GET `/economic-webhook/status`
```json
{
  "status": "active",
  "last_update": "2024-01-15T10:30:00Z",
  "next_update": "2024-01-15T16:30:00Z",
  "total_events": 1250,
  "upcoming_events": 45,
  "cache_active": true,
  "error_count": 0
}
```

#### GET `/economic-webhook/stats`
```json
{
  "sources": {
    "FRED": 800,
    "EODHD": 450
  },
  "importance": {
    "high": 300,
    "medium": 600,
    "low": 350
  },
  "recent_webhooks": [...]
}
```

## פונקציות מסד נתונים

### `get_economic_events_by_date(date, country, importance)`
```sql
SELECT * FROM get_economic_events_by_date('2024-01-15', 'US', 'high');
```

### `get_upcoming_economic_events(days_ahead, country, importance)`
```sql
SELECT * FROM get_upcoming_economic_events(30, 'US', 'high');
```

### `cleanup_old_economic_events()`
```sql
SELECT cleanup_old_economic_events();
```

## ניהול שגיאות

### שגיאות API
- **403 Forbidden** - API key לא תקף
- **401 Unauthorized** - הרשאות לא מספיקות
- **Rate Limiting** - יותר מדי בקשות

### טיפול בשגיאות
```typescript
try {
  const events = await EconomicDataCacheService.getEconomicEvents();
} catch (error) {
  if (error.message.includes('403')) {
    console.log('API key invalid, using cached data');
  } else if (error.message.includes('Rate limit')) {
    console.log('Rate limited, retrying later');
  }
}
```

## ביצועים

### Cache Hit Rate
- **מטרה**: >95% cache hits
- **מעקב**: כל 6 שעות
- **אופטימיזציה**: עדכון רק כשצריך

### זמני תגובה
- **Cache Hit**: <100ms
- **API Call**: 1-3 שניות
- **Database Query**: <50ms

### זיכרון
- **Cache Size**: מוגבל ל-6 חודשים
- **Cleanup**: אוטומטי כל 24 שעות
- **Compression**: נתונים דחוסים

## מוניטורינג

### לוגים חשובים
```
🚀 Starting scheduled updates for user: user123
📦 Loading from cache: US_high_2024-01
✅ Scheduled update completed in 1500ms
🧹 Cleaned up 25 old events
❌ EODHD API: 403 Forbidden - API key may be invalid
```

### מדדים
- **Total Events**: מספר אירועים כולל
- **Cache Hit Rate**: אחוז cache hits
- **Update Frequency**: תדירות עדכונים
- **Error Rate**: אחוז שגיאות

## פתרון בעיות

### Cache לא מתעדכן
1. בדוק שהעדכונים המתוזמנים פעילים
2. בדוק לוגים לשגיאות API
3. נסה עדכון ידני

### נתונים לא מופיעים
1. בדוק שהמשתמש מחובר
2. בדוק הרשאות RLS
3. בדוק שהנתונים קיימים במסד

### ביצועים איטיים
1. בדוק אינדקסים במסד הנתונים
2. בדוק גודל cache
3. בדוק רשת ו-API latency

## הגדרות מתקדמות

### עדכון תדירות
```typescript
// שינוי תדירות עדכונים
const UPDATE_INTERVAL_MS = 3 * 60 * 60 * 1000; // כל 3 שעות
```

### Cache TTL
```typescript
// שינוי זמן cache
const CACHE_DURATION_HOURS = 12; // 12 שעות
```

### Error Handling
```typescript
// שינוי מספר שגיאות מקסימלי
const MAX_ERROR_COUNT = 5; // 5 שגיאות לפני השבתה
```

## תמיכה

לשאלות או בעיות:
1. בדוק את הלוגים בקונסול
2. בדוק את סטטיסטיקות ה-cache
3. נסה עדכון ידני
4. פנה לצוות הפיתוח

---

**הערה**: המערכת עובדת אוטומטית ואינה דורשת התערבות ידנית ברוב המקרים. העדכונים המתוזמנים מבטיחים שהנתונים תמיד עדכניים.


