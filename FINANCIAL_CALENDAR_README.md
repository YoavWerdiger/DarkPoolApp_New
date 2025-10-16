# 📊 מערכת היומן הפיננסי המורחב

## 🎉 סיכום המערכת

המערכת המושלמת שלך כוללת **7 טאבים** במסך החדשות:

### 1. **חדשות מתפרצות** 📰
- חדשות פיננסיות בזמן אמת
- עדכונים שוטפים

### 2. **יומן כלכלי** 📅
- אירועי מאקרו (CPI, NFP, FOMC, GDP)
- 27 מדדי FRED
- אירועים עתידיים מ-EODHD
- ניווט יומי עם פילטרים

### 3. **דיווחי תוצאות** 📈
- Earnings Calendar (WebView של EarningsHub)
- דוחות רווחים בזמן אמת

### 4. **תחזיות רווחים** 🔮 (חדש!)
- תחזיות EPS ו-Revenue
- מעקב אחרי שינויים בקונצנזוס (7/30/60/90 ימים)
- מספר אנליסטים
- שיעורי צמיחה צפויים

### 5. **הנפקות** 🚀 (חדש!)
- IPOs צפויות והיסטוריות
- טווח מחירים ומחיר הצעה סופי
- כמות מניות
- סטטוס (Filed, Expected, Priced, Amended)

### 6. **פיצולי מניות** ✂️ (חדש!)
- פיצולים רגילים (4:1, 10:1)
- פיצולים הפוכים (1:10, 1:20)
- תאריכים אפקטיביים
- חברות מובילות

### 7. **דיבידנדים** 💰 (חדש!)
- לוח דיבידנדים עתידי
- מיון לפי חודשים
- 20 חברות מובילות שמשלמות דיבידנדים

---

## 🏗️ ארכיטקטורה

```
┌─────────────────────────────────────────────┐
│  EODHD Calendar API (כבר משלם)              │
│  ↓ Earnings Trends, IPOs, Splits, Dividends │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│  4 Edge Functions חדשים                     │
│  ✓ daily-earnings-trends                    │
│  ✓ daily-ipos-sync                          │
│  ✓ daily-splits-sync                        │
│  ✓ daily-dividends-sync                     │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│  4 טבלאות Supabase חדשות                   │
│  ✓ earnings_trends                          │
│  ✓ ipos_calendar                            │
│  ✓ splits_calendar                          │
│  ✓ dividends_calendar                       │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│  4 קומפוננטות Tab מעוצבות                  │
│  ✓ EarningsTrendsTab.tsx                    │
│  ✓ IPOsTab.tsx                              │
│  ✓ SplitsTab.tsx                            │
│  ✓ DividendsTab.tsx                         │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│  React Native UI                            │
│  ✓ עיצוב זהה למסכים הקיימים                │
│  ✓ Realtime updates                         │
│  ✓ Pull to refresh                          │
│  ✓ Empty states מעוצבים                    │
└─────────────────────────────────────────────┘
```

---

## 🚀 הוראות התקנה

### שלב 1: יצירת טבלאות Supabase

```bash
# פתח את Supabase SQL Editor והרץ:
```

הרץ את הקובץ: `create_financial_calendar_tables.sql`

זה ייצור:
- ✅ `earnings_trends` - תחזיות רווחים
- ✅ `ipos_calendar` - הנפקות
- ✅ `splits_calendar` - פיצולים
- ✅ `dividends_calendar` - דיבידנדים

---

### שלב 2: פריסת Edge Functions

#### 2.1 התקנת Supabase CLI (אם עדיין לא מותקן)

```bash
npm install -g supabase
```

#### 2.2 התחברות לפרויקט

```bash
supabase login
supabase link --project-ref wpmrtczbfcijoocguime
```

#### 2.3 פריסת הפונקציות

```bash
# פריסת כל 4 הפונקציות החדשות
supabase functions deploy daily-earnings-trends
supabase functions deploy daily-ipos-sync
supabase functions deploy daily-splits-sync
supabase functions deploy daily-dividends-sync
```

**או** העתק ידנית דרך Supabase Dashboard:
1. לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions
2. צור פונקציה חדשה לכל אחת
3. העתק את הקוד מהקבצים:
   - `supabase/functions/daily-earnings-trends/index.ts`
   - `supabase/functions/daily-ipos-sync/index.ts`
   - `supabase/functions/daily-splits-sync/index.ts`
   - `supabase/functions/daily-dividends-sync/index.ts`

---

### שלב 3: הגדרת Cron Jobs

```bash
# הרץ את הקובץ: SETUP_CRON_JOBS.sql
```

**חשוב**: החלף את `YOUR_ANON_KEY` עם ה-Anon Key האמיתי שלך מ-Supabase!

הקרון ג'ובס יפעלו כל יום ב-**07:00 בוקר** ויעדכנו את כל הנתונים.

---

### שלב 4: בדיקה ראשונה

#### 4.1 הרצה ידנית של הפונקציות

