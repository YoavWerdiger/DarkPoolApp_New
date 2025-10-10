# 📊 מדריך הפעלת היומן הכלכלי

## 🎯 מטרה
הפעלת מערכת היומן הכלכלי עם:
- ✅ 60+ מדדים כלכליים מ-FRED (חינמי)
- ✅ אירועים כלכליים מ-EODHD
- ✅ דיווחי רווחים מ-EODHD
- ✅ עדכונים בזמן אמת עם Supabase Realtime
- ✅ Smart Polling לאירועים חשובים

---

## 📋 שלב 1: יצירת הטבלאות ב-Supabase

### 1.1 התחבר ל-Supabase Dashboard
👉 https://supabase.com/dashboard

### 1.2 בחר את הפרויקט שלך
- לחץ על הפרויקט "DarkPoolApp" (או שם הפרויקט שלך)

### 1.3 לך ל-SQL Editor
- בתפריט השמאלי: **SQL Editor**
- לחץ על **+ New Query**

### 1.4 הרץ את קובץ Economic Events Table
**העתק והדבק את התוכן מהקובץ:**
```
create_economic_events_table.sql
```

**לחץ על RUN** (או Ctrl+Enter)

✅ **בדיקה:** אמור להופיע הודעה "Success. No rows returned"

---

### 1.5 הרץ את קובץ Earnings Events Table
**העתק והדבק את התוכן מהקובץ:**
```
create_earnings_events_table.sql
```

**לחץ על RUN** (או Ctrl+Enter)

✅ **בדיקה:** אמור להופיע הודעה "Success. No rows returned"

---

## 🚀 שלב 2: העלאת Edge Functions

### 2.1 אפשרויות להעלאה

#### אפשרות A: דרך Supabase Dashboard (מומלץ)

1. **לך ל-Edge Functions** בתפריט השמאלי
2. **לחץ על + Deploy new function**
3. **העלה כל פונקציה:**

##### Function 1: daily-economic-sync
```typescript
// העתק את כל התוכן מ:
supabase/functions/daily-economic-sync/index.ts
```

- **Function name:** `daily-economic-sync`
- **לחץ על Deploy**

##### Function 2: daily-earnings-sync
```typescript
// העתק את כל התוכן מ:
supabase/functions/daily-earnings-sync/index.ts
```

- **Function name:** `daily-earnings-sync`
- **לחץ על Deploy**

##### Function 3: smart-economic-poller
```typescript
// העתק את כל התוכן מ:
supabase/functions/smart-economic-poller/index.ts
```

- **Function name:** `smart-economic-poller`
- **לחץ על Deploy**

---

#### אפשרות B: דרך Supabase CLI (מתקדם)

```bash
# התקנת Supabase CLI
npm install -g supabase

# התחברות
supabase login

# קישור לפרויקט
supabase link --project-ref YOUR_PROJECT_REF

# העלאת כל הפונקציות
supabase functions deploy daily-economic-sync
supabase functions deploy daily-earnings-sync
supabase functions deploy smart-economic-poller
```

---

## ⏰ שלב 3: הגדרת Cron Jobs (אוטומציה)

### אפשרות A: pg_cron (אם זמין ב-Supabase)

**לך ל-SQL Editor והרץ:**

