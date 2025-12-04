# 🧹 ניקוי ופריסה מחדש - Benzinga API

## 📋 רשימת פעולות

### שלב 1: מחיקת פונקציות ישנות (אופציונלי)

אם קיימות, מחק את הפונקציות הבאות דרך Dashboard:
- `earnings-result-update` (שם ישן - יש שגיאה)
- `result-earning-up` (שם ישן - יש שגיאה)
- כל פונקציה אחרת שקשורה ל-earnings ועדיין משתמשת ב-EODHD

**איך למחוק:**
1. לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions
2. לחץ על הפונקציה הישנה
3. לחץ על **Delete** או **Remove**
4. אשר את המחיקה

---

### שלב 2: הגדרת Environment Variable

1. לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/settings/functions
2. גלול למטה ל-**Secrets**
3. לחץ **Add new secret**
4. שם: `BENZINGA_API_KEY`
5. ערך: `bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC`
6. לחץ **Save**

---

### שלב 3: פריסת 4 פונקציות חדשות

#### פונקציה 1: earnings-daily-update
1. לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions
2. לחץ **Create a new function**
3. שם: `earnings-daily-update`
4. פתח את: `DASHBOARD_DEPLOY/earnings-daily-update-standalone.ts`
5. העתק הכל (Cmd+A, Cmd+C)
6. הדבק ב-editor (Cmd+V)
7. לחץ **Deploy**

#### פונקציה 2: earnings-results-update
1. לחץ **Create a new function**
2. שם: `earnings-results-update`
3. פתח את: `DASHBOARD_DEPLOY/earnings-results-update-standalone.ts`
4. העתק הכל → הדבק → **Deploy**

#### פונקציה 3: daily-earnings-sync-simple
1. לחץ **Create a new function**
2. שם: `daily-earnings-sync-simple`
3. פתח את: `DASHBOARD_DEPLOY/daily-earnings-sync-simple-standalone.ts`
4. העתק הכל → הדבק → **Deploy**

#### פונקציה 4: benzinga-websocket-stream (אם לא קיימת)
1. לחץ **Create a new function**
2. שם: `benzinga-websocket-stream`
3. פתח את: `DASHBOARD_DEPLOY/benzinga-websocket-stream-standalone.ts`
4. העתק הכל → הדבק → **Deploy**

---

### שלב 4: בדיקה

לאחר הפריסה, בדוק שכל הפונקציות עובדות:

```bash
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ"
BASE_URL="https://wpmrtczbfcijoocguime.supabase.co/functions/v1"

for func in "earnings-daily-update" "earnings-results-update" "daily-earnings-sync-simple" "benzinga-websocket-stream"; do
  echo "📡 בודק: $func"
  curl -s -X POST "${BASE_URL}/${func}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" | head -3
  echo ""
done
```

כל הפונקציות צריכות להחזיר `success: true`.

---

## ✅ סיכום

**למחוק (אם קיימות):**
- ❌ `earnings-result-update`
- ❌ `result-earning-up`
- ❌ כל פונקציה ישנה אחרת עם EODHD

**ליצור/לעדכן:**
- ✅ `earnings-daily-update` - חדש עם Benzinga
- ✅ `earnings-results-update` - חדש עם Benzinga
- ✅ `daily-earnings-sync-simple` - חדש עם Benzinga
- ✅ `benzinga-websocket-stream` - חדש עם Benzinga (כבר קיימת ועובדת)

**סה"כ: 4 פונקציות פעילות עם Benzinga API**

---

## 📝 קבצים לפריסה

כל הקבצים ב-`DASHBOARD_DEPLOY/`:
- ✅ `earnings-daily-update-standalone.ts`
- ✅ `earnings-results-update-standalone.ts`
- ✅ `daily-earnings-sync-simple-standalone.ts`
- ✅ `benzinga-websocket-stream-standalone.ts`

כולם מוכנים לפריסה!


