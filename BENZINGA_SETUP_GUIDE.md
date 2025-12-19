# 🚀 מדריך הגדרת Benzinga API

## סקירה כללית

המערכת עברה להשתמש ב-**Benzinga API** עבור:
- ✅ **דיווחי תוצאות (Earnings)** - עדכונים בזמן אמת
- ✅ **יומן כלכלי (Economic Calendar)** - אירועים כלכליים חשובים

---

## 📋 שלב 1: הוספת משתני סביבה ב-Supabase

### דרך ה-Dashboard:

1. **היכנס ל-Supabase Dashboard**
   - עבור אל: https://supabase.com/dashboard
   - בחר בפרויקט שלך

2. **עבור להגדרות**
   - לחץ על **Settings** בתפריט השמאלי
   - בחר **Edge Functions**

3. **הוסף משתנה סביבה**
   - לחץ על **Add Secret**
   - שם: `BENZINGA_API_KEY`
   - ערך: `bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC`
   - לחץ **Save**

### דרך ה-CLI:

```bash
# התחבר ל-Supabase
supabase login

# קבע את ה-project
supabase link --project-ref [YOUR_PROJECT_REF]

# הוסף את מפתח ה-API
supabase secrets set BENZINGA_API_KEY=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC
```

---

## 📋 שלב 2: פריסת Edge Functions

### 1. העלאת Function לסינכרון Earnings

```bash
# פריסת daily-earnings-sync-simple (כבר משתמש ב-Benzinga)
supabase functions deploy daily-earnings-sync-simple
```

### 2. העלאת Function לסינכרון יומן כלכלי

```bash
# פריסת benzinga-economics-sync (חדש)
supabase functions deploy benzinga-economics-sync

# פריסת economic-scheduler (מעודכן)
supabase functions deploy economic-scheduler
```

---

## 📋 שלב 3: הגדרת Cron Jobs

### דרך ה-Dashboard:

1. **עבור ל-Database → Cron Jobs**
2. **הוסף Job חדש לEarnings**:
   ```sql
   SELECT cron.schedule(
     'daily-earnings-sync',
     '0 6,18 * * *',  -- פעמיים ביום (6:00 ו-18:00)
     $$
     SELECT net.http_post(
       url := 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/daily-earnings-sync-simple',
       headers := '{"Authorization": "Bearer [YOUR_ANON_KEY]"}'::jsonb,
       body := '{}'::jsonb
     );
     $$
   );
   ```

3. **הוסף Job חדש ליומן כלכלי**:
   ```sql
   SELECT cron.schedule(
     'benzinga-economics-sync',
     '0 */6 * * *',  -- כל 6 שעות
     $$
     SELECT net.http_post(
       url := 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/benzinga-economics-sync',
       headers := '{"Authorization": "Bearer [YOUR_ANON_KEY]"}'::jsonb,
       body := '{}'::jsonb
     );
     $$
   );
   ```

---

## 📋 שלב 4: בדיקת הפונקציות

### בדיקה ידנית דרך curl:

```bash
# בדיקת Earnings Sync
curl -X POST \
  'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/daily-earnings-sync-simple' \
  -H 'Authorization: Bearer [YOUR_ANON_KEY]' \
  -H 'Content-Type: application/json'

# בדיקת Economics Sync
curl -X POST \
  'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/benzinga-economics-sync' \
  -H 'Authorization: Bearer [YOUR_ANON_KEY]' \
  -H 'Content-Type: application/json'

# בדיקת Economic Scheduler
curl -X POST \
  'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/economic-scheduler/update-economic-data' \
  -H 'Authorization: Bearer [YOUR_ANON_KEY]' \
  -H 'Content-Type: application/json'
```

### צפייה בלוגים:

```bash
# לוגים של Earnings
supabase functions logs daily-earnings-sync-simple

# לוגים של Economics
supabase functions logs benzinga-economics-sync

# לוגים של Scheduler
supabase functions logs economic-scheduler
```

---

## 📋 שלב 5: עדכון משתני סביבה באפליקציה (React Native)

עדכן את `.env` או `.env.local`:

