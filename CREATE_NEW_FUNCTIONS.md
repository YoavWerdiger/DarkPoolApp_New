# 🆕 יצירת פונקציות חדשות - Benzinga API

## 📋 רשימת הפונקציות החדשות:

1. **earnings-daily-update** - עדכון יומי
2. **earnings-results-update** - עדכון תוצאות
3. **daily-earnings-sync-simple** - סינכרון כללי
4. **benzinga-websocket-stream** - WebSocket stream (כבר קיימת)

---

## 🚀 יצירה דרך Dashboard (מומלץ):

### שלב 1: לך ל-Edge Functions
https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions

### שלב 2: צור כל פונקציה

#### פונקציה 1: earnings-daily-update
1. לחץ **Create a new function**
2. שם: `earnings-daily-update`
3. העתק את כל הקוד מ: `DASHBOARD_DEPLOY/earnings-daily-update-standalone.ts`
4. הדבק ב-editor
5. לחץ **Deploy**

#### פונקציה 2: earnings-results-update
1. לחץ **Create a new function**
2. שם: `earnings-results-update`
3. העתק את כל הקוד מ: `DASHBOARD_DEPLOY/earnings-results-update-standalone.ts`
4. הדבק ב-editor
5. לחץ **Deploy**

#### פונקציה 3: daily-earnings-sync-simple
1. לחץ **Create a new function**
2. שם: `daily-earnings-sync-simple`
3. העתק את כל הקוד מ: `DASHBOARD_DEPLOY/daily-earnings-sync-simple-standalone.ts`
4. הדבק ב-editor
5. לחץ **Deploy**

---

## 🔐 לפני הפריסה - ודא שה-Secret הוגדר:

לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/settings/functions

הוסף Secret:
- **Name:** `BENZINGA_API_KEY`
- **Value:** `bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC`

---

## ✅ אחרי הפריסה:

כל הפונקציות יעבדו עם **Benzinga API** במקום EODHD!


