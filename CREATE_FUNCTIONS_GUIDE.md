# 🆕 מדריך יצירת פונקציות חדשות - Dashboard

## 📋 שלב 1: ודא שה-Secret הוגדר

1. לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/settings/functions
2. גלול ל-**Secrets**
3. הוסף:
   - **Name:** `BENZINGA_API_KEY`
   - **Value:** `bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC`

---

## 🚀 שלב 2: צור 4 פונקציות חדשות

### לך ל-Edge Functions:
https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions

---

### פונקציה 1: earnings-daily-update

1. לחץ **"Create a new function"** או **"New Function"**
2. שם הפונקציה: `earnings-daily-update`
3. פתח את הקובץ: `DASHBOARD_DEPLOY/earnings-daily-update-standalone.ts`
4. העתק את **כל התוכן** (Cmd+A, Cmd+C)
5. הדבק ב-editor (Cmd+V)
6. לחץ **"Deploy"** או **"Save"**

---

### פונקציה 2: earnings-results-update

1. לחץ **"Create a new function"**
2. שם הפונקציה: `earnings-results-update`
3. פתח את: `DASHBOARD_DEPLOY/earnings-results-update-standalone.ts`
4. העתק הכל → הדבק
5. לחץ **"Deploy"**

---

### פונקציה 3: daily-earnings-sync-simple

1. לחץ **"Create a new function"**
2. שם הפונקציה: `daily-earnings-sync-simple`
3. פתח את: `DASHBOARD_DEPLOY/daily-earnings-sync-simple-standalone.ts`
4. העתק הכל → הדבק
5. לחץ **"Deploy"**

---

### פונקציה 4: benzinga-websocket-stream (כבר קיימת!)

אם היא כבר קיימת ועובדת - אל תגע בה!
אם לא - צור אותה כמו הפונקציות הקודמות.

---

## ✅ בדיקה אחרי הפריסה

אחרי שתפרוס את כל הפונקציות, בדוק:

```bash
# פונקציה 1
curl -X POST https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-daily-update \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"

# פונקציה 2
curl -X POST https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-results-update \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"

# פונקציה 3
curl -X POST https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

כל הפונקציות צריכות להחזיר `{"success": true, ...}`

---

## 📁 הקבצים מוכנים:

כל הקבצים ב-`DASHBOARD_DEPLOY/` מוכנים לפריסה!

- ✅ `earnings-daily-update-standalone.ts`
- ✅ `earnings-results-update-standalone.ts`
- ✅ `daily-earnings-sync-simple-standalone.ts`
- ✅ `benzinga-websocket-stream-standalone.ts`

**כולם standalone - אין צורך ב-shared files!**