```bash
# Benzinga API Key
EXPO_PUBLIC_BENZINGA_API_KEY=bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC
```

---

## ✅ אימות המערכת

### 1. בדוק שהנתונים מסתנכרנים

```sql
-- בדוק earnings אחרונים
SELECT * FROM earnings_calendar 
ORDER BY report_date DESC 
LIMIT 10;

-- בדוק אירועים כלכליים אחרונים
SELECT * FROM economic_events_cache 
ORDER BY date DESC 
LIMIT 10;

-- בדוק metadata
SELECT * FROM economic_cache_metadata 
WHERE source = 'Benzinga';
```

### 2. בדוק באפליקציה

1. פתח את האפליקציה
2. עבור למסך **חדשות** → **דיווחי תוצאות**
3. וודא שיש נתונים עדכניים
4. עבור למסך **חדשות** → **יומן כלכלי**
5. וודא שיש אירועים כלכליים

---

## 🔧 פתרון בעיות נפוצות

### בעיה: "401 Unauthorized"
**פתרון:** וודא שה-API key נכון ונוסף למשתני הסביבה

### בעיה: "No data returned"
**פתרון:** 
1. בדוק את הלוגים של ה-Function
2. וודא שהטווח תאריכים נכון
3. נסה להפעיל את ה-Function ידנית

### בעיה: "Rate limit exceeded"
**פתרון:** Benzinga מאפשרת מספר רב של בקשות. אם אתה מגיע למגבלה:
1. הקטן את תדירות ה-Cron Jobs
2. הגדל את זמן ה-Cache

---

## 📊 השוואת מקורות נתונים

| מאפיין | Benzinga | EODHD | FRED |
|--------|----------|-------|------|
| עדכוניות | ⭐⭐⭐⭐⭐ זמן אמת | ⭐⭐⭐ יומי | ⭐⭐ שבועי |
| כיסוי Earnings | ⭐⭐⭐⭐⭐ מלא | ⭐⭐⭐⭐ טוב | ❌ לא זמין |
| כיסוי Economic | ⭐⭐⭐⭐⭐ מלא | ⭐⭐⭐ בסיסי | ⭐⭐⭐⭐⭐ מעולה |
| WebSocket | ✅ זמין | ❌ לא זמין | ❌ לא זמין |
| מחיר | 💰 בינוני | 💰💰 יקר | 🆓 חינם |

---

## 🎯 מה הושג?

✅ **דיווחי תוצאות (Earnings)**:
- המרה מ-EODHD ל-Benzinga
- עדכונים בזמן אמת
- WebSocket support (עבור עדכונים חיים)

✅ **יומן כלכלי (Economic Calendar)**:
- המרה מ-EODHD/FRED ל-Benzinga
- אירועים כלכליים חשובים בלבד (importance ≥ 2)
- כיסוי מלא של אירועי ארה"ב

✅ **Services מעודכנים**:
- `benzingaService.ts` - שירות מלא לBenzinga API
- `eodhdService.ts` - משתמש ב-Benzinga מאחורי הקלעים
- `economicDataCache.ts` - Cache חכם עם Benzinga

✅ **Edge Functions**:
- `daily-earnings-sync-simple` - כבר משתמש ב-Benzinga
- `benzinga-economics-sync` - חדש! סינכרון יומן כלכלי
- `economic-scheduler` - מעודכן להשתמש ב-Benzinga

---

## 📝 הערות חשובות

1. **API Key Security**: המפתח מוגדר כ-environment variable ולא hardcoded
2. **Fallback**: המערכת ממשיכה לתמוך ב-FRED כגיבוי במקרה של בעיה
3. **Rate Limiting**: יש pagination מובנה לבקשות גדולות
4. **Caching**: נתונים נשמרים ב-DB לביצועים טובים יותר

---

## 📞 תמיכה

אם יש בעיות:
1. בדוק את הלוגים של ה-Edge Functions
2. וודא שה-API key תקף
3. בדוק את הטבלאות במסד הנתונים
4. בדוק את התיעוד של Benzinga: https://docs.benzinga.com

---

**תאריך עדכון:** דצמבר 2025
**גרסה:** 1.0.0