```bash
# מהטרמינל:
curl -X POST \
  https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-trends \
  -H "Authorization: Bearer YOUR_ANON_KEY"

curl -X POST \
  https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-ipos-sync \
  -H "Authorization: Bearer YOUR_ANON_KEY"

curl -X POST \
  https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-splits-sync \
  -H "Authorization: Bearer YOUR_ANON_KEY"

curl -X POST \
  https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-dividends-sync \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

#### 4.2 בדיקת טבלאות

```sql
-- בדוק שהנתונים נכנסו:
SELECT COUNT(*) FROM earnings_trends;
SELECT COUNT(*) FROM ipos_calendar;
SELECT COUNT(*) FROM splits_calendar;
SELECT COUNT(*) FROM dividends_calendar;
```

---

## 🎨 העיצוב

### ✨ תכונות UI/UX:

- **טאבים לגלילה** - ScrollView אופקי עם 7 טאבים
- **כרטיסים מעוצבים** - עיצוב זהה למסכים הקיימים
- **צבעים דינמיים** - 
  - 🟢 ירוק לתחזיות חיוביות
  - 🔴 אדום לפיצולים הפוכים ותחזיות שליליות
  - 🔵 כחול למידע ניטרלי
- **אייקונים** - Lucide React Native Icons
- **אנימציות חלקות** - Pull to refresh + Loading states
- **Empty States** - הודעות מעוצבות כשאין נתונים
- **Realtime** - כל השינויים בטבלאות מתעדכנים אוטומטית

---

## 📊 נתונים מוצגים

### Earnings Trends:
- EPS צפוי (ממוצע, טווח, צמיחה)
- הכנסות צפויות
- מספר אנליסטים
- מגמות 7/30/60/90 ימים
- רבעון/שנה נוכחיים ועתידיים

### IPOs:
- שם חברה וסימול
- תאריך מסחר ראשון
- טווח מחירים / מחיר הצעה
- כמות מניות
- סטטוס (Filed, Expected, Priced, Amended)

### Splits:
- יחס פיצול (4:1, 1:10)
- סוג (רגיל/הפוך)
- תאריך אפקטיבי
- הסבר ויזואלי

### Dividends:
- תאריך דיבידנד
- מיון לפי חודשים
- 20 חברות מובילות

---

## 💰 עלויות

| שירות | תכנית | עלות חודשית |
|-------|-------|-------------|
| EODHD | All-World | **כבר משלם** ✅ |
| Supabase | Free Tier | $0 |
| Edge Functions | Free Tier | $0 |

**סה"כ עלות נוספת: $0** 🎉

---

## 🔄 תחזוקה

### עדכונים אוטומטיים:
- ⏰ **07:00 בוקר** - כל 4 הפונקציות רצות אוטומטית
- 🔄 **Realtime** - שינויים מתעדכנים באפליקציה מיידית
- 💾 **UPSERT** - ללא כפילויות

### ניטור:
```sql
-- בדיקת עדכון אחרון:
SELECT 
  'Earnings Trends' as table_name,
  MAX(updated_at) as last_update,
  COUNT(*) as total_records
FROM earnings_trends

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

## 🐛 Troubleshooting

### בעיה: לא רואה נתונים באפליקציה

**פתרון:**
1. בדוק ש-RLS Policies פעילים:
```sql
SELECT * FROM pg_policies WHERE tablename IN (
  'earnings_trends',
  'ipos_calendar', 
  'splits_calendar',
  'dividends_calendar'
);
```

2. הרץ את הפונקציות ידנית (ראה שלב 4.1)

3. בדוק logs ב-Supabase:
```
Dashboard → Edge Functions → [function name] → Logs
```

---

### בעיה: Cron Jobs לא רצים

**פתרון:**
1. בדוק ש-pg_cron פעיל:
```sql
SELECT * FROM cron.job;
```

2. בדוק logs:
```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

3. ודא שהחלפת את `YOUR_ANON_KEY`

---

### בעיה: טאבים לא מוצגים

**פתרון:**
1. רענן את האפליקציה
2. בדוק ש-`screens/News/index.tsx` עודכן
3. בדוק שכל 4 קבצי הטאבים קיימים:
   - `EarningsTrendsTab.tsx`
   - `IPOsTab.tsx`
   - `SplitsTab.tsx`
   - `DividendsTab.tsx`

---

## 🎯 מה הלאה?

### שיפורים אפשריים:
1. **התראות Push** - עדכון על IPOs חדשים
2. **מועדפים** - שמירת חברות למעקב
3. **גרפים** - ויזואליזציה של תחזיות
4. **השוואות** - השוואה בין חברות
5. **פילטרים מתקדמים** - סינון לפי ענף, שווי שוק וכו'

---

## 📞 תמיכה

אם יש בעיה או שאלה:
1. בדוק את ה-README הזה
2. הסתכל ב-Logs של Supabase
3. בדוק את התיעוד של EODHD: https://eodhd.com/api/calendar/

---

**זהו! המערכת מוכנה לשימוש! 🚀**

שמור על העדכונים היומיים, תהנה מהנתונים הזורמים, ותן למשתמשים שלך חוויה מושלמת! 🎉


