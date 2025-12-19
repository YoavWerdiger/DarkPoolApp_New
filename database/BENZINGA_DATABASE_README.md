# 🗃️ סקריפטי Database ל-Benzinga

## 📋 רשימת קבצים:

| קובץ | מתי להשתמש |
|------|-----------|
| `benzinga_economic_events_table.sql` | יצירת טבלאות חדשות |
| `create_benzinga_cron_jobs.sql` | יצירת Cron Jobs |
| `reset_benzinga_tables.sql` | 🔴 **איפוס נתונים** |
| `load_benzinga_data_now.sql` | טעינה מיידית |

---

## 🔄 תהליך איפוס מלא:

### 1️⃣ איפוס הנתונים הישנים
```sql
-- הרץ: database/reset_benzinga_tables.sql
```
**מה זה עושה:**
- ✅ מוחק כל הנתונים מ-`earnings_calendar`
- ✅ מוחק כל הנתונים מ-`economic_events_cache`
- ✅ מוחק metadata ישן
- ✅ משאיר את מבנה הטבלאות

---

### 2️⃣ וידוא שהטבלאות קיימות
```sql
-- הרץ: database/benzinga_economic_events_table.sql
```
**מה זה עושה:**
- ✅ יוצר `economic_events_cache` (אם לא קיימת)
- ✅ יוצר `economic_cache_metadata` (אם לא קיימת)
- ✅ מוסיף indexes
- ✅ מוסיף triggers

---

### 3️⃣ טעינת נתונים מיידית (אופציונלי)
```sql
-- הרץ: database/load_benzinga_data_now.sql
```
**מה זה עושה:**
- ✅ מפעיל `daily-earnings-sync-simple` עכשיו
- ✅ מפעיל `benzinga-economics-sync` עכשיו
- ✅ ללא המתנה ל-Cron Jobs

---

## 🚀 תהליך מהיר (3 שלבים):

### SQL Editor ב-Supabase:
https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/sql

#### שלב 1: איפוס
```sql
-- העתק והדבק: reset_benzinga_tables.sql
-- לחץ Run
```

#### שלב 2: וידוא טבלאות
```sql
-- העתק והדבק: benzinga_economic_events_table.sql
-- לחץ Run
```

#### שלב 3: טעינה מיידית
```sql
-- העתק והדבק: load_benzinga_data_now.sql
-- לחץ Run
```

**המתן 30 שניות ואז בדוק:**
```sql
SELECT COUNT(*) FROM earnings_calendar;
SELECT COUNT(*) FROM economic_events_cache WHERE source = 'Benzinga';
```

---

## 🔍 בדיקות שימושיות:

### בדוק כמה רשומות יש
```sql
SELECT 
  'earnings_calendar' as table_name,
  COUNT(*) as count,
  MIN(report_date) as earliest,
  MAX(report_date) as latest
FROM earnings_calendar

UNION ALL

SELECT 
  'economic_events_cache' as table_name,
  COUNT(*) as count,
  MIN(date) as earliest,
  MAX(date) as latest
FROM economic_events_cache
WHERE source = 'Benzinga';
```

### בדוק את האירועים האחרונים
```sql
-- Earnings אחרונים
SELECT code, name, report_date, before_after_market
FROM earnings_calendar
ORDER BY report_date DESC
LIMIT 10;

-- אירועים כלכליים אחרונים
SELECT title, date, time, importance
FROM economic_events_cache
WHERE source = 'Benzinga'
ORDER BY date DESC, time DESC
LIMIT 10;
```

### בדוק Metadata
```sql
SELECT * FROM economic_cache_metadata;
```

---

## ⚠️ אזהרות:

### 🔴 `reset_benzinga_tables.sql`
- מוחק **כל הנתונים**!
- השתמש רק אם אתה בטוח
- נתונים שנמחקו לא ניתן לשחזור

### ⏳ `load_benzinga_data_now.sql`
- לוקח 30-60 שניות
- המתן לפני בדיקת התוצאות
- צפה בלוגים אם יש בעיות

---

## 📊 לוגים:

### צפה בלוגים של Functions:
https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions

### סינון ללוגים של Benzinga:
- `benzinga-economics-sync`
- `daily-earnings-sync-simple`

---

## 🆘 פתרון בעיות:

### "Table does not exist"
**פתרון:** הרץ `benzinga_economic_events_table.sql`

### "No data after load"
**פתרון:** 
1. בדוק לוגים
2. וודא ש-API Key נכון
3. הרץ `load_benzinga_data_now.sql` שוב

### "Duplicate key violation"
**פתרון:** הרץ `reset_benzinga_tables.sql` ואז `load_benzinga_data_now.sql`

---

## 🎯 זרימת עבודה מומלצת:

```
1. איפוס → reset_benzinga_tables.sql
2. יצירה → benzinga_economic_events_table.sql
3. Cron → create_benzinga_cron_jobs.sql
4. טעינה → load_benzinga_data_now.sql (אופציונלי)
5. בדיקה → SELECT COUNT(*) ...
```

---

**תאריך:** דצמבר 2025  
**גרסה:** 1.0.0








