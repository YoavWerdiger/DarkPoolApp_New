# Benzinga WebSocket Stream - הגדרה ושימוש

## 📡 סקירה כללית

ה-WebSocket stream של Benzinga מאפשר קבלת עדכוני earnings בזמן אמת. כאשר Benzinga מעדכן או יוצר דיווח רווחים חדש, הוא נשלח אוטומטית דרך WebSocket ומתעדכן במסד הנתונים.

## 🔧 הגדרה

### 1. Edge Function: `benzinga-websocket-stream`

ה-edge function `benzinga-websocket-stream` מתחבר ל-WebSocket של Benzinga ומעדכן את המסד נתונים אוטומטית.

**מיקום:** `supabase/functions/benzinga-websocket-stream/index.ts`

### 2. Environment Variables

הוסף את המפתח הבא ל-Supabase Environment Variables:

```bash
BENZINGA_API_KEY=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC
```

### 3. הפעלה

#### דרך n8n או Scheduler:

```bash
POST https://your-project.supabase.co/functions/v1/benzinga-websocket-stream
```

#### דרך Supabase CLI:

```bash
supabase functions serve benzinga-websocket-stream
```

## 📊 איך זה עובד

1. **התחברות:** ה-edge function מתחבר ל-WebSocket של Benzinga:
   ```
   wss://api.benzinga.com/api/v2.1/calendar/earnings/stream?token=YOUR_TOKEN
   ```

2. **קבלת עדכונים:** כאשר Benzinga שולח עדכון (created/updated/deleted), הוא מתקבל כ-JSON:
   ```json
   {
     "id": "uuid",
     "api_version": "websocket/v1",
     "kind": "data/v2.1/calendar/earnings",
     "data": {
       "action": "created",
       "id": "earnings_id",
       "content": {
         "ticker": "AAPL",
         "date": "2024-10-04",
         "eps": "1.52",
         "eps_est": "1.50",
         ...
       }
     }
   }
   ```

3. **עדכון DB:** ה-earnings מומר לפורמט EODHD (לתאימות) ונשמר/מתעדכן ב-`earnings_calendar`.

## 🎯 פעולות נתמכות

- ✅ **created** - דיווח רווחים חדש נוצר
- ✅ **updated** - דיווח רווחים קיים התעדכן (תוצאות בפועל)
- ⚠️ **deleted** - דיווח נמחק (לא מוחק מ-DB, רק מודיע)

## 📈 סינון לפי Tickers

ניתן לסנן את ה-WebSocket לקבל עדכונים רק עבור tickers ספציפיים:

```typescript
// ב-benzingaService.ts
const wsUrl = benzingaService.getWebSocketUrl(['AAPL', 'MSFT', 'GOOGL'])
```

או ב-edge function, הוסף ל-URL:
```
wss://api.benzinga.com/api/v2.1/calendar/earnings/stream?token=XXX&tickers=AAPL,MSFT,GOOGL
```

## 🔄 הפעלה מתמשכת

ה-edge function מחזיק connection פתוח כל הזמן. כדי להפעיל אותו ברקע:

### אפשרות 1: n8n Scheduler
צור workflow ב-n8n שקורא ל-edge function כל X דקות (ה-WebSocket יישאר פתוח).

### אפשרות 2: Supabase Cron Job
הוסף cron job ב-Supabase:
```sql
SELECT cron.schedule(
  'benzinga-websocket-keepalive',
  '*/5 * * * *', -- כל 5 דקות
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/benzinga-websocket-stream',
    headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) as request_id;
  $$
);
```

## 📝 Logs

ה-edge function מדפיס logs מפורטים:
- ✅ Connection established
- 📨 Messages received
- ✅ Updates applied to DB
- ❌ Errors

עקוב אחרי ה-logs דרך Supabase Dashboard → Edge Functions → Logs.

## ⚠️ הערות חשובות

1. **Timeout:** Edge functions ב-Supabase מוגבלים ל-60 שניות. לכן, WebSocket connection ייסגר אחרי דקה. כדי לשמור על connection, צריך לריץ את ה-function באופן תקופתי.

2. **Error Handling:** אם ה-WebSocket נסגר, הוא ינסה להתחבר מחדש בפעם הבאה שה-function ירוץ.

3. **Rate Limiting:** Benzinga מגביל את מספר ה-WebSocket connections. וודא שאתה לא מפעיל מספר connections במקביל.

## 🚀 דוגמת שימוש

### הפעלה ידנית:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/benzinga-websocket-stream \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### בדיקת סטטוס:

עקוב אחרי ה-logs ב-Supabase Dashboard כדי לראות:
- מספר הודעות שהתקבלו
- מספר עדכונים שהוחלו
- שגיאות (אם יש)

## 📚 מקורות נוספים

- [Benzinga WebSocket Documentation](https://docs.benzinga.com/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)










