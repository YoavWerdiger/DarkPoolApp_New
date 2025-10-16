# 🚀 מדריך התקנה מהיר - יומן פיננסי מורחב

## 📋 רשימת משימות להתקנה

### ✅ שלב 1: הכנה (5 דקות)

- [ ] ודא שיש לך גישה ל-Supabase Dashboard
- [ ] ודא שה-EODHD API Key פעיל: `68e3c3af900997.85677801`
- [ ] ודא שיש לך את ה-Supabase Anon Key

---

### ✅ שלב 2: יצירת טבלאות (2 דקות)

1. פתח Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/sql
   ```

2. העתק והרץ את הקובץ:
   ```sql
   create_financial_calendar_tables.sql
   ```

3. בדוק שהטבלאות נוצרו:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN (
     'earnings_trends',
     'ipos_calendar',
     'splits_calendar',
     'dividends_calendar'
   );
   ```

---

### ✅ שלב 3: פריסת Edge Functions (10 דקות)

#### אופציה א': דרך ה-Dashboard (מומלץ למתחילים)

1. לך ל-Edge Functions:
   ```
   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions
   ```

2. צור 4 פונקציות חדשות:

   **פונקציה 1: daily-earnings-trends**
   - שם: `daily-earnings-trends`
   - העתק קוד מ: `supabase/functions/daily-earnings-trends/index.ts`
   - לחץ **Deploy**

   **פונקציה 2: daily-ipos-sync**
   - שם: `daily-ipos-sync`
   - העתק קוד מ: `supabase/functions/daily-ipos-sync/index.ts`
   - לחץ **Deploy**

   **פונקציה 3: daily-splits-sync**
   - שם: `daily-splits-sync`
   - העתק קוד מ: `supabase/functions/daily-splits-sync/index.ts`
   - לחץ **Deploy**

   **פונקציה 4: daily-dividends-sync**
   - שם: `daily-dividends-sync`
   - העתק קוד מ: `supabase/functions/daily-dividends-sync/index.ts`
   - לחץ **Deploy**

#### אופציה ב': דרך ה-CLI (למתקדמים)

```bash
# התקנת Supabase CLI
npm install -g supabase

# התחברות
supabase login
supabase link --project-ref wpmrtczbfcijoocguime

# פריסה
supabase functions deploy daily-earnings-trends
supabase functions deploy daily-ipos-sync
supabase functions deploy daily-splits-sync
supabase functions deploy daily-dividends-sync
```

---

### ✅ שלב 4: הגדרת Cron Jobs (5 דקות)

1. פתח Supabase SQL Editor

2. **קודם כל** - קבל את ה-Anon Key שלך:
   - לך ל: `Settings → API`
   - העתק את `anon` / `public` key

3. העתק את הקובץ `SETUP_CRON_JOBS.sql`

4. **החלף** את `YOUR_ANON_KEY` עם ה-Key האמיתי שלך (4 מקומות!)

5. הרץ את הסקריפט

6. בדוק שהקרון ג'ובס נוצרו:
   ```sql
   SELECT jobname, schedule, active 
   FROM cron.job 
   WHERE jobname LIKE 'daily-%';
   ```

---

### ✅ שלב 5: בדיקה ראשונה (5 דקות)

#### הרצה ידנית של הפונקציות:

```bash
# החלף YOUR_ANON_KEY עם המפתח האמיתי

# 1. Earnings Trends
curl -X POST \
  https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-trends \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# 2. IPOs
curl -X POST \
  https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-ipos-sync \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# 3. Splits
curl -X POST \
  https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-splits-sync \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# 4. Dividends
curl -X POST \
  https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-dividends-sync \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

#### בדוק שהנתונים נכנסו:

```sql
-- אמור לראות מספרים > 0
SELECT 
  'Earnings Trends' as type,
  COUNT(*) as count
FROM earnings_trends

UNION ALL

SELECT 
  'IPOs',
  COUNT(*)
FROM ipos_calendar

UNION ALL

SELECT 
  'Splits',
  COUNT(*)
FROM splits_calendar

UNION ALL

SELECT 
  'Dividends',
  COUNT(*)