```sql
-- הפעלת pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily Economic Sync - כל יום ב-06:00
SELECT cron.schedule(
  'daily-economic-sync',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/daily-economic-sync',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Daily Earnings Sync - כל יום ב-07:00
SELECT cron.schedule(
  'daily-earnings-sync',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/daily-earnings-sync',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Smart Poller - כל שעתיים
SELECT cron.schedule(
  'smart-economic-poller',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/smart-economic-poller',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**⚠️ החלף את:**
- `YOUR_PROJECT_ID` - ה-Project ID שלך
- `YOUR_ANON_KEY` - ה-Anon Key שלך (מ-Settings → API)

---

### אפשרות B: GitHub Actions (מומלץ)

**הקובץ כבר קיים:** `.github/workflows/economic-sync.yml`

**מה צריך לעשות:**

1. **לך ל-GitHub Repository Settings**
2. **Secrets and variables → Actions**
3. **הוסף Secret חדש:**
   - **Name:** `SUPABASE_ANON_KEY`
   - **Value:** ה-Anon Key שלך מ-Supabase

4. **עדכן את הקובץ** `.github/workflows/economic-sync.yml`:
   ```yaml
   # החלף את YOUR_PROJECT_ID ב-Project ID האמיתי שלך
   ```

✅ **GitHub Actions ירוץ אוטומטית כל יום ב-06:00 UTC**

---

## 🧪 שלב 4: בדיקת המערכת

### 4.1 הפעלה ידנית של Edge Function

**לך ל-Edge Functions ב-Supabase Dashboard:**

1. **בחר את** `daily-economic-sync`
2. **לחץ על Invoke**
3. **בדוק את ה-Logs** - אמור לראות:
   ```
   🚀 Daily Economic Sync started
   📊 Fetched X economic events from FRED
   ✅ Successfully saved X events to database
   ```

4. **חזור על זה** עם `daily-earnings-sync`

---

### 4.2 בדיקת הטבלאות

**לך ל-Table Editor:**

1. **בחר את** `economic_events`
2. **בדוק שיש נתונים** - אמור לראות 60+ שורות
3. **בחר את** `earnings_events`
4. **בדוק שיש נתונים**

---

### 4.3 בדיקת Realtime

**לך ל-Realtime ב-Supabase Dashboard:**

1. **לחץ על** `economic_events`
2. **בדוק שה-Realtime מופעל** (יש סימן ירוק)

---

## 🎨 שלב 5: עדכון ה-UI

### 5.1 עדכון EconomicCalendarTab

**הקובץ:** `screens/News/EconomicCalendarTab.tsx`

**כבר יש לו את:**
```typescript
import { supabase } from '../../lib/supabase';
```

**עכשיו צריך להוסיף Realtime subscription:**

```typescript
useEffect(() => {
  // Subscribe to realtime updates
  const subscription = supabase
    .channel('economic_events')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'economic_events' },
      (payload) => {
        console.log('📡 Economic event updated:', payload);
        // Refresh data
        fetchEconomicEvents();
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

---

## 💰 סיכום עלויות

### מה שמשתמשים בו:

| שירות | תכנית | עלות |
|-------|-------|------|
| **FRED** | חינמי | $0 |
| **EODHD** | Fundamental Data Feed | כבר משלם |
| **Supabase** | Free tier | $0 |
| **GitHub Actions** | Free tier | $0 |

**סה"כ עלות נוספת:** $0 💰

---

## 🔄 תזכורת - מה המערכת עושה

### כל יום ב-06:00:
1. 📊 שולפת 60+ מדדים כלכליים מ-FRED
2. 💾 שומרת ב-Supabase DB
3. 🔔 מעדכנת את ה-UI בזמן אמת

### כל יום ב-07:00:
1. 📈 שולפת דיווחי רווחים מ-EODHD
2. 💾 שומרת ב-Supabase DB
3. 🔔 מעדכנת את ה-UI בזמן אמת

### כל שעתיים:
1. 🔍 בודקת אירועים חשובים הקרובים
2. 📡 שולפת עדכונים אחרונים
3. 🔔 שולחת התראות Push (אם מוגדר)

---

## ✅ Checklist סופי

- [ ] הרצתי את `create_economic_events_table.sql`
- [ ] הרצתי את `create_earnings_events_table.sql`
- [ ] העליתי את `daily-economic-sync` Function
- [ ] העליתי את `daily-earnings-sync` Function
- [ ] העליתי את `smart-economic-poller` Function
- [ ] הגדרתי Cron Jobs / GitHub Actions
- [ ] בדקתי שהטבלאות מתמלאות בנתונים
- [ ] בדקתי ש-Realtime פועל
- [ ] עדכנתי את ה-UI עם Realtime subscriptions

---

## 🆘 צריך עזרה?

אם משהו לא עובד:

1. **בדוק את ה-Logs** ב-Edge Functions
2. **בדוק את ה-API Keys** (FRED, EODHD)
3. **בדוק את ה-Realtime** מופעל
4. **צור issue** ב-GitHub

---

**בהצלחה! 🚀**

