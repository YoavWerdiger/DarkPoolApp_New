# 📈 מדריך מערכת הדיווחים הרבעוניים

## סטטוס נוכחי

### ✅ מה כבר קיים:

1. **מסך דיווחים רבעוניים** (`EarningsReportsTab.tsx`)
   - הצגת דיווחים לפי תאריך
   - סינון לפי חיפוש
   - ניווט יומי (קודם/הבא/היום)
   - פרטים מלאים לכל דיווח

2. **שירות דיווחים** (`earningsService.ts`)
   - טעינת דיווחים מ-Supabase
   - סינון לפי תאריך, סימבול, קטגוריה
   - פונקציות עזר לסינון

3. **פונקציית סנכרון** (`daily-earnings-sync-simple`)
   - שולפת דיווחים מ-Benzinga API
   - ממירה לפורמט האפליקציה
   - שומרת ב-`earnings_calendar` table
   - תומכת ב-pagination (עד 10,000 רשומות)

4. **WebSocket Stream** (`benzinga-websocket-stream`)
   - עדכונים בזמן אמת לתוצאות אקטואליות
   - מתחבר ל-Benzinga WebSocket
   - מעדכן את המסד נתונים אוטומטית

---

## 🚀 מה צריך לעשות

### שלב 1: בדיקת סטטוס נוכחי

```sql
-- הרץ את הסקריפט הזה כדי לבדוק את המצב הנוכחי:
-- database/setup_earnings_system.sql
```

זה יבדוק:
- כמה דיווחים יש במסד
- האם יש Cron Job פעיל
- מה הטווח התאריכים של הנתונים

### שלב 2: הגדרת Cron Job

```sql
-- הרץ את הסקריפט הזה כדי להגדיר Cron Job:
-- database/setup_earnings_system.sql
```

זה יגדיר:
- Cron Job שרץ כל יום ב-06:00 ישראל
- שולף חודש אחורה + חודש קדימה
- מעדכן את המסד נתונים

### שלב 3: שליפה ראשונית

```sql
-- הרץ את הסקריפט הזה כדי לשלוף נתונים עכשיו:
-- database/fetch_earnings_now.sql
```

זה ישלוף:
- חודש אחורה + חודש קדימה מהיום
- כל הדיווחים הזמינים מ-Benzinga

### שלב 4: בדיקת WebSocket Stream

הפונקציה `benzinga-websocket-stream` צריכה לרוץ ברקע כדי לקבל עדכונים בזמן אמת.

**אפשרויות:**
1. **n8n workflow** - להריץ את הפונקציה כל 5 דקות
2. **Supabase Cron Job** - להריץ כל 10 דקות (פחות מומלץ)
3. **שירות חיצוני** - להריץ את הפונקציה ברקע

---

## 📊 מבנה הנתונים

### טבלה: `earnings_calendar`

```sql
CREATE TABLE earnings_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,                    -- סימבול (לדוגמה: AAPL.US)
  report_date DATE NOT NULL,             -- תאריך הדיווח
  date DATE,                              -- תאריך נוסף (למקרה של שינוי)
  before_after_market TEXT,               -- BeforeMarket / AfterMarket
  currency TEXT,                          -- מטבע (USD)
  actual NUMERIC,                         -- תוצאה אקטואלית
  estimate NUMERIC,                       -- תחזית
  difference NUMERIC,                     -- הפרש (actual - estimate)
  percent NUMERIC,                        -- אחוז surprise
  source TEXT,                            -- מקור (Benzinga)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 זרימת העבודה

### 1. סנכרון יומי (Cron Job)
```
06:00 ישראל (03:00 UTC)
  ↓
daily-earnings-sync-simple
  ↓
שליפה מ-Benzinga API
  ↓
המרה לפורמט האפליקציה
  ↓
שמירה ב-earnings_calendar
```

### 2. עדכונים בזמן אמת (WebSocket)
```
WebSocket Connection
  ↓
benzinga-websocket-stream
  ↓
קבלת עדכונים מ-Benzinga
  ↓
עדכון actual/estimate/difference/percent
  ↓
Realtime Subscription מעדכן את האפליקציה
```

### 3. הצגה באפליקציה
```
EarningsReportsTab
  ↓
EarningsService.getAll()
  ↓