FROM dividends_calendar;
```

---

### ✅ שלב 6: בדיקה באפליקציה (2 דקות)

1. **פתח את האפליקציה**

2. **לך לטאב "חדשות"** (News)

3. **בדוק שהטאבים מוצגים**:
   - [ ] חדשות
   - [ ] יומן
   - [ ] תוצאות
   - [ ] **תחזיות** ← חדש!
   - [ ] **הנפקות** ← חדש!
   - [ ] **פיצולים** ← חדש!
   - [ ] **דיבידנדים** ← חדש!

4. **לחץ על כל טאב ובדוק**:
   - האם הנתונים מוצגים?
   - האם העיצוב נכון?
   - האם Pull-to-Refresh עובד?

---

## 🎯 תוצאה צפויה

אחרי השלמת כל השלבים, אתה אמור לראות:

### בטבלאות:
```
earnings_trends: ~50-100 רשומות
ipos_calendar: ~10-30 רשומות
splits_calendar: ~5-20 רשומות
dividends_calendar: ~50-100 רשומות
```

### באפליקציה:
- 7 טאבים במסך החדשות
- כרטיסים מעוצבים עם נתונים אמיתיים
- עיצוב אחיד עם שאר האפליקציה
- רענון פועל (Pull to refresh)

---

## 🐛 פתרון בעיות נפוצות

### בעיה: "Function not found"

**פתרון:**
- ודא שהפונקציות נפרסו (בדוק ב-Dashboard)
- בדוק שהשם מדויק: `daily-earnings-trends` (עם מקפים)

---

### בעיה: "No data in tables"

**פתרון:**
1. בדוק Logs של הפונקציות:
   ```
   Dashboard → Edge Functions → [function-name] → Logs
   ```

2. הרץ את הפונקציות ידנית (ראה שלב 5)

3. בדוק שה-EODHD API Key פעיל:
   ```bash
   curl "https://eodhd.com/api/calendar/earnings?api_token=68e3c3af900997.85677801&fmt=json&from=2024-01-01&to=2024-12-31"
   ```

---

### בעיה: "Tabs not showing"

**פתרון:**
1. רענן את האפליקציה (Cmd+R / Ctrl+R)
2. בדוק ש-`screens/News/index.tsx` עודכן
3. בדוק Console ל-errors:
   ```bash
   npx react-native log-ios
   # או
   npx react-native log-android
   ```

---

### בעיה: "Cron jobs not running"

**פתרון:**
1. בדוק ש-pg_cron פעיל:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. בדוק שהקרון ג'ובס פעילים:
   ```sql
   SELECT * FROM cron.job WHERE active = true;
   ```

3. בדוק את ה-Anon Key:
   - לך ל: `Settings → API`
   - ודא שהשתמשת ב-`anon` / `public` key

---

## 📊 ניטור ותחזוקה

### בדיקה יומית (אוטומטית):
- ⏰ 07:00 - הפונקציות רצות אוטומטית
- 📊 טבלאות מתעדכנות
- 🔄 משתמשים רואים נתונים עדכניים

### בדיקה ידנית (שבועית):
```sql
-- בדוק עדכון אחרון
SELECT 
  'Earnings Trends' as table_name,
  MAX(updated_at) as last_update,
  COUNT(*) as total_records
FROM earnings_trends
GROUP BY table_name

UNION ALL

SELECT 
  'IPOs',
  MAX(updated_at),
  COUNT(*)
FROM ipos_calendar

UNION ALL

SELECT 
  'Splits',
  MAX(updated_at),
  COUNT(*)
FROM splits_calendar

UNION ALL

SELECT 
  'Dividends',
  MAX(updated_at),
  COUNT(*)
FROM dividends_calendar;
```

---

## ✅ רשימת בדיקה סופית

לפני שאתה מכריז על "סיימתי", וודא:

- [ ] כל 4 הטבלאות קיימות ומכילות נתונים
- [ ] כל 4 ה-Edge Functions פרוסות ועובדות
- [ ] כל 4 הקרון ג'ובס פעילים
- [ ] כל 7 הטאבים מוצגים באפליקציה
- [ ] הנתונים מתעדכנים בזמן אמת
- [ ] Pull-to-Refresh עובד
- [ ] העיצוב אחיד ומושלם

---

## 🎉 זהו! המערכת פעילה!

שמור את המדריך הזה למקרה שתצטרך לפרוס שוב או לפתור בעיות.

**תהנה מהיומן הפיננסי המורחב שלך! 🚀**

---

### 📞 תמיכה נוספת

- **README מלא**: `FINANCIAL_CALENDAR_README.md`
- **תיעוד EODHD**: https://eodhd.com/api/calendar/
- **Supabase Docs**: https://supabase.com/docs



