# 🚀 פריסה עכשיו - הוראות מהירות

## ⚡ שלב 1: הגדר Environment Variable (2 דקות)

1. פתח: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/settings/functions
2. גלול למטה ל-**Secrets** או **Environment Variables**
3. לחץ **Add new secret**
4. שם: `BENZINGA_API_KEY`
5. ערך: `bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC`
6. לחץ **Save**

---

## 📦 שלב 2: פרוס את 4 הפונקציות (10 דקות)

### פונקציה 1: earnings-daily-update

1. פתח: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions
2. לחץ **Create a new function** (או Edit אם קיימת)
3. שם: `earnings-daily-update`
4. פתח את הקובץ: `DASHBOARD_DEPLOY/earnings-daily-update-standalone.ts`
5. העתק את כל התוכן (Cmd+A, Cmd+C)
6. הדבק ב-editor של Dashboard (Cmd+V)
7. לחץ **Deploy**

### פונקציה 2: earnings-results-update

1. לחץ **Create a new function** שוב
2. שם: `earnings-results-update`
3. העתק מהקובץ: `DASHBOARD_DEPLOY/earnings-results-update-standalone.ts`
4. הדבק → **Deploy**

### פונקציה 3: daily-earnings-sync-simple

1. לחץ **Create a new function** שוב
2. שם: `daily-earnings-sync-simple`
3. העתק מהקובץ: `DASHBOARD_DEPLOY/daily-earnings-sync-simple-standalone.ts`
4. הדבק → **Deploy**

### פונקציה 4: benzinga-websocket-stream

1. לחץ **Create a new function** שוב
2. שם: `benzinga-websocket-stream`
3. העתק מהקובץ: `DASHBOARD_DEPLOY/benzinga-websocket-stream-standalone.ts`
4. הדבק → **Deploy**

---

## ✅ סיכום

- ✅ 1 Environment Variable הוגדר
- ✅ 4 Edge Functions נפרסו
- ✅ כל הפונקציות משתמשות ב-Benziga API

**זמן כולל: ~12 דקות**

---

## 🔍 בדיקה

לאחר הפריסה, לך לכל פונקציה → **Logs** ובדוק שאין שגיאות.

---

## 📝 קבצים לפריסה

כל הקבצים נמצאים ב-`DASHBOARD_DEPLOY/`:
- `earnings-daily-update-standalone.ts`
- `earnings-results-update-standalone.ts`
- `daily-earnings-sync-simple-standalone.ts`
- `benzinga-websocket-stream-standalone.ts`


