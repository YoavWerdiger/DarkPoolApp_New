# 📋 קבצים לפריסה דרך Dashboard - גרסאות Standalone

## ⚠️ חשוב מאוד!

**Dashboard של Supabase לא תומך ב-shared files** (`_shared/earnings-utils.ts`).

קבצים אלה הם גרסאות **standalone** עם כל הקוד inline - מוכנים להעתקה ישירה ל-Dashboard.

---

## 🚀 הוראות פריסה

### שלב 1: הגדרת Environment Variable

1. לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/settings/functions
2. לחץ **Add new secret**
3. שם: `BENZINGA_API_KEY`
4. ערך: `bz.UKZEVEBSS33KJXCKAPG6BDBAA3Z7SFRC`
5. לחץ **Save**

### שלב 2: פריסת הפונקציות

#### פונקציה 1: earnings-daily-update

1. לך ל: https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/functions
2. אם הפונקציה כבר קיימת - לחץ עליה ואז **Edit**
3. אם לא - לחץ **Create a new function**
4. שם: `earnings-daily-update`
5. העתק את כל התוכן מ-`earnings-daily-update-standalone.ts`
6. הדבק ב-editor
7. לחץ **Deploy** או **Save**

#### פונקציה 2: earnings-results-update

1. לחץ **Create a new function** או **Edit** אם קיימת
2. שם: `earnings-results-update`
3. העתק את כל התוכן מ-`earnings-results-update-standalone.ts`
4. הדבק ב-editor
5. לחץ **Deploy** או **Save**

#### פונקציה 3: daily-earnings-sync-simple

1. לחץ **Create a new function** או **Edit** אם קיימת
2. שם: `daily-earnings-sync-simple`
3. העתק את כל התוכן מ-`daily-earnings-sync-simple-standalone.ts`
4. הדבק ב-editor
5. לחץ **Deploy** או **Save**

#### פונקציה 4: benzinga-websocket-stream (חדש!)

1. לחץ **Create a new function**
2. שם: `benzinga-websocket-stream`
3. העתק את כל התוכן מ-`benzinga-websocket-stream-standalone.ts`
4. הדבק ב-editor
5. לחץ **Deploy** או **Save**

---

## 📝 הערות

- כל קובץ מכיל את כל הקוד הנדרש inline
- אין צורך ב-shared files
- מוכן להעתקה ישירה ל-Dashboard

---

## ✅ בדיקה

לאחר הפריסה, בדוק את ה-Logs דרך Dashboard:
1. לך ל-Edge Functions
2. בחר פונקציה
3. לחץ **Logs**
4. בדוק שאין שגיאות