סינון לפי תאריך נבחר
  ↓
הצגה ברשימה
```

---

## 🛠️ פונקציות זמינות

### 1. `daily-earnings-sync-simple`
- **תפקיד:** סנכרון יומי של דיווחים
- **פרמטרים:** `date_from`, `date_to` (אופציונלי)
- **טווח ברירת מחדל:** חודש אחורה + חודש קדימה
- **תדירות:** פעם ביום (06:00 ישראל)

### 2. `benzinga-websocket-stream`
- **תפקיד:** עדכונים בזמן אמת
- **פורמט:** WebSocket stream
- **עדכונים:** actual, estimate, difference, percent
- **תדירות:** רציף (צריך לרוץ ברקע)

---

## 📝 הוראות הפעלה

### הפעלה ראשונית:

1. **בדיקת סטטוס:**
   ```sql
   -- הרץ: database/setup_earnings_system.sql
   ```

2. **הגדרת Cron Job:**
   ```sql
   -- הרץ: database/setup_earnings_system.sql
   ```

3. **שליפה ראשונית:**
   ```sql
   -- הרץ: database/fetch_earnings_now.sql
   ```

4. **בדיקת נתונים:**
   ```sql
   SELECT COUNT(*) FROM earnings_calendar;
   SELECT * FROM earnings_calendar WHERE report_date = CURRENT_DATE LIMIT 10;
   ```

### עדכון ידני:

```sql
-- הרץ: database/fetch_earnings_now.sql
-- או קרא ישירות ל-Edge Function:
```

```bash
curl -X POST \
  'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "date_from": "2025-12-01",
    "date_to": "2026-01-31"
  }'
```

---

## 🐛 פתרון בעיות

### בעיה: אין דיווחים במסד

**פתרון:**
1. בדוק שהפונקציה פרוסה: `npm run supabase:deploy:earnings`
2. הרץ שליפה ידנית: `database/fetch_earnings_now.sql`
3. בדוק את הלוגים: Dashboard → Functions → daily-earnings-sync-simple → Logs

### בעיה: Cron Job לא רץ

**פתרון:**
1. בדוק שהפונקציה מוגדרת: `database/setup_earnings_system.sql`
2. בדוק שהפונקציה פעילה: `SELECT * FROM cron.job WHERE jobname LIKE '%earnings%';`
3. בדוק את הלוגים: Dashboard → Database → Logs

### בעיה: עדכונים בזמן אמת לא עובדים

**פתרון:**
1. בדוק שהפונקציה `benzinga-websocket-stream` פרוסה
2. הרץ את הפונקציה ידנית כדי לבדוק שהיא עובדת
3. הגדר n8n workflow או שירות אחר להריץ את הפונקציה ברקע

---

## 📚 קבצים רלוונטיים

### Backend:
- `supabase/functions/daily-earnings-sync-simple/index.ts` - סנכרון יומי
- `supabase/functions/benzinga-websocket-stream/index.ts` - WebSocket stream
- `services/benzingaService.ts` - שירות Benzinga API

### Frontend:
- `screens/News/EarningsReportsTab.tsx` - מסך דיווחים
- `services/earningsService.ts` - שירות דיווחים

### Database:
- `database/setup_earnings_system.sql` - הגדרת מערכת
- `database/fetch_earnings_now.sql` - שליפה ידנית
- `database/check_benzinga_functions.sql` - בדיקת סטטוס

---

## ✅ Checklist להפעלה

- [ ] בדיקת סטטוס נוכחי (`setup_earnings_system.sql`)
- [ ] הגדרת Cron Job (`setup_earnings_system.sql`)
- [ ] שליפה ראשונית (`fetch_earnings_now.sql`)
- [ ] בדיקת נתונים במסד
- [ ] בדיקת הצגה באפליקציה
- [ ] הגדרת WebSocket stream (אופציונלי)
- [ ] בדיקת עדכונים בזמן אמת (אופציונלי)

---

## 🎯 סיכום

המערכת מוכנה לשימוש! צריך רק:
1. להריץ את הסקריפטים להגדרה
2. לוודא שהנתונים נטענים נכון
3. לבדוק שהאפליקציה מציגה את הנתונים

לשאלות או בעיות, בדוק את הלוגים ב-Dashboard.









